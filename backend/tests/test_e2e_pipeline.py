import pytest
import httpx
import uuid
import time
from datetime import datetime, timezone, timedelta

BASE_URL = "http://localhost:8000/api/v1"

@pytest.mark.asyncio
async def test_full_platform_pipeline_e2e():
    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Health check
        res = await client.get(f"{BASE_URL}/stats/health")
        assert res.status_code == 200
        assert res.json()["status"] == "healthy"

        # 2. Authentication Login
        login_res = await client.post(f"{BASE_URL}/auth/login", json={
            "email": "admin@ricozappmon.io",
            "password": "admin123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        auth_headers = {"Authorization": f"Bearer {token}"}

        # 3. Fetch Applications
        apps_res = await client.get(f"{BASE_URL}/applications", headers=auth_headers)
        assert apps_res.status_code == 200
        apps = apps_res.json()
        assert len(apps) > 0
        app_id = apps[0]["id"]

        # Create a test app to obtain raw ingest key
        new_app_res = await client.post(f"{BASE_URL}/applications", headers=auth_headers, json={
            "team_id": apps[0]["team_id"],
            "name": "Integration Test E2E App",
            "tier": "agent",
            "environment": "staging",
            "allowed_origins": ["*"]
        })
        assert new_app_res.status_code == 200
        test_app = new_app_res.json()
        ingest_key = test_app["raw_ingest_key"]
        test_app_id = test_app["id"]

        # 4. Ingest Batch of RUM Events (Web vitals, route changes, fetch, errors)
        session_id = f"sess_e2e_{uuid.uuid4().hex[:12]}"
        trace_id = uuid.uuid4().hex
        span_id = uuid.uuid4().hex[:16]

        rum_payload = {
            "events": [
                {
                    "session_id": session_id,
                    "event_type": "page_view",
                    "url": "https://test.app/products",
                    "route": "/products",
                    "duration": 280.5,
                    "browser": "Chrome",
                    "os": "Windows",
                    "device": "Desktop",
                    "lcp": 1250.0,
                    "inp": 45.0,
                    "cls": 0.02,
                    "ttfb": 140.0,
                    "fcp": 420.0
                },
                {
                    "session_id": session_id,
                    "event_type": "fetch",
                    "url": "https://test.app/api/cart",
                    "route": "/products",
                    "duration": 65.0,
                    "status_code": 200,
                    "trace_id": trace_id,
                    "span_id": span_id
                },
                {
                    "session_id": session_id,
                    "event_type": "error",
                    "error_type": "TypeError",
                    "message": "Cannot read properties of undefined (reading 'items') on user 4921",
                    "stack": "Error: Cannot read properties of undefined\n    at renderCart (http://localhost:5173/src/Cart.tsx:42:15)\n    at onClick (http://localhost:5173/src/Button.tsx:18:4)",
                    "url": "https://test.app/cart",
                    "route": "/cart",
                    "browser": "Chrome",
                    "os": "Windows",
                    "device": "Desktop",
                    "release_version": "1.0.0"
                }
            ]
        }

        rum_ingest_res = await client.post(
            f"{BASE_URL}/ingest/rum",
            headers={"X-Ricoz-Key": ingest_key},
            json=rum_payload
        )
        assert rum_ingest_res.status_code == 200
        assert rum_ingest_res.json()["events_processed"] == 3

        # 5. Verify RUM Analytics
        ov_res = await client.get(f"{BASE_URL}/rum/overview?app_id={test_app_id}", headers=auth_headers)
        assert ov_res.status_code == 200
        ov_data = ov_res.json()
        assert ov_data["total_sessions"] >= 1
        assert ov_data["total_page_views"] >= 1

        vitals_res = await client.get(f"{BASE_URL}/rum/web-vitals?app_id={test_app_id}", headers=auth_headers)
        assert vitals_res.status_code == 200
        vitals_data = vitals_res.json()
        assert vitals_data["lcp"]["value"] is not None
        assert vitals_data["lcp"]["rating"] == "GOOD"

        # 6. Ingest Distributed Trace Spans (OTLP / Custom format)
        now_iso = datetime.now(timezone.utc).isoformat()
        later_iso = (datetime.now(timezone.utc) + timedelta(milliseconds=150)).isoformat()
        
        trace_payload = [
            {
                "trace_id": trace_id,
                "span_id": "span-gateway-1",
                "parent_span_id": None,
                "service_name": "node-gateway",
                "name": "POST /api/checkout",
                "kind": "server",
                "start_time": now_iso,
                "end_time": later_iso,
                "duration_ms": 150.0,
                "status_code": "OK",
                "attributes": {"http.status_code": 200, "http.method": "POST"}
            },
            {
                "trace_id": trace_id,
                "span_id": "span-auth-2",
                "parent_span_id": "span-gateway-1",
                "service_name": "python-auth",
                "name": "POST /auth/verify",
                "kind": "server",
                "start_time": now_iso,
                "end_time": later_iso,
                "duration_ms": 110.0,
                "status_code": "OK",
                "attributes": {"auth.user_id": "usr_998877"}
            },
            {
                "trace_id": trace_id,
                "span_id": "span-db-3",
                "parent_span_id": "span-auth-2",
                "service_name": "postgres-db",
                "name": "SELECT * FROM users WHERE id = $1",
                "kind": "client",
                "start_time": now_iso,
                "end_time": later_iso,
                "duration_ms": 95.0,
                "status_code": "OK",
                "attributes": {"db.statement": "SELECT * FROM users"}
            }
        ]

        trace_ingest_res = await client.post(
            f"{BASE_URL}/ingest/traces",
            headers={"X-Ricoz-Key": ingest_key},
            json=trace_payload
        )
        assert trace_ingest_res.status_code == 200
        assert trace_ingest_res.json()["spans_processed"] == 3

        # 7. Verify Trace Waterfall & Root Cause Bottleneck
        wf_res = await client.get(f"{BASE_URL}/traces/waterfall/{trace_id}", headers=auth_headers)
        assert wf_res.status_code == 200
        wf_data = wf_res.json()
        assert wf_data["span_count"] == 3
        assert len(wf_data["root_spans"]) == 1
        assert wf_data["root_cause_hint"] is not None
        assert wf_data["root_cause_hint"]["service_name"] == "postgres-db"

        # 8. Verify Error Groups & Status Update
        err_res = await client.get(f"{BASE_URL}/errors/groups?app_id={test_app_id}", headers=auth_headers)
        assert err_res.status_code == 200
        err_groups = err_res.json()
        assert len(err_groups) >= 1
        group_id = err_groups[0]["id"]
        assert "<NUM>" in err_groups[0]["message"]  # Dynamic parameter stripped

        # Update status
        patch_res = await client.patch(
            f"{BASE_URL}/errors/groups/{group_id}/status",
            headers=auth_headers,
            json={"status": "resolved"}
        )
        assert patch_res.status_code == 200
        assert patch_res.json()["status"] == "resolved"

        # 9. Test Synthetic Checks & Live Execution
        syn_checks_res = await client.get(f"{BASE_URL}/synthetics/checks", headers=auth_headers)
        assert syn_checks_res.status_code == 200
        checks = syn_checks_res.json()
        assert len(checks) >= 1
        first_check_id = checks[0]["id"]

        test_check_res = await client.post(
            f"{BASE_URL}/synthetics/checks/{first_check_id}/test-now",
            headers=auth_headers
        )
        assert test_check_res.status_code == 200
        result = test_check_res.json()["result"]
        assert result["status"] == "SUCCESS"
        assert result["total_duration_ms"] > 0
        assert result["dns_duration_ms"] > 0

        # 10. Platform Dogfooding Stats
        dogfood_res = await client.get(f"{BASE_URL}/stats/dogfood", headers=auth_headers)
        assert dogfood_res.status_code == 200
        df_data = dogfood_res.json()
        assert df_data["telemetry_counts"]["rum_events_ingested"] >= 3
        assert df_data["telemetry_counts"]["spans_recorded"] >= 3
