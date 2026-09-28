from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import json

from app.core.database import get_db
from app.core.rbac import validate_app_ingest_key
from app.models import Application, Span, TraceSummary

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/traces")
async def ingest_traces(
    request: Request,
    app: Application = Depends(validate_app_ingest_key),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts OpenTelemetry spans (OTLP HTTP JSON or standard batch format).
    Extracts root spans, builds trace summaries, and saves spans for waterfall visualization.
    """
    try:
        body = await request.json()
        spans_data = []

        # Parse standard OTLP resourceSpans or flat spans array
        if "resourceSpans" in body:
            for rs in body["resourceSpans"]:
                res_attrs = {}
                for a in rs.get("resource", {}).get("attributes", []):
                    res_attrs[a.get("key")] = a.get("value", {}).get("stringValue", "")
                service_name = res_attrs.get("service.name", "unknown-service")

                for ss in rs.get("scopeSpans", []):
                    for sp in ss.get("spans", []):
                        start_nano = int(sp.get("startTimeUnixNano", 0))
                        end_nano = int(sp.get("endTimeUnixNano", 0))
                        start_time = datetime.fromtimestamp(start_nano / 1e9, tz=timezone.utc)
                        end_time = datetime.fromtimestamp(end_nano / 1e9, tz=timezone.utc)
                        duration_ms = max(0.1, (end_nano - start_nano) / 1e6)

                        attrs = {}
                        for a in sp.get("attributes", []):
                            val = a.get("value", {})
                            attrs[a.get("key")] = val.get("stringValue") or val.get("intValue") or val.get("boolValue") or str(val)

                        status_obj = sp.get("status", {})
                        status_code = "ERROR" if status_obj.get("code") == 2 else "OK"

                        spans_data.append({
                            "trace_id": sp.get("traceId"),
                            "span_id": sp.get("spanId"),
                            "parent_span_id": sp.get("parentSpanId") or None,
                            "service_name": service_name,
                            "name": sp.get("name", "unnamed_span"),
                            "kind": sp.get("kind", "internal"),
                            "start_time": start_time,
                            "end_time": end_time,
                            "duration_ms": round(duration_ms, 2),
                            "status_code": status_code,
                            "status_message": status_obj.get("message"),
                            "attributes": attrs,
                            "events": sp.get("events", []),
                            "resource": res_attrs
                        })
        elif isinstance(body, list):
            # Flat span payload
            for sp in body:
                st = sp.get("start_time")
                et = sp.get("end_time")
                start_time = datetime.fromisoformat(st) if isinstance(st, str) else datetime.now(timezone.utc)
                end_time = datetime.fromisoformat(et) if isinstance(et, str) else datetime.now(timezone.utc)
                dur = float(sp.get("duration_ms", 1.0))

                spans_data.append({
                    "trace_id": sp.get("trace_id"),
                    "span_id": sp.get("span_id"),
                    "parent_span_id": sp.get("parent_span_id"),
                    "service_name": sp.get("service_name", "app-service"),
                    "name": sp.get("name", "operation"),
                    "kind": sp.get("kind", "server"),
                    "start_time": start_time,
                    "end_time": end_time,
                    "duration_ms": dur,
                    "status_code": sp.get("status_code", "OK"),
                    "status_message": sp.get("status_message"),
                    "attributes": sp.get("attributes", {}),
                    "events": sp.get("events", []),
                    "resource": sp.get("resource", {})
                })

        if not spans_data:
            return {"status": "ok", "spans_processed": 0}

        # Save Spans & Update Summaries
        span_records = []
        trace_map = {}

        for sd in spans_data:
            s_obj = Span(
                application_id=app.id,
                trace_id=sd["trace_id"],
                span_id=sd["span_id"],
                parent_span_id=sd["parent_span_id"],
                service_name=sd["service_name"],
                name=sd["name"],
                kind=str(sd["kind"]),
                start_time=sd["start_time"],
                end_time=sd["end_time"],
                duration_ms=sd["duration_ms"],
                status_code=sd["status_code"],
                status_message=sd["status_message"],
                attributes_json=sd["attributes"],
                events_json=sd["events"],
                resource_json=sd["resource"]
            )
            span_records.append(s_obj)

            t_id = sd["trace_id"]
            if t_id not in trace_map:
                trace_map[t_id] = {
                    "spans": [],
                    "has_error": False,
                    "min_start": sd["start_time"],
                    "max_end": sd["end_time"],
                    "root_service": sd["service_name"],
                    "root_name": sd["name"],
                    "root_span_id": sd["span_id"]
                }
            
            trace_map[t_id]["spans"].append(sd)
            if sd["status_code"] == "ERROR":
                trace_map[t_id]["has_error"] = True
            if sd["parent_span_id"] is None:
                trace_map[t_id]["root_service"] = sd["service_name"]
                trace_map[t_id]["root_name"] = sd["name"]
                trace_map[t_id]["root_span_id"] = sd["span_id"]

        db.add_all(span_records)
        await db.flush()

        # Update / Insert TraceSummaries
        for t_id, tdata in trace_map.items():
            ts_res = await db.execute(select(TraceSummary).where(TraceSummary.trace_id == t_id))
            ts = ts_res.scalar_one_or_none()
            total_dur = max(0.1, sum(s["duration_ms"] for s in tdata["spans"]))

            if ts:
                ts.span_count += len(tdata["spans"])
                if tdata["has_error"]:
                    ts.has_error = True
                    ts.error_count += 1
            else:
                ts = TraceSummary(
                    trace_id=t_id,
                    application_id=app.id,
                    root_service=tdata["root_service"],
                    root_name=tdata["root_name"],
                    start_time=tdata["min_start"],
                    duration_ms=round(total_dur, 2),
                    span_count=len(tdata["spans"]),
                    error_count=1 if tdata["has_error"] else 0,
                    has_error=tdata["has_error"]
                )
                db.add(ts)

        await db.commit()
        return {"status": "ok", "spans_processed": len(span_records)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to ingest traces: {str(e)}")
