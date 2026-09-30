import pytest
import httpx
import uuid
from app.main import app
from app.models import Application, Team, AlertRule, NotificationChannel

@pytest.mark.asyncio
async def test_alerts_rule_patch_and_channel_crud():
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            # Login as admin
            login_res = await client.post("/api/v1/auth/login", json={
                "email": "admin@ricozappmon.io",
                "password": "admin123"
            })
            assert login_res.status_code == 200
            token = login_res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Fetch apps & team
            apps_res = await client.get("/api/v1/applications", headers=headers)
            assert apps_res.status_code == 200
            apps = apps_res.json()
            app_id = apps[0]["id"]
            team_id = apps[0]["team_id"]

            # 2. Create an alert rule
            create_rule_res = await client.post(
                "/api/v1/alerts/rules",
                headers=headers,
                json={
                    "application_id": app_id,
                    "team_id": team_id,
                    "name": "Test High P95 Latency Alert",
                    "metric_type": "p95_latency",
                    "operator": "gt",
                    "threshold": 2500.0,
                    "duration_seconds": 120,
                    "severity": "warning"
                }
            )
            assert create_rule_res.status_code == 200
            created_rule = create_rule_res.json()
            rule_id = created_rule["id"]

            # Verify GET list of rules
            rules_res = await client.get(f"/api/v1/alerts/rules?app_id={app_id}", headers=headers)
            assert rules_res.status_code == 200
            rules = rules_res.json()
            assert any(r["id"] == rule_id for r in rules)

            # 3. Test PATCH /api/v1/alerts/rules/{rule_id}
            patch_res = await client.patch(
                f"/api/v1/alerts/rules/{rule_id}",
                headers=headers,
                json={
                    "name": "Updated High Latency Rule",
                    "threshold": 3200.0,
                    "duration_seconds": 240,
                    "severity": "critical",
                    "is_active": False
                }
            )
            assert patch_res.status_code == 200
            updated_rule = patch_res.json()["rule"]
            assert updated_rule["name"] == "Updated High Latency Rule"
            assert updated_rule["threshold"] == 3200.0
            assert updated_rule["duration_seconds"] == 240
            assert updated_rule["severity"] == "critical"
            assert updated_rule["is_active"] is False

            # Verify GET /api/v1/alerts/rules/{rule_id}
            get_res = await client.get(f"/api/v1/alerts/rules/{rule_id}", headers=headers)
            assert get_res.status_code == 200
            assert get_res.json()["name"] == "Updated High Latency Rule"

            # Test PATCH validation error
            bad_patch = await client.patch(
                f"/api/v1/alerts/rules/{rule_id}",
                headers=headers,
                json={"severity": "super_mega_critical"}
            )
            assert bad_patch.status_code == 400

            # 4. Notification Channels CRUD
            # Create a Slack notification channel
            ch_create_res = await client.post(
                "/api/v1/alerts/channels",
                headers=headers,
                json={
                    "team_id": team_id,
                    "name": "Production Ops Slack Channel",
                    "channel_type": "slack",
                    "config_json": {
                        "webhook_url": "http://localhost:8000/api/v1/stats/health"
                    },
                    "is_active": True
                }
            )
            assert ch_create_res.status_code == 200
            created_ch = ch_create_res.json()["channel"]
            assert created_ch["name"] == "Production Ops Slack Channel"
            assert created_ch["channel_type"] == "slack"
            ch_id = created_ch["id"]

            # List channels
            list_res = await client.get(f"/api/v1/alerts/channels?team_id={team_id}", headers=headers)
            assert list_res.status_code == 200
            channels = list_res.json()
            assert any(c["id"] == ch_id for c in channels)

            # Get single channel
            single_res = await client.get(f"/api/v1/alerts/channels/{ch_id}", headers=headers)
            assert single_res.status_code == 200
            assert single_res.json()["id"] == ch_id

            # Update channel (PATCH)
            update_ch_res = await client.patch(
                f"/api/v1/alerts/channels/{ch_id}",
                headers=headers,
                json={
                    "name": "Production Critical Alerts Webhook",
                    "channel_type": "webhook",
                    "is_active": True
                }
            )
            assert update_ch_res.status_code == 200
            assert update_ch_res.json()["channel"]["name"] == "Production Critical Alerts Webhook"
            assert update_ch_res.json()["channel"]["channel_type"] == "webhook"

            # Test dispatch channel probe
            test_probe_res = await client.post(
                f"/api/v1/alerts/channels/{ch_id}/test",
                headers=headers,
                json={"message": "Integration test probe notification"}
            )
            assert test_probe_res.status_code == 200
            assert test_probe_res.json()["channel_name"] == "Production Critical Alerts Webhook"

            # Delete channel
            del_res = await client.delete(f"/api/v1/alerts/channels/{ch_id}", headers=headers)
            assert del_res.status_code == 200

            # Verify deleted (404)
            del_verify = await client.get(f"/api/v1/alerts/channels/{ch_id}", headers=headers)
            assert del_verify.status_code == 404

            # Clean up rule
            del_rule_res = await client.delete(f"/api/v1/alerts/rules/{rule_id}", headers=headers)
            assert del_rule_res.status_code == 200

@pytest.mark.asyncio
async def test_incidents_acknowledge_and_resolve():
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            inc_res = await client.get("/api/v1/alerts/incidents")
            assert inc_res.status_code == 200
            incidents = inc_res.json()
            assert len(incidents) >= 1

            target_id = incidents[0]["id"]

            # 1. Acknowledge incident: Active/OPEN -> ACKNOWLEDGED
            ack_res = await client.post(f"/api/v1/alerts/incidents/{target_id}/acknowledge")
            assert ack_res.status_code == 200
            assert ack_res.json()["status"] == "ACKNOWLEDGED"

            # 2. Guard: Cannot resolve directly from ACKNOWLEDGED without investigation
            premature_res = await client.post(f"/api/v1/alerts/incidents/{target_id}/resolve")
            assert premature_res.status_code == 400
            assert "Cannot resolve incident directly" in premature_res.json()["detail"]

            # 3. Transition to INVESTIGATING
            inv_res = await client.post(f"/api/v1/alerts/incidents/{target_id}/investigate")
            assert inv_res.status_code == 200
            assert inv_res.json()["status"] == "INVESTIGATING"

            # 4. Automated verification check probe
            verify_res = await client.get(f"/api/v1/alerts/incidents/{target_id}/verify")
            assert verify_res.status_code == 200
            verification = verify_res.json()
            assert "is_breached" in verification
            assert "is_healthy" in verification
            assert "message" in verification

            # 5. Resolve with verified resolution notes and/or force_override
            res_res = await client.post(
                f"/api/v1/alerts/incidents/{target_id}/resolve",
                json={
                    "resolution_notes": "Identified high latency root cause; restarted downstream worker pod and refreshed cache.",
                    "force_override": True
                }
            )
            assert res_res.status_code == 200
            assert res_res.json()["status"] == "RESOLVED"
            assert "resolution_notes" in res_res.json()


