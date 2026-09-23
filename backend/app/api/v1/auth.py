from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.rbac import get_current_active_user
from app.models import User, Team, Membership

router = APIRouter(prefix="/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    team_name: Optional[str] = "Default Team"

class LoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    is_superuser: bool
    teams: List[dict]

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    res = await db.execute(select(User).where(User.email == req.email))
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        email=req.email,
        name=req.name,
        hashed_password=hash_password(req.password),
        is_superuser=False
    )
    db.add(user)
    await db.flush()

    # Create default team
    team_slug = req.team_name.lower().replace(" ", "-").replace("_", "-")
    team = Team(name=req.team_name, slug=f"{team_slug}-{user.id[:6]}")
    db.add(team)
    await db.flush()

    # Create admin membership
    membership = Membership(user_id=user.id, team_id=team.id, role="admin")
    db.add(membership)
    await db.commit()

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_superuser=user.is_superuser,
            teams=[{"id": team.id, "name": team.name, "role": "admin"}]
        )
    )

@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.email == req.email))
    user = res.scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    # Fetch user memberships
    mem_res = await db.execute(
        select(Membership, Team).join(Team, Membership.team_id == Team.id).where(Membership.user_id == user.id)
    )
    teams_data = [{"id": team.id, "name": team.name, "role": mem.role} for mem, team in mem_res.all()]

    token = create_access_token(user.id)
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            is_superuser=user.is_superuser,
            teams=teams_data
        )
    )

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    mem_res = await db.execute(
        select(Membership, Team).join(Team, Membership.team_id == Team.id).where(Membership.user_id == user.id)
    )
    teams_data = [{"id": team.id, "name": team.name, "role": mem.role} for mem, team in mem_res.all()]

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        is_superuser=user.is_superuser,
        teams=teams_data
    )
