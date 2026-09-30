import os
import time
import math
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

try:
    import psutil
except ImportError:
    psutil = None

from app.core.database import get_db
from app.core.rbac import get_current_active_user
from app.models import (
    Application, RUMEvent, RUMSession, ErrorEvent, ErrorGroup,
    Span, Incident, SyntheticCheck, SyntheticResult
)
from app.workers.scheduler import scheduler

router = APIRouter(prefix="/stats", tags=["Platform & Observability Stats"])

START_TIME = time.time()

def parse_time_range(time_range: str) -> tuple[datetime, int]:
    """
    Parses time_range string into (start_datetime, bucket_seconds).
    Supported formats: 1h, 6h, 12h, 24h, 7d, 30d
    """
    now = datetime.now(timezone.utc)
    tr = time_range.lower().strip()
    if tr == "1h":
        return now - timedelta(hours=1), 120  # 2 min buckets (30 points)
    elif tr == "6h":
        return now - timedelta(hours=6), 600  # 10 min buckets (36 points)
    elif tr == "12h":
        return now - timedelta(hours=12), 1200 # 20 min buckets (36 points)
    elif tr == "24h":
        return now - timedelta(hours=24), 3600 # 1 hour buckets (24 points)
    elif tr == "7d":
        return now - timedelta(days=7), 14400 # 4 hour buckets (42 points)
    elif tr == "30d":
        return now - timedelta(days=30), 86400 # 1 day buckets (30 points)
    else:
        # Default to 24h
        return now - timedelta(hours=24), 3600

def calculate_percentile(values: List[float], percentile: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return round(sorted_vals[int(k)], 2)
    d0 = sorted_vals[int(f)] * (c - k)
    d1 = sorted_vals[int(c)] * (k - f)
    return round(d0 + d1, 2)

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "RicozAppMon Core Backend",
        "uptime_seconds": round(time.time() - START_TIME, 1)
    }

@router.get("/dogfood")
async def get_dogfood_metrics(db: AsyncSession = Depends(get_db)):
    """
    Self-monitoring metrics: CPU, memory, database entity counts, throughput.
    """
    process = psutil.Process(os.getpid()) if psutil and hasattr(os, "getpid") else None
    mem_info = process.memory_info() if process else None

    # Entity counts
    apps_cnt = (await db.execute(select(func.count(Application.id)))).scalar() or 0
    rum_cnt = (await db.execute(select(func.count(RUMEvent.id)))).scalar() or 0
    err_cnt = (await db.execute(select(func.count(ErrorEvent.id)))).scalar() or 0
    span_cnt = (await db.execute(select(func.count(Span.id)))).scalar() or 0
    inc_cnt = (await db.execute(select(func.count(Incident.id)))).scalar() or 0
    syn_cnt = (await db.execute(select(func.count(SyntheticCheck.id)))).scalar() or 0

    return {
        "system": {
            "uptime_seconds": round(time.time() - START_TIME, 1),
            "memory_usage_mb": round((mem_info.rss / (1024 * 1024)), 2) if mem_info else 45.0,
            "cpu_percent": process.cpu_percent() if process else 1.5
        },
        "telemetry_counts": {
            "monitored_applications": apps_cnt,
            "rum_events_ingested": rum_cnt,
            "error_events_recorded": err_cnt,
            "spans_recorded": span_cnt,
            "active_synthetic_checks": syn_cnt,
            "incidents_total": inc_cnt
        }
    }

@router.post("/simulate-traffic")
async def simulate_live_traffic(
    app_id: Optional[str] = "demo-ecommerce-app-id",
    db: AsyncSession = Depends(get_db)
):
    """
    Dispatches simulated real-user monitoring sessions, spans, and metrics
    to populate dashboard telemetry in real time.
    """
    import random
    import uuid
    from datetime import datetime, timezone, timedelta

    # Verify target app
    res = await db.execute(select(Application).where(Application.id == app_id))
    app = res.scalar_one_or_none()
    if not app:
        res = await db.execute(select(Application).limit(1))
        app = res.scalars().first()
    if not app:
        raise HTTPException(status_code=404, detail="No application found to simulate traffic for")

    now = datetime.now(timezone.utc)
    sess_id = f"sess_{uuid.uuid4().hex[:12]}"
    new_sess = RUMSession(
        id=sess_id,
        application_id=app.id,
        session_id=sess_id,
        user_id=f"usr_{random.randint(100, 999)}",
        browser=random.choice(["Chrome 122", "Safari 17", "Firefox 124", "Edge 122"]),
        os=random.choice(["Windows 11", "macOS Sonoma", "iOS 17", "Android 14"]),
        device=random.choice(["Desktop", "Desktop", "Mobile", "Tablet"]),
        started_at=now - timedelta(minutes=random.randint(5, 30)),
        last_active_at=now
    )
    db.add(new_sess)

    routes = ["/", "/products", "/products/item-492", "/cart", "/checkout", "/account/orders"]
    events_count = 0
    for _ in range(random.randint(8, 15)):
        route = random.choice(routes)
        ev_time = now - timedelta(minutes=random.randint(0, 15))
        duration = random.uniform(150.0, 950.0)
        ev = RUMEvent(
            id=f"ev_{uuid.uuid4().hex[:12]}",
            application_id=app.id,
            session_id=sess_id,
            event_type="page_view",
            url=f"https://shopsphere.io{route}",
            route=route,
            duration=duration,
            lcp=random.uniform(800.0, 2200.0),
            inp=random.uniform(40.0, 160.0),
            cls=random.uniform(0.01, 0.06),
            ttfb=random.uniform(70.0, 280.0),
            fcp=random.uniform(250.0, 800.0),
            created_at=ev_time
        )
        db.add(ev)
        events_count += 1

    # Add distributed trace spans
    trace_id = uuid.uuid4().hex
    root_span = Span(
        id=f"sp_{uuid.uuid4().hex[:12]}",
        trace_id=trace_id,
        span_id=uuid.uuid4().hex[:16],
        application_id=app.id,
        service_name="frontend-web",
        name="User Action: Page Navigation",
        kind="client",
        start_time=now - timedelta(seconds=2),
        end_time=now,
        duration_ms=210.5,
        status_code="OK",
        attributes_json={"http.route": "/checkout", "http.status": 200},
        created_at=now
    )
    gw_span = Span(
        id=f"sp_{uuid.uuid4().hex[:12]}",
        trace_id=trace_id,
        span_id=uuid.uuid4().hex[:16],
        parent_span_id=root_span.span_id,
        application_id=app.id,
        service_name="node-gateway",
        name="POST /api/checkout",
        kind="server",
        start_time=now - timedelta(seconds=1, milliseconds=800),
        end_time=now,
        duration_ms=48.2,
        status_code="OK",
        attributes_json={"http.route": "/api/checkout", "http.status": 200},
        created_at=now
    )
    auth_span = Span(
        id=f"sp_{uuid.uuid4().hex[:12]}",
        trace_id=trace_id,
        span_id=uuid.uuid4().hex[:16],
        parent_span_id=gw_span.span_id,
        application_id=app.id,
        service_name="python-auth",
        name="POST /v1/auth/verify",
        kind="server",
        start_time=now - timedelta(seconds=1, milliseconds=400),
        end_time=now,
        duration_ms=32.4,
        status_code="OK",
        attributes_json={"http.route": "/v1/auth/verify", "http.status": 200},
        created_at=now
    )
    db_span = Span(
        id=f"sp_{uuid.uuid4().hex[:12]}",
        trace_id=trace_id,
        span_id=uuid.uuid4().hex[:16],
        parent_span_id=auth_span.span_id,
        application_id=app.id,
        service_name="postgres-db",
        name="SELECT users, orders",
        kind="database",
        start_time=now - timedelta(seconds=1),
        end_time=now,
        duration_ms=12.8,
        status_code="OK",
        attributes_json={"db.system": "postgresql", "db.statement": "SELECT * FROM users"},
        created_at=now
    )
    db.add_all([root_span, gw_span, auth_span, db_span])

    await db.commit()

    return {
        "status": "success",
        "app_id": app.id,
        "session_id": sess_id,
        "events_created": events_count,
        "spans_created": 4,
        "message": f"Generated {events_count} telemetry events and distributed trace {trace_id[:8]} across 4 microservices"
    }

@router.get("/timeseries")
async def get_timeseries_rollups(
    app_id: Optional[str] = None,
    time_range: str = Query("24h", description="1h, 6h, 12h, 24h, 7d, 30d"),
    db: AsyncSession = Depends(get_db)
):
    """
    Time-bucketed rollup queries for dashboard charts:
    Returns correlated RUM, APM Spans, JS Errors, and Synthetic Uptime metrics
    aggregated over discrete time intervals.
    """
    now = datetime.now(timezone.utc)
    start_dt, bucket_sec = parse_time_range(time_range)

    # Generate discrete bucket boundaries
    buckets = []
    cursor = start_dt
    while cursor < now:
        b_end = min(cursor + timedelta(seconds=bucket_sec), now)
        buckets.append({
            "timestamp": cursor.isoformat(),
            "end_timestamp": b_end.isoformat(),
            "label": cursor.strftime("%H:%M" if bucket_sec < 86400 else "%b %d"),
            "start_dt": cursor,
            "end_dt": b_end,
            # Metrics to populate
            "page_views": 0,
            "rum_avg_duration_ms": 0.0,
            "rum_p95_duration_ms": 0.0,
            "web_vitals": {"avg_lcp": None, "avg_inp": None, "avg_cls": None, "avg_ttfb": None},
            "spans_count": 0,
            "spans_avg_latency_ms": 0.0,
            "spans_p95_latency_ms": 0.0,
            "spans_error_count": 0,
            "spans_error_rate_percent": 0.0,
            "error_events_count": 0,
            "synthetics_uptime_percent": 100.0,
            "synthetics_avg_ms": 0.0
        })
        cursor = b_end

    # Fetch RUM Events within window
    rum_q = select(
        RUMEvent.created_at, RUMEvent.duration, RUMEvent.lcp, RUMEvent.inp,
        RUMEvent.cls, RUMEvent.ttfb, RUMEvent.event_type
    ).where(RUMEvent.created_at >= start_dt)
    if app_id:
        rum_q = rum_q.where(RUMEvent.application_id == app_id)
    rum_res = await db.execute(rum_q)
    rum_rows = rum_res.all()

    # Fetch Spans within window
    span_q = select(
        Span.start_time, Span.duration_ms, Span.status_code
    ).where(Span.start_time >= start_dt)
    if app_id:
        span_q = span_q.where(Span.application_id == app_id)
    span_res = await db.execute(span_q)
    span_rows = span_res.all()

    # Fetch Error Events within window
    err_q = select(ErrorEvent.created_at).where(ErrorEvent.created_at >= start_dt)
    if app_id:
        err_q = err_q.where(ErrorEvent.application_id == app_id)
    err_res = await db.execute(err_q)
    err_rows = err_res.all()

    # Fetch Synthetics within window
    syn_q = select(
        SyntheticResult.created_at, SyntheticResult.status, SyntheticResult.total_duration_ms
    ).where(SyntheticResult.created_at >= start_dt)
    syn_res = await db.execute(syn_q)
    syn_rows = syn_res.all()

    # Bin RUM events into buckets
    bucket_durations: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}
    bucket_lcps: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}
    bucket_inps: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}
    bucket_clss: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}
    bucket_ttfbs: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}

    for row in rum_rows:
        row_dt = row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at
        # Find corresponding bucket index
        diff_sec = (row_dt - start_dt).total_seconds()
        idx = int(diff_sec // bucket_sec)
        if 0 <= idx < len(buckets):
            buckets[idx]["page_views"] += 1
            if row.duration is not None:
                bucket_durations[idx].append(row.duration)
            if row.lcp is not None:
                bucket_lcps[idx].append(row.lcp)
            if row.inp is not None:
                bucket_inps[idx].append(row.inp)
            if row.cls is not None:
                bucket_clss[idx].append(row.cls)
            if row.ttfb is not None:
                bucket_ttfbs[idx].append(row.ttfb)

    # Bin Spans
    bucket_span_durations: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}
    for row in span_rows:
        row_dt = row.start_time.replace(tzinfo=timezone.utc) if row.start_time.tzinfo is None else row.start_time
        diff_sec = (row_dt - start_dt).total_seconds()
        idx = int(diff_sec // bucket_sec)
        if 0 <= idx < len(buckets):
            buckets[idx]["spans_count"] += 1
            bucket_span_durations[idx].append(row.duration_ms)
            if row.status_code == "ERROR":
                buckets[idx]["spans_error_count"] += 1

    # Bin Errors
    for row in err_rows:
        row_dt = row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at
        diff_sec = (row_dt - start_dt).total_seconds()
        idx = int(diff_sec // bucket_sec)
        if 0 <= idx < len(buckets):
            buckets[idx]["error_events_count"] += 1

    # Bin Synthetics
    bucket_syn_durations: Dict[int, List[float]] = {i: [] for i in range(len(buckets))}
    bucket_syn_success: Dict[int, List[bool]] = {i: [] for i in range(len(buckets))}
    for row in syn_rows:
        row_dt = row.created_at.replace(tzinfo=timezone.utc) if row.created_at.tzinfo is None else row.created_at
        diff_sec = (row_dt - start_dt).total_seconds()
        idx = int(diff_sec // bucket_sec)
        if 0 <= idx < len(buckets):
            bucket_syn_durations[idx].append(row.total_duration_ms)
            bucket_syn_success[idx].append(row.status == "SUCCESS")

    # Aggregate and calculate statistics per bucket
    output_buckets = []
    for i, b in enumerate(buckets):
        durs = bucket_durations[i]
        span_durs = bucket_span_durations[i]
        lcps = bucket_lcps[i]
        inps = bucket_inps[i]
        clss = bucket_clss[i]
        ttfbs = bucket_ttfbs[i]
        syn_durs = bucket_syn_durations[i]
        syn_succ = bucket_syn_success[i]

        avg_dur = round(sum(durs) / len(durs), 2) if durs else 0.0
        p95_dur = calculate_percentile(durs, 95.0)

        span_avg = round(sum(span_durs) / len(span_durs), 2) if span_durs else 0.0
        span_p95 = calculate_percentile(span_durs, 95.0)
        span_err_rate = round((b["spans_error_count"] / b["spans_count"]) * 100.0, 2) if b["spans_count"] > 0 else 0.0

        syn_uptime = round((sum(1 for s in syn_succ if s) / len(syn_succ)) * 100.0, 2) if syn_succ else 100.0
        syn_avg = round(sum(syn_durs) / len(syn_durs), 2) if syn_durs else 0.0

        output_buckets.append({
            "timestamp": b["timestamp"],
            "end_timestamp": b["end_timestamp"],
            "label": b["label"],
            "page_views": b["page_views"],
            "rum_avg_duration_ms": avg_dur,
            "rum_p95_duration_ms": p95_dur,
            "web_vitals": {
                "avg_lcp": round(sum(lcps) / len(lcps), 2) if lcps else None,
                "avg_inp": round(sum(inps) / len(inps), 2) if inps else None,
                "avg_cls": round(sum(clss) / len(clss), 4) if clss else None,
                "avg_ttfb": round(sum(ttfbs) / len(ttfbs), 2) if ttfbs else None,
            },
            "spans_count": b["spans_count"],
            "spans_avg_latency_ms": span_avg,
            "spans_p95_latency_ms": span_p95,
            "spans_error_count": b["spans_error_count"],
            "spans_error_rate_percent": span_err_rate,
            "error_events_count": b["error_events_count"],
            "synthetics_uptime_percent": syn_uptime,
            "synthetics_avg_ms": syn_avg
        })

    return {
        "app_id": app_id,
        "time_range": time_range,
        "interval_seconds": bucket_sec,
        "total_buckets": len(output_buckets),
        "buckets": output_buckets
    }

@router.get("/summary")
async def get_overview_kpis(
    app_id: Optional[str] = None,
    time_range: str = Query("24h"),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns high-level APM KPIs (active sessions, p75/p95 latency, Apdex, error rate, synthetics uptime).
    """
    start_dt, _ = parse_time_range(time_range)

    # Active sessions
    sess_q = select(func.count(RUMSession.id)).where(RUMSession.started_at >= start_dt)
    if app_id:
        sess_q = sess_q.where(RUMSession.application_id == app_id)
    total_sessions = (await db.execute(sess_q)).scalar() or 0

    # RUM durations for load time & Apdex (target T = 500ms)
    dur_q = select(RUMEvent.duration).where(
        RUMEvent.created_at >= start_dt,
        RUMEvent.duration.is_not(None)
    )
    if app_id:
        dur_q = dur_q.where(RUMEvent.application_id == app_id)
    dur_res = await db.execute(dur_q)
    durations = [r[0] for r in dur_res.all()]

    p50 = calculate_percentile(durations, 50.0)
    p75 = calculate_percentile(durations, 75.0)
    p95 = calculate_percentile(durations, 95.0)
    avg_load = round(sum(durations) / len(durations), 2) if durations else 0.0

    # Apdex computation: T = 500ms (satisfied <= 500ms, tolerating 500ms-2000ms, frustrated > 2000ms)
    satisfied = sum(1 for d in durations if d <= 500.0)
    tolerating = sum(1 for d in durations if 500.0 < d <= 2000.0)
    total_samples = len(durations)
    apdex = round((satisfied + (tolerating / 2.0)) / total_samples, 2) if total_samples > 0 else 0.95

    # Errors & Error rate
    err_q = select(func.count(ErrorEvent.id)).where(ErrorEvent.created_at >= start_dt)
    if app_id:
        err_q = err_q.where(ErrorEvent.application_id == app_id)
    total_errors = (await db.execute(err_q)).scalar() or 0
    total_requests = total_samples or 1
    error_rate = round((total_errors / (total_requests + total_errors)) * 100.0, 2)

    # Synthetic Uptime SLA
    syn_q = select(SyntheticResult.status).where(SyntheticResult.created_at >= start_dt)
    syn_res = await db.execute(syn_q)
    syn_statuses = syn_res.scalars().all()
    uptime_percent = 100.0
    if syn_statuses:
        success_cnt = sum(1 for s in syn_statuses if s == "SUCCESS")
        uptime_percent = round((success_cnt / len(syn_statuses)) * 100.0, 2)

    return {
        "time_range": time_range,
        "total_sessions": total_sessions,
        "load_time": {
            "avg_ms": avg_load,
            "p50_ms": p50,
            "p75_ms": p75,
            "p95_ms": p95
        },
        "apdex_score": apdex,
        "total_errors": total_errors,
        "error_rate_percent": error_rate,
        "synthetics_uptime_percent": uptime_percent
    }

@router.get("/scheduler")
async def get_scheduler_status():
    """
    Returns background evaluator & synthetic runner scheduler status and job execution statistics.
    """
    return scheduler.get_status()

@router.post("/scheduler/jobs/{job_id}/run")
async def trigger_scheduler_job(job_id: str):
    """
    Triggers immediate execution of a scheduler job (synthetic_checks or alert_evaluation).
    """
    try:
        result = await scheduler.run_job_now(job_id)
        return {"status": "success", "message": f"Job '{job_id}' executed successfully", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Job execution failed: {str(e)}")
