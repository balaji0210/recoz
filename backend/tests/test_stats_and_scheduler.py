import pytest
import httpx
from app.main import app
from app.workers.scheduler import scheduler

@pytest.mark.asyncio
async def test_stats_timeseries_and_rollups():
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver") as client:
            # 1. Health check
            health_res = await client.get("/api/v1/stats/health")
            assert health_res.status_code == 200
            assert health_res.json()["status"] == "healthy"

            # 2. Dogfood stats
            df_res = await client.get("/api/v1/stats/dogfood")
            assert df_res.status_code == 200
            assert "telemetry_counts" in df_res.json()

            # 3. Time-bucketed timeseries rollups (24h)
            ts_res = await client.get("/api/v1/stats/timeseries?time_range=24h")
            assert ts_res.status_code == 200
            ts_data = ts_res.json()
            assert ts_data["time_range"] == "24h"
            assert "buckets" in ts_data
            assert len(ts_data["buckets"]) > 0
            first_b = ts_data["buckets"][0]
            assert "timestamp" in first_b
            assert "page_views" in first_b
            assert "spans_count" in first_b
            assert "web_vitals" in first_b

            # Test 1h timeseries rollups
            ts_1h = await client.get("/api/v1/stats/timeseries?time_range=1h")
            assert ts_1h.status_code == 200
            assert ts_1h.json()["interval_seconds"] == 120

            # 4. Overview KPIs & Apdex
            summary_res = await client.get("/api/v1/stats/summary?time_range=24h")
            assert summary_res.status_code == 200
            sum_data = summary_res.json()
            assert "apdex_score" in sum_data
            assert "load_time" in sum_data
            assert "synthetics_uptime_percent" in sum_data

            # 5. Scheduler status
            sched_res = await client.get("/api/v1/stats/scheduler")
            assert sched_res.status_code == 200
            sched_data = sched_res.json()
            assert "jobs" in sched_data
            assert len(sched_data["jobs"]) == 2
            assert any(j["job_id"] == "synthetic_checks" for j in sched_data["jobs"])
            assert any(j["job_id"] == "alert_evaluation" for j in sched_data["jobs"])

            # 6. Trigger scheduler job on-demand
            run_res = await client.post("/api/v1/stats/scheduler/jobs/alert_evaluation/run")
            assert run_res.status_code == 200
            assert run_res.json()["status"] == "success"

            # Bad job trigger
            bad_run = await client.post("/api/v1/stats/scheduler/jobs/unknown_job/run")
            assert bad_run.status_code == 400
