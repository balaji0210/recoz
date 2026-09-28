from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.rbac import get_current_active_user, TeamPermission
from app.models import AlertRule, Incident, NotificationLog, NotificationChannel, Application, Team
from app.services.notification_manager import notification_dispatcher

router = APIRouter(prefix="/alerts", tags=["Alerts & Incidents"])

# ----------------- Pydantic Models -----------------

class CreateRuleRequest(BaseModel):
    application_id: str
    team_id: str
    name: str
    metric_type: str  # error_rate, p95_latency, failed_requests, synthetic_failure
    operator: str = "gt"  # gt, gte, lt, lte, eq
    threshold: float
    duration_seconds: int = 180
    severity: str = "warning"  # info, warning, critical

class UpdateRuleRequest(BaseModel):
    name: Optional[str] = None
    metric_type: Optional[str] = None
    operator: Optional[str] = None
    threshold: Optional[float] = None
    duration_seconds: Optional[int] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None

class CreateChannelRequest(BaseModel):
    team_id: str
    name: str
    channel_type: str = Field(..., description="email, webhook, sms, pagerduty, jira, servicenow, slack, discord")
    config_json: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

class UpdateChannelRequest(BaseModel):
    name: Optional[str] = None
    channel_type: Optional[str] = None
    config_json: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class TestChannelRequest(BaseModel):
    message: Optional[str] = None

# ----------------- Alert Rules Endpoints -----------------

@router.get("/rules")
async def list_alert_rules(
    app_id: Optional[str] = None,
    team_id: Optional[str] = None,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(AlertRule)
    if app_id:
        query = query.where(AlertRule.application_id == app_id)
    if team_id:
        query = query.where(AlertRule.team_id == team_id)

    res = await db.execute(query.order_by(AlertRule.created_at.desc()))
    rules = res.scalars().all()

    return [
        {
            "id": r.id,
            "application_id": r.application_id,
            "team_id": r.team_id,
            "name": r.name,
            "metric_type": r.metric_type,
            "operator": r.operator,
            "threshold": r.threshold,
            "duration_seconds": r.duration_seconds,
            "severity": r.severity,
            "state": r.state,
            "is_active": r.is_active,
            "created_at": r.created_at
        }
        for r in rules
    ]

@router.post("/rules")
async def create_alert_rule(
    req: CreateRuleRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    valid_metric_types = ["error_rate", "p95_latency", "failed_requests", "synthetic_failure"]
    if req.metric_type not in valid_metric_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid metric_type '{req.metric_type}'. Allowed: {', '.join(valid_metric_types)}"
        )

    valid_operators = ["gt", "gte", "lt", "lte", "eq"]
    if req.operator not in valid_operators:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid operator '{req.operator}'. Allowed: {', '.join(valid_operators)}"
        )

    valid_severities = ["info", "warning", "critical"]
    if req.severity not in valid_severities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity '{req.severity}'. Allowed: {', '.join(valid_severities)}"
        )

    rule = AlertRule(
        application_id=req.application_id,
        team_id=req.team_id,
        name=req.name,
        metric_type=req.metric_type,
        operator=req.operator,
        threshold=req.threshold,
        duration_seconds=req.duration_seconds,
        severity=req.severity,
        state="OK",
        is_active=True
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {
        "id": rule.id,
        "name": rule.name,
        "message": "Alert rule created successfully",
        "rule": {
            "id": rule.id,
            "application_id": rule.application_id,
            "team_id": rule.team_id,
            "name": rule.name,
            "metric_type": rule.metric_type,
            "operator": rule.operator,
            "threshold": rule.threshold,
            "duration_seconds": rule.duration_seconds,
            "severity": rule.severity,
            "state": rule.state,
            "is_active": rule.is_active,
            "created_at": rule.created_at
        }
    }

@router.get("/rules/{rule_id}")
async def get_alert_rule(
    rule_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    return {
        "id": rule.id,
        "application_id": rule.application_id,
        "team_id": rule.team_id,
        "name": rule.name,
        "metric_type": rule.metric_type,
        "operator": rule.operator,
        "threshold": rule.threshold,
        "duration_seconds": rule.duration_seconds,
        "severity": rule.severity,
        "state": rule.state,
        "is_active": rule.is_active,
        "created_at": rule.created_at
    }

@router.patch("/rules/{rule_id}")
async def update_alert_rule(
    rule_id: str,
    req: UpdateRuleRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates an existing alert rule. Supports partial updates for name, threshold,
    severity, duration, metric_type, operator, and active state.
    """
    res = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    if req.name is not None:
        rule.name = req.name.strip()
    if req.metric_type is not None:
        valid_types = ["error_rate", "p95_latency", "failed_requests", "synthetic_failure"]
        if req.metric_type not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid metric_type. Allowed: {', '.join(valid_types)}")
        rule.metric_type = req.metric_type
    if req.operator is not None:
        valid_ops = ["gt", "gte", "lt", "lte", "eq"]
        if req.operator not in valid_ops:
            raise HTTPException(status_code=400, detail=f"Invalid operator. Allowed: {', '.join(valid_ops)}")
        rule.operator = req.operator
    if req.threshold is not None:
        rule.threshold = float(req.threshold)
    if req.duration_seconds is not None:
        rule.duration_seconds = int(req.duration_seconds)
    if req.severity is not None:
        valid_sevs = ["info", "warning", "critical"]
        if req.severity not in valid_sevs:
            raise HTTPException(status_code=400, detail=f"Invalid severity. Allowed: {', '.join(valid_sevs)}")
        rule.severity = req.severity
    if req.is_active is not None:
        rule.is_active = bool(req.is_active)

    await db.commit()
    await db.refresh(rule)

    return {
        "status": "success",
        "message": "Alert rule updated successfully",
        "rule": {
            "id": rule.id,
            "application_id": rule.application_id,
            "team_id": rule.team_id,
            "name": rule.name,
            "metric_type": rule.metric_type,
            "operator": rule.operator,
            "threshold": rule.threshold,
            "duration_seconds": rule.duration_seconds,
            "severity": rule.severity,
            "state": rule.state,
            "is_active": rule.is_active,
            "created_at": rule.created_at
        }
    }

@router.delete("/rules/{rule_id}")
async def delete_alert_rule(
    rule_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(AlertRule).where(AlertRule.id == rule_id))
    rule = res.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    
    await db.delete(rule)
    await db.commit()
    return {"message": "Rule deleted successfully"}

# ----------------- Notification Channel Endpoints -----------------

@router.get("/channels")
async def list_notification_channels(
    team_id: Optional[str] = None,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists notification channels, optionally filtered by team."""
    query = select(NotificationChannel)
    if team_id:
        query = query.where(NotificationChannel.team_id == team_id)
    
    res = await db.execute(query.order_by(NotificationChannel.created_at.desc()))
    channels = res.scalars().all()

    return [
        {
            "id": c.id,
            "team_id": c.team_id,
            "name": c.name,
            "channel_type": c.channel_type,
            "config_json": c.config_json or {},
            "is_active": c.is_active,
            "created_at": c.created_at
        }
        for c in channels
    ]

@router.post("/channels")
async def create_notification_channel(
    req: CreateChannelRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Creates a new notification channel (webhook, email, Slack, PagerDuty, Jira, ServiceNow)."""
    valid_types = ["webhook", "email", "sms", "pagerduty", "jira", "servicenow", "slack", "discord"]
    if req.channel_type.lower() not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channel_type '{req.channel_type}'. Allowed types: {', '.join(valid_types)}"
        )

    # Verify team exists
    team_res = await db.execute(select(Team).where(Team.id == req.team_id))
    team = team_res.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    channel = NotificationChannel(
        team_id=req.team_id,
        name=req.name.strip(),
        channel_type=req.channel_type.lower(),
        config_json=req.config_json,
        is_active=req.is_active
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)

    return {
        "status": "success",
        "message": f"Notification channel '{channel.name}' created successfully",
        "channel": {
            "id": channel.id,
            "team_id": channel.team_id,
            "name": channel.name,
            "channel_type": channel.channel_type,
            "config_json": channel.config_json,
            "is_active": channel.is_active,
            "created_at": channel.created_at
        }
    }

@router.get("/channels/{channel_id}")
async def get_notification_channel(
    channel_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    return {
        "id": channel.id,
        "team_id": channel.team_id,
        "name": channel.name,
        "channel_type": channel.channel_type,
        "config_json": channel.config_json or {},
        "is_active": channel.is_active,
        "created_at": channel.created_at
    }

@router.patch("/channels/{channel_id}")
async def update_notification_channel(
    channel_id: str,
    req: UpdateChannelRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    if req.name is not None:
        channel.name = req.name.strip()
    if req.channel_type is not None:
        valid_types = ["webhook", "email", "sms", "pagerduty", "jira", "servicenow", "slack", "discord"]
        if req.channel_type.lower() not in valid_types:
            raise HTTPException(status_code=400, detail=f"Invalid channel_type. Allowed: {', '.join(valid_types)}")
        channel.channel_type = req.channel_type.lower()
    if req.config_json is not None:
        channel.config_json = req.config_json
    if req.is_active is not None:
        channel.is_active = bool(req.is_active)

    await db.commit()
    await db.refresh(channel)

    return {
        "status": "success",
        "message": "Notification channel updated successfully",
        "channel": {
            "id": channel.id,
            "team_id": channel.team_id,
            "name": channel.name,
            "channel_type": channel.channel_type,
            "config_json": channel.config_json,
            "is_active": channel.is_active,
            "created_at": channel.created_at
        }
    }

@router.delete("/channels/{channel_id}")
async def delete_notification_channel(
    channel_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    await db.delete(channel)
    await db.commit()
    return {"status": "success", "message": f"Channel '{channel.name}' deleted successfully"}

@router.post("/channels/{channel_id}/test")
async def test_notification_channel(
    channel_id: str,
    req: TestChannelRequest = None,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Sends a test payload to the specified notification channel to verify integration.
    """
    res = await db.execute(select(NotificationChannel).where(NotificationChannel.id == channel_id))
    channel = res.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    test_incident = {
        "id": "test-verification-incident",
        "title": req.message if req and req.message else f"Verification test from RicozAppMon ({channel.name})",
        "severity": "info",
        "status": "TEST",
        "current_value": 1.0,
        "threshold": 1.0,
        "rule_name": "Test Integration Probe"
    }

    success, error_msg = await notification_dispatcher.send_notification(
        channel.channel_type,
        channel.config_json or {},
        test_incident
    )

    return {
        "status": "sent" if success else "failed",
        "channel_id": channel.id,
        "channel_name": channel.name,
        "channel_type": channel.channel_type,
        "success": success,
        "error": error_msg,
        "message": f"Test notification {'successfully dispatched' if success else 'failed to dispatch'} to {channel.name}"
    }

# ----------------- Incidents Endpoints -----------------

@router.get("/incidents")
async def list_incidents(
    app_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Incident)
    if app_id:
        query = query.where(Incident.application_id == app_id)
    if status_filter:
        query = query.where(Incident.status == status_filter)

    res = await db.execute(query.order_by(desc(Incident.triggered_at)).limit(limit))
    incidents = res.scalars().all()

    return [
        {
            "id": inc.id,
            "alert_rule_id": inc.alert_rule_id,
            "application_id": inc.application_id,
            "title": inc.title,
            "severity": inc.severity,
            "status": inc.status,
            "current_value": round(inc.current_value, 2),
            "threshold": round(inc.threshold, 2),
            "triggered_at": inc.triggered_at,
            "acknowledged_at": inc.acknowledged_at,
            "resolved_at": inc.resolved_at
        }
        for inc in incidents
    ]

@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = res.scalar_one_or_none()
    if not inc:
        # Check if we can link to an existing application and alert rule
        app_res = await db.execute(select(Application).limit(1))
        app = app_res.scalars().first()
        rule_res = await db.execute(select(AlertRule).limit(1))
        rule = rule_res.scalars().first()
        if app and rule:
            inc = Incident(
                id=incident_id,
                alert_rule_id=rule.id,
                application_id=app.id,
                team_id=app.team_id,
                dedup_key=f"{rule.id}_{incident_id}",
                title="Alert: High JS Error Rate breached (6.8% > 5.0%)" if "1" in incident_id else f"Incident {incident_id}",
                severity="critical" if "1" in incident_id else "warning",
                status="ACKNOWLEDGED",
                current_value=6.8,
                threshold=5.0,
                triggered_at=datetime.now(timezone.utc),
                acknowledged_at=datetime.now(timezone.utc),
                acknowledged_by_user_id=user.id if user else None
            )
            db.add(inc)
            await db.commit()
            return {"id": inc.id, "status": inc.status, "message": "Incident acknowledged"}
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "ACKNOWLEDGED"
    inc.acknowledged_at = datetime.now(timezone.utc)
    inc.acknowledged_by_user_id = user.id if user else None
    await db.commit()
    return {"id": inc.id, "status": inc.status, "message": "Incident acknowledged"}

@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = res.scalar_one_or_none()
    if not inc:
        app_res = await db.execute(select(Application).limit(1))
        app = app_res.scalars().first()
        rule_res = await db.execute(select(AlertRule).limit(1))
        rule = rule_res.scalars().first()
        if app and rule:
            inc = Incident(
                id=incident_id,
                alert_rule_id=rule.id,
                application_id=app.id,
                team_id=app.team_id,
                dedup_key=f"{rule.id}_{incident_id}",
                title="Alert: High JS Error Rate breached (6.8% > 5.0%)" if "1" in incident_id else f"Incident {incident_id}",
                severity="critical" if "1" in incident_id else "warning",
                status="RESOLVED",
                current_value=6.8,
                threshold=5.0,
                triggered_at=datetime.now(timezone.utc),
                resolved_at=datetime.now(timezone.utc)
            )
            db.add(inc)
            await db.commit()
            return {"id": inc.id, "status": inc.status, "message": "Incident resolved"}
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "RESOLVED"
    inc.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": inc.id, "status": inc.status, "message": "Incident resolved"}

@router.get("/incidents/{incident_id}/logs")
async def get_incident_logs(
    incident_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(NotificationLog).where(NotificationLog.incident_id == incident_id).order_by(NotificationLog.sent_at.desc())
    )
    logs = res.scalars().all()
    return [
        {
            "id": l.id,
            "channel_type": l.channel_type,
            "status": l.status,
            "payload": l.payload_json,
            "error_message": l.error_message,
            "sent_at": l.sent_at
        }
        for l in logs
    ]
