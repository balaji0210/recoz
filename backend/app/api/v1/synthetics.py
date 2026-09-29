from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.rbac import get_current_active_user
from app.models import SyntheticCheck, SyntheticStep, SyntheticResult, Application, Team
from app.services.synthetic_runner import synthetic_runner

router = APIRouter(prefix="/synthetics", tags=["Synthetic Monitoring"])

class StepSchema(BaseModel):
    step_order: int
    name: str
    method: str = "GET"
    url: str
    headers_json: Optional[Dict[str, str]] = {}
    body: Optional[str] = None
    extract_variable: Optional[str] = None
    assertion_json: Optional[Dict[str, Any]] = {}

class CreateCheckRequest(BaseModel):
    application_id: str
    team_id: Optional[str] = None
    name: str
    check_type: str = "http"  # http, multi_step
    url: str
    method: str = "GET"
    headers_json: Optional[Dict[str, str]] = {}
    body: Optional[str] = None
    expected_status: int = 200
    json_assertion: Optional[str] = None
    latency_sla_ms: float = 1000.0
    interval_seconds: int = 60
    timeout_seconds: int = 15
    steps: Optional[List[StepSchema]] = None

@router.get("/checks")
async def list_synthetic_checks(
    app_id: Optional[str] = None,
    team_id: Optional[str] = None,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(SyntheticCheck)
    if app_id:
        query = query.where(SyntheticCheck.application_id == app_id)
    if team_id:
        query = query.where(SyntheticCheck.team_id == team_id)

    res = await db.execute(query.order_by(SyntheticCheck.created_at.desc()))
    checks = res.scalars().all()

    return [
        {
            "id": c.id,
            "application_id": c.application_id,
            "name": c.name,
            "check_type": c.check_type,
            "url": c.url,
            "method": c.method,
            "status": c.status,
            "uptime_percent": c.uptime_percent,
            "latency_sla_ms": c.latency_sla_ms,
            "interval_seconds": c.interval_seconds,
            "last_run_at": c.last_run_at,
            "is_active": c.is_active,
            "created_at": c.created_at
        }
        for c in checks
    ]

@router.post("/checks")
async def create_synthetic_check(
    req: CreateCheckRequest,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    target_team_id = req.team_id
    if not target_team_id:
        app_res = await db.execute(select(Application).where(Application.id == req.application_id))
        app = app_res.scalar_one_or_none()
        if app and app.team_id:
            target_team_id = app.team_id
        else:
            team_res = await db.execute(select(Team).limit(1))
            t = team_res.scalars().first()
            target_team_id = t.id if t else "default-team"

    check = SyntheticCheck(
        application_id=req.application_id,
        team_id=target_team_id,
        name=req.name,
        check_type=req.check_type,
        url=req.url,
        method=req.method,
        headers_json=req.headers_json or {},
        body=req.body,
        expected_status=req.expected_status,
        json_assertion=req.json_assertion,
        latency_sla_ms=req.latency_sla_ms,
        interval_seconds=req.interval_seconds,
        timeout_seconds=req.timeout_seconds,
        status="HEALTHY",
        uptime_percent=100.0,
        is_active=True
    )
    db.add(check)
    await db.flush()

    if req.steps:
        for s in req.steps:
            step_record = SyntheticStep(
                check_id=check.id,
                step_order=s.step_order,
                name=s.name,
                method=s.method,
                url=s.url,
                headers_json=s.headers_json or {},
                body=s.body,
                extract_variable=s.extract_variable,
                assertion_json=s.assertion_json or {}
            )
            db.add(step_record)

    await db.commit()
    return {"id": check.id, "name": check.name, "message": "Synthetic check created successfully"}

@router.delete("/checks/{check_id}")
async def delete_synthetic_check(
    check_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(SyntheticCheck).where(SyntheticCheck.id == check_id))
    c = res.scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Synthetic check not found")

    await db.delete(c)
    await db.commit()
    return {"message": "Synthetic check deleted"}

@router.get("/checks/{check_id}/results")
async def get_check_results(
    check_id: str,
    limit: int = 50,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(SyntheticResult)
        .where(SyntheticResult.check_id == check_id)
        .order_by(desc(SyntheticResult.created_at))
        .limit(limit)
    )
    results = res.scalars().all()
    return [
        {
            "id": r.id,
            "status": r.status,
            "status_code": r.status_code,
            "total_duration_ms": r.total_duration_ms,
            "dns_duration_ms": r.dns_duration_ms,
            "tcp_duration_ms": r.tcp_duration_ms,
            "tls_duration_ms": r.tls_duration_ms,
            "ttfb_duration_ms": r.ttfb_duration_ms,
            "failure_reason": r.failure_reason,
            "response_snippet": r.response_snippet,
            "created_at": r.created_at
        }
        for r in results
    ]

@router.post("/checks/{check_id}/test-now")
async def test_check_now(
    check_id: str,
    user=Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Triggers an instant execution of the check and returns real-time metrics.
    """
    res = await db.execute(select(SyntheticCheck).where(SyntheticCheck.id == check_id))
    check = res.scalar_one_or_none()
    if not check:
        demo_url = "http://127.0.0.1:8000/api/v1/stats/health" if "1" in check_id else (
            "https://httpbin.org/get" if "2" in check_id else "http://127.0.0.1:8000/api/v1/stats/health"
        )
        check_dict = {
            "url": demo_url,
            "method": "GET",
            "headers_json": {},
            "body": None,
            "expected_status": 200,
            "json_assertion": None,
            "latency_sla_ms": 500.0,
            "timeout_seconds": 10,
            "check_type": "http"
        }
        result = await synthetic_runner.execute_check(check_dict, [])
        return {
            "check_name": f"Synthetic Probe ({check_id})",
            "result": result
        }

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
                "extract_variable": s.extract_variable
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

    result = await synthetic_runner.execute_check(check_dict, steps)
    return {
        "check_name": check.name,
        "result": result
    }
