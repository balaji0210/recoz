from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.core.rbac import get_current_active_user, TeamPermission
from app.models import User, Team, Membership, NotificationChannel
from app.services.notification_manager import notification_dispatcher

router = APIRouter(prefix="/teams", tags=["Teams"])

class CreateTeamRequest(BaseModel):
    name: str

class AddMemberRequest(BaseModel):
    email: str
    role: str = "engineer"  # admin, engineer, viewer

class CreateChannelRequest(BaseModel):
    name: str
    channel_type: str  # email, webhook, sms, pagerduty, jira, servicenow
    config_json: Dict[str, Any]

class TestChannelRequest(BaseModel):
    channel_type: str
    config_json: Dict[str, Any]

@router.get("")
async def list_user_teams(user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(Team, Membership.role).join(Membership, Team.id == Membership.team_id).where(Membership.user_id == user.id)
    )
    return [{"id": team.id, "name": team.name, "slug": team.slug, "role": role} for team, role in res.all()]

@router.post("")
async def create_team(req: CreateTeamRequest, user: User = Depends(get_current_active_user), db: AsyncSession = Depends(get_db)):
    team_slug = req.name.lower().replace(" ", "-").replace("_", "-")
    team = Team(name=req.name, slug=f"{team_slug}-{user.id[:6]}")
    db.add(team)
    await db.flush()

    membership = Membership(user_id=user.id, team_id=team.id, role="admin")
    db.add(membership)
    await db.commit()

    return {"id": team.id, "name": team.name, "slug": team.slug, "role": "admin"}

@router.get("/{team_id}/members")
async def list_team_members(
    team_id: str,
    membership: Membership = Depends(TeamPermission(["admin", "engineer", "viewer"])),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(
        select(Membership, User).join(User, Membership.user_id == User.id).where(Membership.team_id == team_id)
    )
    return [
        {
            "id": mem.id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": mem.role,
            "created_at": mem.created_at
        }
        for mem, user in res.all()
    ]

@router.post("/{team_id}/members")
async def add_team_member(
    team_id: str,
    req: AddMemberRequest,
    membership: Membership = Depends(TeamPermission(["admin"])),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(User).where(User.email == req.email))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User with this email was not found")

    # Check if already a member
    mem_res = await db.execute(select(Membership).where(Membership.team_id == team_id, Membership.user_id == user.id))
    if mem_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member of this team")

    new_mem = Membership(user_id=user.id, team_id=team_id, role=req.role)
    db.add(new_mem)
    await db.commit()
    return {"message": "Member added successfully", "user_id": user.id, "role": req.role}

# Notification Channels
@router.get("/{team_id}/channels")
async def list_notification_channels(
    team_id: str,
    membership: Membership = Depends(TeamPermission(["admin", "engineer", "viewer"])),
    db: AsyncSession = Depends(get_db)
):
    res = await db.execute(select(NotificationChannel).where(NotificationChannel.team_id == team_id))
    channels = res.scalars().all()
    return [
        {
            "id": ch.id,
            "name": ch.name,
            "channel_type": ch.channel_type,
            "config_json": ch.config_json,
            "is_active": ch.is_active,
            "created_at": ch.created_at
        }
        for ch in channels
    ]

@router.post("/{team_id}/channels")
async def create_notification_channel(
    team_id: str,
    req: CreateChannelRequest,
    membership: Membership = Depends(TeamPermission(["admin", "engineer"])),
    db: AsyncSession = Depends(get_db)
):
    channel = NotificationChannel(
        team_id=team_id,
        name=req.name,
        channel_type=req.channel_type,
        config_json=req.config_json,
        is_active=True
    )
    db.add(channel)
    await db.commit()
    return {"id": channel.id, "name": channel.name, "channel_type": channel.channel_type}

@router.post("/{team_id}/channels/test")
async def test_notification_channel(
    team_id: str,
    req: TestChannelRequest,
    membership: Membership = Depends(TeamPermission(["admin", "engineer"])),
):
    sample_incident = {
        "id": "test-incident-uuid",
        "title": "Test Alert from RicozAppMon",
        "severity": "WARNING",
        "status": "FIRING",
        "current_value": 4.5,
        "threshold": 3.0,
        "rule_name": "Sample Latency Alert"
    }
    success, err = await notification_dispatcher.send_notification(
        req.channel_type,
        req.config_json,
        sample_incident
    )
    if not success:
        raise HTTPException(status_code=400, detail=f"Channel test failed: {err}")
    return {"status": "success", "message": f"Test notification sent to {req.channel_type} successfully"}
