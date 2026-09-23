import gzip
import json
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.rbac import validate_app_ingest_key
from app.models import Application, RUMEvent, RUMSession, ErrorGroup, ErrorEvent
from app.services.fingerprint import generate_error_fingerprint, normalize_error_message

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/rum")
async def ingest_rum_events(
    request: Request,
    app: Application = Depends(validate_app_ingest_key),
    db: AsyncSession = Depends(get_db)
):
    """
    High-throughput batch RUM ingestion endpoint.
    Accepts JSON or gzip-compressed payloads from browser SDK.
    """
    try:
        body_bytes = await request.body()
        if not body_bytes:
            return {"status": "ok", "events_processed": 0}

        # Handle gzip decompression
        if request.headers.get("content-encoding") == "gzip":
            try:
                decompressed = gzip.decompress(body_bytes)
                payload = json.loads(decompressed.decode("utf-8"))
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to decompress gzip body: {str(e)}")
        else:
            payload = json.loads(body_bytes.decode("utf-8"))

        events_data = payload if isinstance(payload, list) else payload.get("events", [payload])
        if not events_data:
            return {"status": "ok", "events_processed": 0}

        now = datetime.now(timezone.utc)
        session_updates = {}
        rum_records = []
        error_records = []

        for item in events_data:
            session_id = item.get("session_id", "anonymous-session")
            event_type = item.get("event_type", "page_view")
            
            # Session tracking
            if session_id not in session_updates:
                session_updates[session_id] = {
                    "user_agent": item.get("user_agent"),
                    "browser": item.get("browser"),
                    "os": item.get("os"),
                    "device": item.get("device"),
                    "page_views": 0,
                    "errors": 0
                }
            if event_type in ["page_view", "route_change"]:
                session_updates[session_id]["page_views"] += 1
            if event_type == "error":
                session_updates[session_id]["errors"] += 1

            # RUM Event record
            ev = RUMEvent(
                application_id=app.id,
                session_id=session_id,
                event_type=event_type,
                url=item.get("url", ""),
                route=item.get("route", "/"),
                duration=float(item.get("duration", 0.0)) if item.get("duration") is not None else None,
                status_code=int(item.get("status_code")) if item.get("status_code") is not None else None,
                lcp=float(item.get("lcp")) if item.get("lcp") is not None else None,
                inp=float(item.get("inp")) if item.get("inp") is not None else None,
                cls=float(item.get("cls")) if item.get("cls") is not None else None,
                ttfb=float(item.get("ttfb")) if item.get("ttfb") is not None else None,
                fcp=float(item.get("fcp")) if item.get("fcp") is not None else None,
                fid=float(item.get("fid")) if item.get("fid") is not None else None,
                trace_id=item.get("trace_id"),
                span_id=item.get("span_id"),
                metadata_json=item.get("metadata", {}),
                created_at=now
            )
            rum_records.append(ev)

            # Auto-handle error events
            if event_type == "error":
                err_type = item.get("error_type", "JavaScriptError")
                err_msg = item.get("message", "Unknown error")
                raw_stack = item.get("stack", "")
                fingerprint = generate_error_fingerprint(err_type, err_msg, raw_stack)
                
                error_records.append({
                    "fingerprint": fingerprint,
                    "error_type": err_type,
                    "message": err_msg,
                    "raw_stack": raw_stack,
                    "session_id": session_id,
                    "trace_id": item.get("trace_id"),
                    "url": item.get("url"),
                    "route": item.get("route"),
                    "browser": item.get("browser"),
                    "os": item.get("os"),
                    "device": item.get("device"),
                    "release": item.get("release_version", "1.0.0"),
                    "breadcrumbs": item.get("breadcrumbs", [])
                })

        # Save RUM events
        db.add_all(rum_records)
        await db.flush()

        # Update / Insert Sessions
        for sess_id, sdata in session_updates.items():
            sess_res = await db.execute(
                select(RUMSession).where(
                    RUMSession.application_id == app.id,
                    RUMSession.session_id == sess_id
                )
            )
            sess = sess_res.scalar_one_or_none()
            if sess:
                sess.last_active_at = now
                sess.page_views_count += sdata["page_views"]
                sess.errors_count += sdata["errors"]
                sess_start = sess.started_at.replace(tzinfo=timezone.utc) if sess.started_at.tzinfo is None else sess.started_at
                sess.duration_seconds = max(0.0, (now - sess_start).total_seconds())
            else:
                sess = RUMSession(
                    application_id=app.id,
                    session_id=sess_id,
                    user_agent=sdata["user_agent"],
                    browser=sdata["browser"],
                    os=sdata["os"],
                    device=sdata["device"],
                    started_at=now,
                    last_active_at=now,
                    page_views_count=sdata["page_views"],
                    errors_count=sdata["errors"],
                    duration_seconds=0.0
                )
                db.add(sess)

        # Process Errors & Grouping
        for err in error_records:
            eg_res = await db.execute(
                select(ErrorGroup).where(
                    ErrorGroup.application_id == app.id,
                    ErrorGroup.fingerprint == err["fingerprint"]
                )
            )
            eg = eg_res.scalar_one_or_none()
            if eg:
                eg.last_seen = now
                eg.occurrence_count += 1
                eg.last_release = err["release"]
                group_id = eg.id
            else:
                eg = ErrorGroup(
                    application_id=app.id,
                    fingerprint=err["fingerprint"],
                    error_type=err["error_type"],
                    message_template=normalize_error_message(err["message"]),
                    status="unhandled",
                    first_seen=now,
                    last_seen=now,
                    occurrence_count=1,
                    affected_users_count=1,
                    last_release=err["release"]
                )
                db.add(eg)
                await db.flush()
                group_id = eg.id

            # Add Error Event
            ev_err = ErrorEvent(
                error_group_id=group_id,
                application_id=app.id,
                session_id=err["session_id"],
                trace_id=err["trace_id"],
                error_type=err["error_type"],
                message=err["message"],
                raw_stack=err["raw_stack"],
                url=err["url"],
                route=err["route"],
                browser=err["browser"],
                os=err["os"],
                device=err["device"],
                release_version=err["release"],
                breadcrumbs_json=err["breadcrumbs"],
                created_at=now
            )
            db.add(ev_err)

        await db.commit()
        return {"status": "ok", "events_processed": len(rum_records)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process ingestion payload: {str(e)}")
