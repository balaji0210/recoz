import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.models import AlertRule, Incident, NotificationChannel, NotificationLog, Application, RUMEvent, ErrorEvent, SyntheticCheck
from app.services.notification_manager import notification_dispatcher

logger = logging.getLogger("ricoz.alert_evaluator")

class AlertEvaluator:
    async def evaluate_rule(
        self,
        rule: AlertRule,
        current_metric_value: float,
        db: AsyncSession
    ) -> Optional[Incident]:
        """
        Evaluates a single alert rule against its current metric value and updates state machine.
        States: OK -> PENDING -> FIRING -> RESOLVED
        """
        now = datetime.now(timezone.utc)
        is_breached = self._check_breach(current_metric_value, rule.operator, rule.threshold)

        if is_breached:
            if rule.state == "OK":
                rule.state = "PENDING"
                rule.pending_since = now
                logger.info(f"Rule [{rule.name}] state changed to PENDING (value: {current_metric_value}, threshold: {rule.threshold})")
            elif rule.state == "PENDING":
                # Check if duration satisfied
                pending_duration = (now - (rule.pending_since.replace(tzinfo=timezone.utc) if rule.pending_since.tzinfo is None else rule.pending_since)).total_seconds()
                if pending_duration >= rule.duration_seconds:
                    rule.state = "FIRING"
                    logger.warning(f"Rule [{rule.name}] FIRING! Breached for {pending_duration:.0f}s >= {rule.duration_seconds}s")
                    
                    # Create or find existing Open incident
                    incident = await self._trigger_incident(rule, current_metric_value, db)
                    return incident
            elif rule.state == "FIRING":
                # Still firing, update current incident value
                pass
        else:
            if rule.state in ["PENDING", "FIRING"]:
                previous_state = rule.state
                rule.state = "OK"
                rule.pending_since = None
                
                if previous_state == "FIRING":
                    logger.info(f"Rule [{rule.name}] RESOLVED! Metric value {current_metric_value} is back to normal.")
                    await self._resolve_incident(rule, current_metric_value, db)

        return None

    def _check_breach(self, value: float, operator: str, threshold: float) -> bool:
        if operator in ["gt", ">"]:
            return value > threshold
        elif operator in ["gte", ">="]:
            return value >= threshold
        elif operator in ["lt", "<"]:
            return value < threshold
        elif operator in ["lte", "<="]:
            return value <= threshold
        elif operator in ["eq", "=="]:
            return value == threshold
        return False

    def is_rule_breached(self, value: float, operator: str, threshold: float) -> bool:
        """Public helper to evaluate whether a metric breaches rule operator & threshold."""
        return self._check_breach(value, operator, threshold)

    async def get_current_metric_value(self, rule: AlertRule, db: AsyncSession) -> float:
        """
        Calculates the real-time metric value for an alert rule over the last 5-minute rolling window.
        Supported metric types: error_rate, p95_latency, failed_requests, synthetic_failure.
        """
        now = datetime.now(timezone.utc)
        window_start = now - timedelta(minutes=5)
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
            else:
                val = 0.0

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
            val = float(fail_res.scalar() or 0.0)

        elif rule.metric_type == "synthetic_failure":
            chk_res = await db.execute(
                select(func.count(SyntheticCheck.id)).where(
                    SyntheticCheck.application_id == rule.application_id,
                    SyntheticCheck.status == "DOWN"
                )
            )
            val = float(chk_res.scalar() or 0.0)

        return round(val, 2)

    async def _trigger_incident(self, rule: AlertRule, current_value: float, db: AsyncSession) -> Incident:
        dedup_key = f"alert:{rule.id}:{rule.application_id}"
        
        # Check if an open, acknowledged, or investigating incident already exists
        res = await db.execute(
            select(Incident).where(
                Incident.alert_rule_id == rule.id,
                Incident.status.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"])
            )
        )
        existing = res.scalar_one_or_none()
        if existing:
            existing.current_value = current_value
            return existing

        # Create new incident
        incident = Incident(
            alert_rule_id=rule.id,
            application_id=rule.application_id,
            team_id=rule.team_id,
            dedup_key=dedup_key,
            title=f"Alert: {rule.name} breached ({current_value:.2f} {rule.operator} {rule.threshold:.2f})",
            severity=rule.severity,
            status="OPEN",
            current_value=current_value,
            threshold=rule.threshold,
            triggered_at=datetime.now(timezone.utc)
        )
        db.add(incident)
        await db.flush()

        # Send notifications to team channels
        channels_res = await db.execute(
            select(NotificationChannel).where(
                NotificationChannel.team_id == rule.team_id,
                NotificationChannel.is_active == True
            )
        )
        channels = channels_res.scalars().all()

        incident_dict = {
            "id": incident.id,
            "title": incident.title,
            "severity": incident.severity,
            "status": incident.status,
            "current_value": current_value,
            "threshold": rule.threshold,
            "rule_name": rule.name
        }

        for ch in channels:
            success, err = await notification_dispatcher.send_notification(
                ch.channel_type,
                ch.config_json or {},
                incident_dict
            )
            log = NotificationLog(
                incident_id=incident.id,
                channel_id=ch.id,
                channel_type=ch.channel_type,
                status="SENT" if success else "FAILED",
                payload_json=incident_dict,
                error_message=err
            )
            db.add(log)

        return incident

    async def _resolve_incident(self, rule: AlertRule, current_value: float, db: AsyncSession):
        res = await db.execute(
            select(Incident).where(
                Incident.alert_rule_id == rule.id,
                Incident.status.in_(["OPEN", "ACKNOWLEDGED", "INVESTIGATING"])
            )
        )
        incidents = res.scalars().all()
        now = datetime.now(timezone.utc)

        for inc in incidents:
            inc.status = "RESOLVED"
            inc.resolved_at = now
            inc.current_value = current_value
            inc.resolution_notes = "Resolved automatically: metric value returned to safe operating threshold."
            
            # Send resolve notification
            channels_res = await db.execute(
                select(NotificationChannel).where(
                    NotificationChannel.team_id == rule.team_id,
                    NotificationChannel.is_active == True
                )
            )
            channels = channels_res.scalars().all()
            inc_dict = {
                "id": inc.id,
                "title": f"RESOLVED: {rule.name}",
                "severity": inc.severity,
                "status": "RESOLVED",
                "current_value": current_value,
                "threshold": rule.threshold
            }
            for ch in channels:
                success, err = await notification_dispatcher.send_notification(
                    ch.channel_type,
                    ch.config_json or {},
                    inc_dict
                )
                log = NotificationLog(
                    incident_id=inc.id,
                    channel_id=ch.id,
                    channel_type=ch.channel_type,
                    status="SENT" if success else "FAILED",
                    payload_json=inc_dict,
                    error_message=err
                )
                db.add(log)

alert_evaluator = AlertEvaluator()
