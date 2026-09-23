from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.rbac import get_current_active_user, TeamPermission
from app.models import AlertRule, Incident, NotificationLog, Application

router = APIRouter(prefix="/alerts", tags=["Alerts & Incidents"])

class CreateRuleRequest(BaseModel):
    application_id: str
    team_id: str
    name: str
    metric_type: str  # error_rate, p95_latency, failed_requests, synthetic_failure
    operator: str = "gt"  # gt, gte, lt, lte
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
    return {"id": rule.id, "name": rule.name, "message": "Alert rule created successfully"}

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
        raise HTTPException(status_code=404, detail="Incident not found")

    inc.status = "ACKNOWLEDGED"
    inc.acknowledged_at = datetime.now(timezone.utc)
    inc.acknowledged_by_user_id = user.id
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
