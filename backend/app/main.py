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
    from app.models import User, Team, Membership, Application, AlertRule, SyntheticCheck, NotificationChannel
    from app.core.security import hash_password, generate_ingest_key
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.email == "admin@ricozappmon.io"))
        if not res.scalar_one_or_none():
            logger.info("Seeding default admin user, demo team, and sample applications...")
            user = User(
                email="admin@ricozappmon.io",
                name="Admin User",
                hashed_password=hash_password("admin123"),
                is_superuser=True
            )
            db.add(user)
            await db.flush()

            team = Team(name="Engineering Core", slug="engineering-core")
            db.add(team)
            await db.flush()

            membership = Membership(user_id=user.id, team_id=team.id, role="admin")
            db.add(membership)

            # Ingest keys
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

            # Notification channel
            channel = NotificationChannel(
                team_id=team.id,
                name="DevOps Slack & Email Webhook",
                channel_type="webhook",
                config_json={"webhook_url": "http://localhost:8000/api/v1/stats/health"}
            )
            db.add(channel)

            # Default Alert Rules
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

            # Default Synthetic Checks
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
            await db.commit()
            logger.info(f"Default App Ingest Key: {raw_key}")

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
