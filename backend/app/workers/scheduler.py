import asyncio
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal
from app.models import SyntheticCheck, SyntheticStep, AlertRule, RUMEvent, ErrorEvent
from app.services.synthetic_runner import synthetic_runner
from app.services.alert_evaluator import alert_evaluator

logger = logging.getLogger("ricoz.scheduler")

class BackgroundScheduler:
    def __init__(self):
        self.is_running = False
        self._task = None

    def start(self):
        if not self.is_running:
            self.is_running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info("Background synthetic runner and alert evaluator started.")

    def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()

    async def _run_loop(self):
        while self.is_running:
            try:
                await self._run_synthetic_checks()
                await self._evaluate_alerts()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in background scheduler cycle: {str(e)}")
            
            # Wait 30 seconds before next iteration
            await asyncio.sleep(30)

    async def _run_synthetic_checks(self):
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            # Find active checks
            res = await db.execute(select(SyntheticCheck).where(SyntheticCheck.is_active == True))
            checks = res.scalars().all()

            for check in checks:
                # Check if due
                if check.last_run_at:
                    last_run = check.last_run_at.replace(tzinfo=timezone.utc) if check.last_run_at.tzinfo is None else check.last_run_at
                    if (now - last_run).total_seconds() < check.interval_seconds:
                        continue

                # Load steps if multi_step
                steps = []
                if check.check_type == "multi_step":
                    steps_res = await db.execute(
                        select(SyntheticStep).where(SyntheticStep.check_id == check.id).order_by(SyntheticStep.step_order)
                    )
                    steps = [
                        {
                            "step_order": s.step_order,
                            "name": s.name,
                            "method": s.method,
                            "url": s.url,
                            "headers_json": s.headers_json,
                            "body": s.body,
                            "extract_variable": s.extract_variable,
                            "assertion_json": s.assertion_json
                        }
                        for s in steps_res.scalars().all()
                    ]

                check_dict = {
                    "url": check.url,
                    "method": check.method,
                    "headers_json": check.headers_json,
                    "body": check.body,
                    "expected_status": check.expected_status,
                    "json_assertion": check.json_assertion,
                    "latency_sla_ms": check.latency_sla_ms,
                    "timeout_seconds": check.timeout_seconds,
                    "check_type": check.check_type
                }

                result_data = await synthetic_runner.execute_check(check_dict, steps)
                
                # Update check status & calculate uptime
                from app.models import SyntheticResult
                result_record = SyntheticResult(
                    check_id=check.id,
                    status=result_data["status"],
                    status_code=result_data["status_code"],
                    total_duration_ms=result_data["total_duration_ms"],
                    dns_duration_ms=result_data["dns_duration_ms"],
                    tcp_duration_ms=result_data["tcp_duration_ms"],
                    tls_duration_ms=result_data["tls_duration_ms"],
                    ttfb_duration_ms=result_data["ttfb_duration_ms"],
                    failure_reason=result_data["failure_reason"],
                    response_snippet=result_data["response_snippet"],
                    created_at=now
                )
                db.add(result_record)

                # Update check metadata
                check.last_run_at = now
                if result_data["status"] == "SUCCESS":
                    check.status = "HEALTHY"
                else:
                    check.status = "DOWN"

                # Calculate last 50 results uptime percentage
                recent_res = await db.execute(
                    select(SyntheticResult.status)
                    .where(SyntheticResult.check_id == check.id)
                    .order_by(SyntheticResult.created_at.desc())
                    .limit(50)
                )
                recent_statuses = recent_res.scalars().all()
                if recent_statuses:
                    success_count = sum(1 for s in recent_statuses if s == "SUCCESS")
                    check.uptime_percent = round((success_count / len(recent_statuses)) * 100.0, 2)

            await db.commit()

    async def _evaluate_alerts(self):
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(minutes=5)

            rules_res = await db.execute(select(AlertRule).where(AlertRule.is_active == True))
            rules = rules_res.scalars().all()

            for rule in rules:
                val = 0.0
                if rule.metric_type == "error_rate":
                    # Total events vs error events in last 5m
                    total_ev_res = await db.execute(
                        select(func.count(RUMEvent.id)).where(
                            RUMEvent.application_id == rule.application_id,
                            RUMEvent.created_at >= window_start
                        )
                    )
                    total_events = total_ev_res.scalar() or 0
                    
                    err_ev_res = await db.execute(
                        select(func.count(ErrorEvent.id)).where(
                            ErrorEvent.application_id == rule.application_id,
                            ErrorEvent.created_at >= window_start
                        )
                    )
                    error_events = err_ev_res.scalar() or 0
                    
                    if total_events > 0:
                        val = (error_events / total_events) * 100.0
                    elif error_events > 0:
                        val = 100.0

                elif rule.metric_type == "p95_latency":
                    # Average / P95 duration
                    dur_res = await db.execute(
                        select(func.avg(RUMEvent.duration)).where(
                            RUMEvent.application_id == rule.application_id,
                            RUMEvent.duration.is_not(None),
                            RUMEvent.created_at >= window_start
                        )
                    )
                    val = float(dur_res.scalar() or 0.0)

                elif rule.metric_type == "failed_requests":
                    fail_res = await db.execute(
                        select(func.count(RUMEvent.id)).where(
                            RUMEvent.application_id == rule.application_id,
                            RUMEvent.status_code >= 400,
                            RUMEvent.created_at >= window_start
                        )
                    )
                    val = float(fail_res.scalar() or 0)

                elif rule.metric_type == "synthetic_failure":
                    # Check down count
                    chk_res = await db.execute(
                        select(func.count(SyntheticCheck.id)).where(
                            SyntheticCheck.application_id == rule.application_id,
                            SyntheticCheck.status == "DOWN"
                        )
                    )
                    val = float(chk_res.scalar() or 0)

                await alert_evaluator.evaluate_rule(rule, val, db)

            await db.commit()

scheduler = BackgroundScheduler()
