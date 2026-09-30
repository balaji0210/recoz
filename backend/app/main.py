import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.auth import router as auth_router
from app.api.v1.teams import router as teams_router
from app.api.v1.applications import router as apps_router
from app.api.v1.ingest_rum import router as ingest_rum_router
from app.api.v1.ingest_traces import router as ingest_traces_router
from app.api.v1.rum import router as rum_router
from app.api.v1.errors import router as errors_router
from app.api.v1.sourcemaps import router as sourcemaps_router
from app.api.v1.traces import router as traces_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.synthetics import router as synthetics_router
from app.api.v1.stats import router as stats_router
from app.workers.scheduler import scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ricoz.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing RicozAppMon Database...")
    await init_db()
    
    # Auto-seed default admin and demo app if empty
    from app.core.database import AsyncSessionLocal
    from app.models import User, Team, Membership, Application, AlertRule, SyntheticCheck, NotificationChannel, Incident, ErrorGroup
    from app.core.security import hash_password, generate_ingest_key
    from sqlalchemy import select
    from datetime import datetime, timezone, timedelta
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == "admin@ricozappmon.io"))
        user = res.scalar_one_or_none()
        if not user:
            logger.info("Seeding default admin user, demo team, and sample applications...")
            user = User(
                email="admin@ricozappmon.io",
                name="Admin User",
                hashed_password=hash_password("admin123"),
                is_superuser=True
            )
            db.add(user)
            await db.flush()

        res_team = await db.execute(select(Team).where(Team.slug == "engineering-core"))
        team = res_team.scalar_one_or_none()
        if not team:
            team = Team(name="Engineering Core", slug="engineering-core")
            db.add(team)
            await db.flush()

        res_mem = await db.execute(select(Membership).where(Membership.user_id == user.id, Membership.team_id == team.id))
        if not res_mem.scalar_one_or_none():
            membership = Membership(user_id=user.id, team_id=team.id, role="admin")
            db.add(membership)

        # Ingest keys & Application
        res_app = await db.execute(select(Application).where(Application.id == "demo-ecommerce-app-id"))
        demo_app = res_app.scalar_one_or_none()
        if not demo_app:
            raw_key, hashed_key = generate_ingest_key()
            demo_app = Application(
                id="demo-ecommerce-app-id",
                team_id=team.id,
                name="ShopSphere E-Commerce Web",
                slug="shopsphere-web",
                tier="agent",
                environment="production",
                ingest_key_hash=hashed_key,
                ingest_key_prefix=raw_key[:12] + "...",
                allowed_origins=["*"]
            )
            db.add(demo_app)
            await db.flush()
            logger.info(f"Default App Ingest Key: {raw_key}")

        # Notification channel
        res_ch = await db.execute(select(NotificationChannel).where(NotificationChannel.team_id == team.id))
        if not res_ch.scalars().first():
            channel = NotificationChannel(
                team_id=team.id,
                name="DevOps Slack & Email Webhook",
                channel_type="webhook",
                config_json={"webhook_url": "http://localhost:8000/api/v1/stats/health"}
            )
            db.add(channel)

        # Default Alert Rules
        res_rules = await db.execute(select(AlertRule).where(AlertRule.application_id == demo_app.id))
        rules = res_rules.scalars().all()
        if not rules:
            r1 = AlertRule(
                application_id=demo_app.id,
                team_id=team.id,
                name="High JS Error Rate (> 5%)",
                metric_type="error_rate",
                operator="gt",
                threshold=5.0,
                duration_seconds=60,
                severity="critical",
                state="OK"
            )
            r2 = AlertRule(
                application_id=demo_app.id,
                team_id=team.id,
                name="Slow P95 Page Load (> 2500ms)",
                metric_type="p95_latency",
                operator="gt",
                threshold=2500.0,
                duration_seconds=120,
                severity="warning",
                state="OK"
            )
            db.add_all([r1, r2])
            await db.flush()
        else:
            r1 = rules[0]
            r2 = rules[1] if len(rules) > 1 else rules[0]

        # Default Synthetic Checks
        res_syn = await db.execute(select(SyntheticCheck).where(SyntheticCheck.application_id == demo_app.id))
        if not res_syn.scalars().first():
            s1 = SyntheticCheck(
                application_id=demo_app.id,
                team_id=team.id,
                name="Checkout API Gateway Health",
                check_type="http",
                url="http://localhost:8000/api/v1/stats/health",
                method="GET",
                expected_status=200,
                json_assertion="status=healthy",
                latency_sla_ms=500.0,
                interval_seconds=60
            )
            db.add(s1)

        # Default Incidents
        res_inc = await db.execute(select(Incident).where(Incident.application_id == demo_app.id))
        if not res_inc.scalars().first():
            inc1 = Incident(
                id="inc-1",
                alert_rule_id=r1.id,
                application_id=demo_app.id,
                team_id=team.id,
                dedup_key=f"{r1.id}_init",
                title="Alert: High JS Error Rate breached (6.8% > 5.0%)",
                severity="critical",
                status="OPEN",
                current_value=6.8,
                threshold=5.0,
                triggered_at=datetime.now(timezone.utc) - timedelta(minutes=8)
            )
            inc2 = Incident(
                id="inc-2",
                alert_rule_id=r2.id,
                application_id=demo_app.id,
                team_id=team.id,
                dedup_key=f"{r2.id}_init",
                title="Alert: Slow P95 Page Load breached (2840ms > 2500ms)",
                severity="warning",
                status="RESOLVED",
                current_value=1940.0,
                threshold=2500.0,
                triggered_at=datetime.now(timezone.utc) - timedelta(hours=1),
                resolved_at=datetime.now(timezone.utc) - timedelta(minutes=40)
            )
            db.add_all([inc1, inc2])

        # Default Error Groups
        res_eg = await db.execute(select(ErrorGroup).where(ErrorGroup.application_id == demo_app.id))
        if not res_eg.scalars().first():
            now_dt = datetime.now(timezone.utc)
            eg1 = ErrorGroup(
                id="err-1",
                application_id=demo_app.id,
                fingerprint="a89f21000000",
                error_type="TypeError",
                message_template="Cannot read properties of undefined (reading 'price')",
                status="unhandled",
                occurrence_count=42,
                affected_users_count=19,
                last_release="1.2.4",
                first_seen=now_dt - timedelta(days=1),
                last_seen=now_dt
            )
            eg2 = ErrorGroup(
                id="err-2",
                application_id=demo_app.id,
                fingerprint="4d1290000000",
                error_type="NetworkError",
                message_template="Failed to fetch resource from CDN payment gateway",
                status="unhandled",
                occurrence_count=14,
                affected_users_count=11,
                last_release="1.2.4",
                first_seen=now_dt - timedelta(days=1),
                last_seen=now_dt
            )
            eg3 = ErrorGroup(
                id="err-3",
                application_id=demo_app.id,
                fingerprint="bc4471000000",
                error_type="ReferenceError",
                message_template="StripeCheckoutHandler is not defined",
                status="resolved",
                occurrence_count=8,
                affected_users_count=5,
                last_release="1.2.3",
                first_seen=now_dt - timedelta(days=2),
                last_seen=now_dt - timedelta(days=1)
            )
            db.add_all([eg1, eg2, eg3])

        await db.commit()

    # Start background scheduler
    scheduler.start()
    yield
    # Shutdown
    scheduler.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Observability & Application Performance Monitoring Platform",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
prefix = settings.API_V1_STR
app.include_router(auth_router, prefix=prefix)
app.include_router(teams_router, prefix=prefix)
app.include_router(apps_router, prefix=prefix)
app.include_router(ingest_rum_router, prefix=prefix)
app.include_router(ingest_traces_router, prefix=prefix)
app.include_router(rum_router, prefix=prefix)
app.include_router(errors_router, prefix=prefix)
app.include_router(sourcemaps_router, prefix=prefix)
app.include_router(traces_router, prefix=prefix)
app.include_router(alerts_router, prefix=prefix)
app.include_router(synthetics_router, prefix=prefix)
app.include_router(stats_router, prefix=prefix)

@app.get("/")
async def root():
    return {
        "platform": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs": "/docs",
        "api_v1": settings.API_V1_STR
    }
