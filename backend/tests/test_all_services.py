import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from app.core.security import hash_password, verify_password, generate_ingest_key, hash_ingest_key, create_access_token, decode_access_token
from app.services.fingerprint import generate_error_fingerprint, normalize_error_message, normalize_stack_frame
from app.services.symbolicator import SourceMapSymbolicator, decode_vlq_mappings, parse_stack_frames
from app.services.trace_analyzer import trace_analyzer
from app.services.alert_evaluator import AlertEvaluator
from app.models import AlertRule

# 1. Security Tests
def test_password_hashing():
    pwd = "superSecretPassword123!"
    hashed = hash_password(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongPassword", hashed) is False

def test_jwt_tokens():
    user_id = "test-user-12345"
    token = create_access_token(user_id, expires_delta=timedelta(minutes=15))
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == user_id

def test_ingest_key_generation():
    raw_key, hashed_key = generate_ingest_key()
    assert raw_key.startswith("rz_live_")
    assert len(hashed_key) == 64
    assert hash_ingest_key(raw_key) == hashed_key

# 2. Fingerprint Tests
def test_error_normalization():
    msg1 = "User with id 12345 not found on cluster 0xabcdef1234567890"
    msg2 = "User with id 99999 not found on cluster 0x1122334455667788"
    assert normalize_error_message(msg1) == normalize_error_message(msg2)
    assert "<NUM>" in normalize_error_message(msg1)
    assert "<HASH>" in normalize_error_message(msg1)

def test_error_fingerprint_grouping():
    fp1 = generate_error_fingerprint("TypeError", "Cannot read property 'name' of undefined at user 456", "at handleUser (app.js:45:12)")
    fp2 = generate_error_fingerprint("TypeError", "Cannot read property 'name' of undefined at user 890", "at handleUser (app.js:45:12)")
    assert fp1 == fp2

# 3. Source Map & Symbolication Tests
def test_source_map_vlq_decoding():
    # Simple valid VLQ mapping string: "AAAA;AACA"
    decoded = decode_vlq_mappings("AAAA;AACA")
    assert len(decoded) == 2
    assert decoded[0][0][0] == 0

def test_stack_frame_parsing():
    stack = "Error: Fail\n    at fetchData (http://localhost:5173/src/api.ts:25:10)\n    at onClick (http://localhost:5173/src/Button.tsx:12:4)"
    frames = parse_stack_frames(stack)
    assert len(frames) == 2
    assert frames[0]["function"] == "fetchData"
    assert frames[0]["lineno"] == 25
    assert frames[0]["colno"] == 10

# 4. Trace Waterfall & Service Map Tests
def test_trace_waterfall_assembly():
    now = datetime.now(timezone.utc)
    spans = [
        {
            "span_id": "root-1",
            "parent_span_id": None,
            "service_name": "gateway",
            "name": "GET /api/checkout",
            "kind": "server",
            "start_time": now,
            "end_time": now + timedelta(milliseconds=120),
            "duration_ms": 120.0,
            "status_code": "OK"
        },
        {
            "span_id": "child-db",
            "parent_span_id": "root-1",
            "service_name": "postgres",
            "name": "SELECT * FROM orders",
            "kind": "client",
            "start_time": now + timedelta(milliseconds=20),
            "end_time": now + timedelta(milliseconds=110),
            "duration_ms": 90.0,
            "status_code": "OK"
        }
    ]
    waterfall = trace_analyzer.assemble_waterfall(spans)
    assert waterfall["span_count"] == 2
    assert len(waterfall["root_spans"]) == 1
    assert len(waterfall["root_spans"][0]["children"]) == 1
    assert waterfall["root_cause_hint"] is not None
    assert waterfall["root_cause_hint"]["type"] == "BOTTLENECK"
    assert waterfall["root_cause_hint"]["service_name"] == "postgres"

def test_service_map_generation():
    spans = [
        {"span_id": "1", "parent_span_id": None, "service_name": "frontend", "name": "click", "kind": "client", "duration_ms": 10.0, "status_code": "OK"},
        {"span_id": "2", "parent_span_id": "1", "service_name": "api-gateway", "name": "POST /order", "kind": "server", "duration_ms": 50.0, "status_code": "OK"},
        {"span_id": "3", "parent_span_id": "2", "service_name": "auth-service", "name": "verify", "kind": "server", "duration_ms": 20.0, "status_code": "OK"}
    ]
    smap = trace_analyzer.compute_service_map(spans)
    node_ids = {n["id"] for n in smap["nodes"]}
    assert "frontend" in node_ids
    assert "api-gateway" in node_ids
    assert "auth-service" in node_ids
    assert len(smap["edges"]) == 2

# 5. Alert Evaluator State Machine Test
def test_alert_condition_checks():
    evaluator = AlertEvaluator()
    assert evaluator._check_breach(5.5, "gt", 5.0) is True
    assert evaluator._check_breach(4.5, "gt", 5.0) is False
    assert evaluator._check_breach(100.0, "gte", 100.0) is True
    assert evaluator._check_breach(99.0, "lt", 100.0) is True
