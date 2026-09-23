from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.core.database import get_db
from app.core.rbac import get_current_active_user, TeamPermission
from app.core.security import generate_ingest_key
from app.models import User, Application, Membership

router = APIRouter(prefix="/applications", tags=["Applications"])

class CreateAppRequest(BaseModel):
    team_id: str
    name: str
    tier: str = "agent"  # agent, proxy, external
    environment: str = "production"
    allowed_origins: Optional[List[str]] = ["*"]

class UpdateAppRequest(BaseModel):
    name: Optional[str] = None
    tier: Optional[str] = None
    environment: Optional[str] = None
    allowed_origins: Optional[List[str]] = None

@router.get("")
async def list_applications(
    team_id: Optional[str] = None,
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch apps across user's teams
    mem_res = await db.execute(select(Membership.team_id).where(Membership.user_id == user.id))
    user_team_ids = mem_res.scalars().all()

    query = select(Application).where(Application.team_id.in_(user_team_ids), Application.is_active == True)
    if team_id:
        if team_id not in user_team_ids:
            raise HTTPException(status_code=403, detail="You do not have access to this team")
        query = query.where(Application.team_id == team_id)

    res = await db.execute(query.order_by(Application.created_at.desc()))
    apps = res.scalars().all()
    
    return [
        {
            "id": app.id,
            "team_id": app.team_id,
            "name": app.name,
            "slug": app.slug,
            "tier": app.tier,
            "environment": app.environment,
            "ingest_key_prefix": app.ingest_key_prefix,
            "allowed_origins": app.allowed_origins,
            "created_at": app.created_at
        }
        for app in apps
    ]

@router.post("")
async def create_application(
    req: CreateAppRequest,
    membership: Membership = Depends(TeamPermission(["admin", "engineer"])),
    db: AsyncSession = Depends(get_db)
):
    raw_key, hashed_key = generate_ingest_key()
    prefix = raw_key[:12] + "..."
    slug = req.name.lower().replace(" ", "-").replace("_", "-")

    app = Application(
        team_id=req.team_id,
        name=req.name,
        slug=slug,
        tier=req.tier,
        environment=req.environment,
        ingest_key_hash=hashed_key,
        ingest_key_prefix=prefix,
        allowed_origins=req.allowed_origins or ["*"],
        is_active=True
    )
    db.add(app)
    await db.commit()

    # Generate installation snippets
    script_snippet = f"""<!-- RicozAppMon RUM SDK -->
<script
  src="https://cdn.ricozappmon.io/sdk/v1/ricoz-rum.min.js"
  data-app-key="{raw_key}"
  data-endpoint="http://localhost:8000/api/v1/ingest/rum"
  defer>
</script>"""

    npm_snippet = f"""import {{ initRicozRum }} from '@ricoz/rum-sdk';

initRicozRum({{
  appKey: '{raw_key}',
  endpoint: 'http://localhost:8000/api/v1/ingest/rum',
  environment: '{req.environment}',
  enableWebVitals: true,
  enableTracing: true
}});"""

    return {
        "id": app.id,
        "team_id": app.team_id,
        "name": app.name,
        "slug": app.slug,
        "tier": app.tier,
        "environment": app.environment,
        "raw_ingest_key": raw_key,  # Returned only once on creation
        "ingest_key_prefix": prefix,
        "allowed_origins": app.allowed_origins,
        "script_snippet": script_snippet,
        "npm_snippet": npm_snippet
    }

@router.get("/{app_id}")
async def get_application(app_id: str, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Application).where(Application.id == app_id, Application.is_active == True))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    return {
        "id": app.id,
        "team_id": app.team_id,
        "name": app.name,
        "slug": app.slug,
        "tier": app.tier,
        "environment": app.environment,
        "ingest_key_prefix": app.ingest_key_prefix,
        "allowed_origins": app.allowed_origins,
        "created_at": app.created_at
    }

@router.post("/{app_id}/rotate-key")
async def rotate_ingest_key(app_id: str, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Application).where(Application.id == app_id, Application.is_active == True))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    raw_key, hashed_key = generate_ingest_key()
    app.ingest_key_hash = hashed_key
    app.ingest_key_prefix = raw_key[:12] + "..."
    await db.commit()

    return {
        "id": app.id,
        "raw_ingest_key": raw_key,
        "ingest_key_prefix": app.ingest_key_prefix,
        "message": "Ingest key rotated successfully. Update your client SDK configuration."
    }
