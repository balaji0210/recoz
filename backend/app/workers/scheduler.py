import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from sqlalchemy import select, func

from app.core.database import AsyncSessionLocal
from app.models import SyntheticCheck, SyntheticStep, SyntheticResult, AlertRule, RUMEvent, ErrorEvent
from app.services.synthetic_runner import synthetic_runner
from app.services.alert_evaluator import alert_evaluator

logger = logging.getLogger("ricoz.scheduler")

# Try to import APScheduler
try:
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.interval import IntervalTrigger
    from apscheduler.events import EVENT_JOB_EXECUTED, EVENT_JOB_ERROR
    HAS_APSCHEDULER = True
except ImportError:
    AsyncIOScheduler = None
    HAS_APSCHEDULER = False

class ProductionScheduler:
    def __init__(self):
        self.is_running = False
        self.engine_type = "APScheduler" if HAS_APSCHEDULER else "AsyncFallbackScheduler"
        self._scheduler: Optional[Any] = None
        self._fallback_task: Optional[asyncio.Task] = None
        self.start_time: Optional[float] = None

        # Telemetry and job execution metrics
        self.job_stats: Dict[str, Dict[str, Any]] = {
            "synthetic_checks": {
                "name": "Synthetic Monitor Execution",
                "interval_seconds": 30,
                "status": "IDLE",
                "run_count": 0,
                "error_count": 0,
                "last_run": None,
                "last_duration_ms": 0.0,
                "last_error": None
            },
            "alert_evaluation": {
                "name": "Alert Rule Evaluation State Machine",
                "interval_seconds": 30,
                "status": "IDLE",
                "run_count": 0,
                "error_count": 0,
                "last_run": None,
                "last_duration_ms": 0.0,
                "last_error": None
            }
        }

    def start(self):
        """Starts the production scheduler."""
        if self.is_running:
            return

        self.is_running = True
        self.start_time = time.time()

        if HAS_APSCHEDULER:
            try:
                self._scheduler = AsyncIOScheduler()
                self._scheduler.add_job(
                    self.execute_synthetic_checks,
                    trigger=IntervalTrigger(seconds=30),
                    id="synthetic_checks",
                    name="Synthetic Runner Job",
                    replace_existing=True,
                    coalesce=True,
                    max_instances=1
                )
                self._scheduler.add_job(
                    self.execute_alert_evaluation,
                    trigger=IntervalTrigger(seconds=30),
                    id="alert_evaluation",
                    name="Alert Evaluator Job",
                    replace_existing=True,
                    coalesce=True,
                    max_instances=1
                )
                self._scheduler.start()
                logger.info("APScheduler AsyncIOScheduler started successfully with 30s interval triggers.")
                return
            except Exception as e:
                logger.error(f"Failed to start APScheduler, falling back to resilient async loop: {str(e)}")

        # Resilient fallback loop
        self.engine_type = "AsyncFallbackScheduler"
        self._fallback_task = asyncio.create_task(self._run_fallback_loop())
        logger.info("Resilient AsyncFallbackScheduler started successfully.")

    def stop(self):
        """Stops the scheduler gracefully."""
        self.is_running = False
        if HAS_APSCHEDULER and self._scheduler:
            try:
                self._scheduler.shutdown(wait=False)
            except Exception:
                pass
            self._scheduler = None

        if self._fallback_task:
            self._fallback_task.cancel()
            self._fallback_task = None
        logger.info("Production scheduler stopped.")

    async def _run_fallback_loop(self):
        """Resilient fallback loop when APScheduler is unavailable."""
        while self.is_running:
            try:
                await self.execute_synthetic_checks()
                await self.execute_alert_evaluation()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler cycle error: {str(e)}", exc_info=True)
            
            await asyncio.sleep(30)

    async def execute_synthetic_checks(self):
        """Executes synthetic checks job with performance metrics tracking."""
        job_key = "synthetic_checks"
        stats = self.job_stats[job_key]
        stats["status"] = "RUNNING"
        t0 = time.time()
        try:
            await self._run_synthetic_checks_internal()
            stats["run_count"] += 1
            stats["status"] = "OK"
            stats["last_error"] = None
        except Exception as e:
            stats["error_count"] += 1
            stats["status"] = "ERROR"
            stats["last_error"] = str(e)
            logger.error(f"Error executing synthetic checks job: {str(e)}", exc_info=True)
        finally:
            stats["last_duration_ms"] = round((time.time() - t0) * 1000, 2)
            stats["last_run"] = datetime.now(timezone.utc).isoformat()

    async def execute_alert_evaluation(self):
        """Evaluates all active alert rules with state machine transitions."""
        job_key = "alert_evaluation"
        stats = self.job_stats[job_key]
        stats["status"] = "RUNNING"
        t0 = time.time()
        try:
            await self._evaluate_alerts_internal()
            stats["run_count"] += 1
            stats["status"] = "OK"
            stats["last_error"] = None
        except Exception as e:
            stats["error_count"] += 1
            stats["status"] = "ERROR"
            stats["last_error"] = str(e)
            logger.error(f"Error executing alert evaluation job: {str(e)}", exc_info=True)
        finally:
            stats["last_duration_ms"] = round((time.time() - t0) * 1000, 2)
            stats["last_run"] = datetime.now(timezone.utc).isoformat()

    async def run_job_now(self, job_name: str) -> Dict[str, Any]:
        """Manually triggers an immediate execution of a specific scheduler job."""
        if job_name in ["synthetic_checks", "synthetics"]:
            await self.execute_synthetic_checks()
            return {"job": "synthetic_checks", "stats": self.job_stats["synthetic_checks"]}
        elif job_name in ["alert_evaluation", "alerts"]:
            await self.execute_alert_evaluation()
            return {"job": "alert_evaluation", "stats": self.job_stats["alert_evaluation"]}
        else:
            raise ValueError(f"Unknown job '{job_name}'. Allowed: 'synthetic_checks', 'alert_evaluation'")

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive scheduler status and execution statistics."""
        uptime = round(time.time() - self.start_time, 1) if self.start_time else 0.0
        jobs_info = []

        for job_id, stat in self.job_stats.items():
            next_run = None
            if HAS_APSCHEDULER and self._scheduler:
                job = self._scheduler.get_job(job_id)
                if job and job.next_run_time:
                    next_run = job.next_run_time.isoformat()

            jobs_info.append({
                "job_id": job_id,
                "name": stat["name"],
                "interval_seconds": stat["interval_seconds"],
                "status": stat["status"],
                "run_count": stat["run_count"],
                "error_count": stat["error_count"],
                "last_run": stat["last_run"],
                "next_run": next_run,
                "last_duration_ms": stat["last_duration_ms"],
                "last_error": stat["last_error"]
            })

        return {
            "is_running": self.is_running,
            "engine": self.engine_type,
            "has_apscheduler": HAS_APSCHEDULER,
            "uptime_seconds": uptime,
            "jobs": jobs_info
        }

    # Internal job implementations
    async def _run_synthetic_checks_internal(self):
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            res = await db.execute(select(SyntheticCheck).where(SyntheticCheck.is_active == True))
            checks = res.scalars().all()

            for check in checks:
                try:
                    # Check if check is due
                    if check.last_run_at:
                        last_run = check.last_run_at.replace(tzinfo=timezone.utc) if check.last_run_at.tzinfo is None else check.last_run_at
                        if (now - last_run).total_seconds() < check.interval_seconds:
                            continue

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

                    check.last_run_at = now
                    check.status = "HEALTHY" if result_data["status"] == "SUCCESS" else "DOWN"

                    # Rolling uptime calculation
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
                except Exception as check_err:
                    logger.error(f"Error evaluating synthetic check {check.id}: {str(check_err)}")

            await db.commit()

    async def _evaluate_alerts_internal(self):
        async with AsyncSessionLocal() as db:
            now = datetime.now(timezone.utc)
            window_start = now - timedelta(minutes=5)

            rules_res = await db.execute(select(AlertRule).where(AlertRule.is_active == True))
            rules = rules_res.scalars().all()

            for rule in rules:
                try:
                    val = 0.0
                    if rule.metric_type == "error_rate":
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
                        chk_res = await db.execute(
                            select(func.count(SyntheticCheck.id)).where(
                                SyntheticCheck.application_id == rule.application_id,
                                SyntheticCheck.status == "DOWN"
                            )
                        )
                        val = float(chk_res.scalar() or 0)

                    await alert_evaluator.evaluate_rule(rule, val, db)
                except Exception as rule_err:
                    logger.error(f"Error evaluating alert rule {rule.id} ({rule.name}): {str(rule_err)}")

            await db.commit()

scheduler = ProductionScheduler()
