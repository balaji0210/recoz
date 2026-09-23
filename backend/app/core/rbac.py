from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import time
from collections import defaultdict

from app.core.database import get_db
from app.core.security import decode_access_token, hash_ingest_key
from app.models import User, Team, Membership, Application

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

# In-memory token bucket rate limiter for ingest endpoints
# (In production, backed by Redis)
_rate_limits = defaultdict(list)

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Extract and validate the currently authenticated user."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

class TeamPermission:
    """Enforces team membership and minimum required role."""
    def __init__(self, allowed_roles: List[str] = ["admin", "engineer", "viewer"]):
        self.allowed_roles = allowed_roles

    async def __call__(
        self,
        team_id: str,
        current_user: User = Depends(get_current_active_user),
        db: AsyncSession = Depends(get_db)
    ) -> Membership:
        if current_user.is_superuser:
            # Superuser bypass
            return Membership(user_id=current_user.id, team_id=team_id, role="admin")

        result = await db.execute(
            select(Membership).where(
                Membership.user_id == current_user.id,
                Membership.team_id == team_id
            )
        )
        membership = result.scalar_one_or_none()
        
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this team"
            )
            
        role_hierarchy = {"admin": 3, "engineer": 2, "viewer": 1}
        user_role_val = role_hierarchy.get(membership.role, 0)
        min_required_val = min(role_hierarchy.get(r, 99) for r in self.allowed_roles)
        
        if user_role_val < min_required_val:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action requires one of roles: {self.allowed_roles}, your role is {membership.role}"
            )
            
        return membership

async def validate_app_ingest_key(
    request: Request,
    x_ricoz_key: Optional[str] = Header(None, alias="X-Ricoz-Key"),
    x_api_key: Optional[str] = Header(None, alias="X-Api-Key"),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> Application:
    """
    Validates ingest API key from headers, verifies origin header against allowed origins,
    and applies in-memory rate limiting.
    """
    raw_key = x_ricoz_key or x_api_key
    if not raw_key and authorization:
        if authorization.startswith("Bearer rz_"):
            raw_key = authorization.replace("Bearer ", "")
        elif authorization.startswith("ApiKey "):
            raw_key = authorization.replace("ApiKey ", "")

    if not raw_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing application ingest key. Provide X-Ricoz-Key header."
        )

    key_hash = hash_ingest_key(raw_key)
    result = await db.execute(select(Application).where(Application.ingest_key_hash == key_hash, Application.is_active == True))
    app = result.scalar_one_or_none()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid application ingest key."
        )

    # Origin verification
    origin = request.headers.get("origin")
    if origin and app.allowed_origins and "*" not in app.allowed_origins:
        allowed = any(allowed_origin in origin for allowed_origin in app.allowed_origins)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Origin {origin} is not allowed for this application."
            )

    # Simple rate limiting: 1200 requests/minute per app
    now = time.time()
    history = _rate_limits[app.id]
    _rate_limits[app.id] = [t for t in history if now - t < 60.0]
    if len(_rate_limits[app.id]) >= 1200:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Ingestion rate limit exceeded for this application."
        )
    _rate_limits[app.id].append(now)

    return app
