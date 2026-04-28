"""Authentication endpoints — signup, login, refresh, me."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.database import get_supabase
from app.schemas.auth import (
    LoginRequest, RefreshRequest, SignupRequest, TokenPair, UserPublic,
)
from app.security import (
    create_access_token, create_refresh_token, current_user,
    decode_token, hash_password, verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    sb = get_supabase()
    existing = sb.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
    insert = sb.table("users").insert({
        "email": body.email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "user",
        "theme": "midnight",
    }).execute()
    if not insert.data:
        raise HTTPException(status_code=500, detail="Failed to create user")
    user = insert.data[0]
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )


@router.post("/login", response_model=TokenPair)
async def login(body: LoginRequest):
    sb = get_supabase()
    res = sb.table("users").select("*").eq("email", body.email).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = res.data[0]
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("archived"):
        raise HTTPException(status_code=403, detail="Account disabled")
    sb.table("audit_log").insert({
        "user_id": user["id"],
        "action": "login",
        "detail": "Signed in",
    }).execute()
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest):
    payload = decode_token(body.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Wrong token type")
    sb = get_supabase()
    res = sb.table("users").select("id, role, archived").eq("id", payload["sub"]).limit(1).execute()
    if not res.data or res.data[0].get("archived"):
        raise HTTPException(status_code=401, detail="User not found")
    user = res.data[0]
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )


@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[dict, Depends(current_user)]):
    sb = get_supabase()
    res = sb.table("users").select("id, email, name, role, theme").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**res.data[0])
