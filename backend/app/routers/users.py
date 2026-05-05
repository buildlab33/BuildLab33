# backend/app/routers/users.py
"""User management endpoints — Super Admin only."""
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.database import get_supabase
from app.schemas.users import (
    ChangeRoleRequest,
    DirectCreateRequest,
    EmailInviteRequest,
    GenerateInviteCodeRequest,
    UserListItem,
)
from app.security import current_user, hash_password
from app.utils.email import send_email
from app.utils.password import PasswordError, validate_password
from app.utils.tokens import generate_token, hash_token

router = APIRouter(prefix="/users", tags=["users"])


def require_super_admin(user: dict) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


@router.get("", response_model=list[UserListItem])
async def list_users(user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    sb = get_supabase()
    res = sb.table("users").select("id, name, email, username, role, archived, created_at").order("created_at").execute()
    result = []
    for u in (res.data or []):
        status = "disabled" if u.get("archived") else "active"
        result.append(UserListItem(
            id=u["id"], name=u["name"], email=u["email"],
            username=u.get("username"), role=u["role"],
            status=status, created_at=u["created_at"],
        ))
    # Include pending invites
    inv = sb.table("invite_tokens").select("*").eq("used", False).execute()
    now = datetime.now(timezone.utc).isoformat()
    for i in (inv.data or []):
        if i["expires_at"] > now:
            result.append(UserListItem(
                id=i["id"], name="Pending", email=i["email"],
                username=None, role=i["role"],
                status="invited", created_at=i["created_at"],
            ))
    return result


@router.post("/invite")
async def invite_user(body: EmailInviteRequest, user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    sb = get_supabase()
    if sb.table("users").select("id").eq("email", str(body.email)).execute().data:
        raise HTTPException(status_code=400, detail="Email already registered")
    token = generate_token()
    token_hash = hash_token(token)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    sb.table("invite_tokens").insert({
        "email": str(body.email), "token_hash": token_hash,
        "role": body.role, "expires_at": expires_at,
    }).execute()
    invite_url = f"http://localhost:3000/accept-invite?token={token}"
    await send_email(
        to=str(body.email),
        subject="You've been invited to COP Platform",
        html=f"<p>You've been invited. Click to set up your account:</p><p><a href='{invite_url}'>{invite_url}</a></p><p>This link expires in 24 hours.</p>",
    )
    return {"message": "Invite sent"}


@router.post("/create")
async def create_user(body: DirectCreateRequest, user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    try:
        validate_password(body.password)
    except PasswordError as e:
        raise HTTPException(status_code=400, detail=str(e))
    sb = get_supabase()
    if sb.table("users").select("id").eq("email", str(body.email)).execute().data:
        raise HTTPException(status_code=400, detail="Email already registered")
    if sb.table("users").select("id").eq("username", body.username).execute().data:
        raise HTTPException(status_code=400, detail="Username already taken")
    sb.table("users").insert({
        "name": body.name, "email": str(body.email), "username": body.username,
        "password_hash": hash_password(body.password), "role": body.role, "theme": "midnight",
    }).execute()
    return {"message": "User created"}


@router.post("/invite-code")
async def generate_invite_code(body: GenerateInviteCodeRequest, user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    code = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    expires_at = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    sb = get_supabase()
    sb.table("invite_codes").insert({
        "code": code, "role": body.role,
        "expires_at": expires_at, "created_by": user["sub"],
    }).execute()
    return {"code": code, "expires_at": expires_at, "role": body.role}


@router.patch("/{user_id}/role")
async def change_role(user_id: str, body: ChangeRoleRequest, user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    sb = get_supabase()
    res = sb.table("users").select("id, role").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    if res.data[0]["role"] == "super_admin":
        raise HTTPException(status_code=403, detail="Cannot change super admin role")
    sb.table("users").update({"role": body.role}).eq("id", user_id).execute()
    return {"message": "Role updated"}


@router.patch("/{user_id}/disable")
async def disable_user(user_id: str, user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    if user_id == user["sub"]:
        raise HTTPException(status_code=400, detail="Cannot disable your own account")
    sb = get_supabase()
    sb.table("users").update({"archived": True}).eq("id", user_id).execute()
    return {"message": "User disabled"}


@router.post("/{user_id}/resend-invite")
async def resend_invite(user_id: str, user: Annotated[dict, Depends(current_user)]):
    require_super_admin(user)
    sb = get_supabase()
    res = sb.table("invite_tokens").select("*").eq("id", user_id).eq("used", False).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Invite not found")
    invite = res.data[0]
    token = generate_token()
    token_hash = hash_token(token)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
    sb.table("invite_tokens").update({"token_hash": token_hash, "expires_at": expires_at}).eq("id", user_id).execute()
    invite_url = f"http://localhost:3000/accept-invite?token={token}"
    await send_email(
        to=invite["email"],
        subject="Your COP Platform invite (resent)",
        html=f"<p>Your invite has been resent. Click to set up your account:</p><p><a href='{invite_url}'>{invite_url}</a></p>",
    )
    return {"message": "Invite resent"}
