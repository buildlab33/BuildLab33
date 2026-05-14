"""Authentication endpoints."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

COOKIE_MAX_AGE_ACCESS = 15 * 60          # 15 minutes
COOKIE_MAX_AGE_REFRESH = 7 * 24 * 60 * 60  # 7 days


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    is_prod = __import__("app.config", fromlist=["get_settings"]).get_settings().app_env == "production"
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=COOKIE_MAX_AGE_ACCESS,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=COOKIE_MAX_AGE_REFRESH,
        httponly=True,
        secure=is_prod,
        samesite="lax",
        path="/api/auth/refresh",
    )

from app.database import get_supabase
from app.schemas.auth import (
    AcceptInviteRequest,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    Setup2FAResponse,
    SignupRequest,
    TokenPair,
    TwoFALoginRequest,
    TwoFAPendingResponse,
    UpdateMeRequest,
    UserPublic,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    current_user,
    decode_token,
    hash_password,
    verify_password,
)
from app.utils.email import send_email
from app.utils.password import PasswordError, validate_password
from app.utils.tokens import generate_token, hash_token
from app.utils.totp import generate_totp_secret, get_totp_uri, verify_totp_code

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Username availability check ──────────────────────────────────────────────

@router.get("/check-username")
@limiter.limit("20/minute")
async def check_username(request: Request, username: str = Query(min_length=3, max_length=30)):
    """Return whether a username is available."""
    sb = get_supabase()
    res = sb.table("users").select("id").eq("username", username.lower()).execute()
    return {"available": len(res.data) == 0}


# ── Login (step 1) ───────────────────────────────────────────────────────────

@router.post("/login")
@limiter.limit("10/minute")
async def login(request: Request, response: Response, body: LoginRequest):
    """Authenticate with username + password. Returns TokenPair, or 2FA pending if enabled."""
    sb = get_supabase()
    res = sb.table("users").select("*").eq("username", body.username.lower()).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user = res.data[0]
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if user.get("archived"):
        raise HTTPException(status_code=403, detail="Account disabled")

    # If 2FA is enabled, return temp token instead of full access
    if user.get("totp_enabled"):
        from app.config import get_settings
        import jwt as pyjwt
        settings = get_settings()
        now = datetime.now(timezone.utc)
        temp_payload = {
            "sub": user["id"],
            "role": user["role"],
            "type": "2fa_pending",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=5)).timestamp()),
        }
        temp_token = pyjwt.encode(temp_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        return TwoFAPendingResponse(temp_token=temp_token)

    try:
        sb.table("audit_log").insert({
            "user_id": user["id"],
            "action": "login",
            "detail": "Signed in",
        }).execute()
    except Exception:
        pass  # audit log failure should not block login

    access_token = create_access_token(user["id"], user["role"], user.get("token_version") or 0)
    refresh_token = create_refresh_token(user["id"])
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


# ── Login step 2 (2FA code) ──────────────────────────────────────────────────

@router.post("/login/2fa", response_model=TokenPair)
@limiter.limit("10/minute")
async def login_2fa(request: Request, response: Response, body: TwoFALoginRequest):
    """Complete login by verifying TOTP code after password step."""
    from app.config import get_settings
    import jwt as pyjwt
    settings = get_settings()
    if not body.temp_token:
        raise HTTPException(status_code=400, detail="temp_token is required for 2FA login")
    try:
        payload = pyjwt.decode(body.temp_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, please log in again")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "2fa_pending":
        raise HTTPException(status_code=401, detail="Wrong token type")

    sb = get_supabase()
    res = sb.table("users").select("id, role, totp_secret, totp_enabled, archived").eq("id", payload["sub"]).limit(1).execute()
    if not res.data or res.data[0].get("archived"):
        raise HTTPException(status_code=401, detail="User not found")
    user = res.data[0]
    if not user.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA not configured")
    if not verify_totp_code(user["totp_secret"], body.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    try:
        sb.table("audit_log").insert({
            "user_id": user["id"],
            "action": "login",
            "detail": "Signed in with 2FA",
        }).execute()
    except Exception:
        pass

    access_token = create_access_token(user["id"], user["role"], user.get("token_version") or 0)
    refresh_token = create_refresh_token(user["id"])
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenPair(access_token=access_token, refresh_token=refresh_token)


# ── Refresh token ────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenPair)
@limiter.limit("30/minute")
async def refresh(request: Request, response: Response, body: RefreshRequest):
    # Accept refresh token from cookie or request body
    refresh_token = request.cookies.get("refresh_token") or body.refresh_token
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    payload = decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Wrong token type")
    sb = get_supabase()
    res = sb.table("users").select("id, role, archived, token_version").eq("id", payload["sub"]).limit(1).execute()
    if not res.data or res.data[0].get("archived"):
        raise HTTPException(status_code=401, detail="User not found")
    user = res.data[0]
    access_token = create_access_token(user["id"], user["role"], user.get("token_version") or 0)
    new_refresh = create_refresh_token(user["id"])
    _set_auth_cookies(response, access_token, new_refresh)
    return TokenPair(access_token=access_token, refresh_token=new_refresh)


# ── Logout ───────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(response: Response):
    """Clear auth cookies."""
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/api/auth/refresh")
    return {"message": "Logged out"}


# ── Current user ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[dict, Depends(current_user)]):
    sb = get_supabase()
    res = sb.table("users").select("id, email, username, name, role, theme, totp_enabled").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**res.data[0])


@router.patch("/me")
async def update_me(body: UpdateMeRequest, user: Annotated[dict, Depends(current_user)]):
    """Update name, email, and/or preferences for the current user."""
    sb = get_supabase()
    updates: dict = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.email is not None:
        existing = sb.table("users").select("id").eq("email", str(body.email)).neq("id", user["sub"]).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already in use")
        updates["email"] = str(body.email)
    if body.preferences is not None:
        res = sb.table("users").select("preferences").eq("id", user["sub"]).limit(1).execute()
        existing_prefs = res.data[0].get("preferences") or {} if res.data else {}
        updates["preferences"] = {**existing_prefs, **body.preferences}
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    sb.table("users").update(updates).eq("id", user["sub"]).execute()
    return {"message": "Updated"}


@router.post("/change-password")
async def change_password(body: ChangePasswordRequest, user: Annotated[dict, Depends(current_user)]):
    """Change password — requires current password verification."""
    if body.new_password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    try:
        validate_password(body.new_password)
    except PasswordError as e:
        raise HTTPException(status_code=400, detail=str(e))
    sb = get_supabase()
    res = sb.table("users").select("password_hash").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(body.current_password, res.data[0]["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    sb.table("users").update({"password_hash": hash_password(body.new_password)}).eq("id", user["sub"]).execute()
    try:
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "password_changed",
            "detail": "Password changed from settings",
        }).execute()
    except Exception:
        pass
    return {"message": "Password updated"}


@router.post("/logout-all")
async def logout_all(user: Annotated[dict, Depends(current_user)]):
    """Invalidate all sessions for this user by bumping token_version."""
    sb = get_supabase()
    res = sb.table("users").select("token_version").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    current_version = res.data[0].get("token_version") or 0
    sb.table("users").update({"token_version": current_version + 1}).eq("id", user["sub"]).execute()
    try:
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "logout_all",
            "detail": "All other sessions invalidated",
        }).execute()
    except Exception:
        pass
    return {"message": "All other sessions have been logged out"}


# ── Signup (direct account creation) ─────────────────────────────────────────

@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, body: SignupRequest):
    try:
        validate_password(body.password)
    except PasswordError as e:
        raise HTTPException(status_code=400, detail=str(e))

    sb = get_supabase()
    if sb.table("users").select("id").eq("email", body.email).execute().data:
        raise HTTPException(status_code=400, detail="Email already registered")
    if sb.table("users").select("id").eq("username", body.username).execute().data:
        raise HTTPException(status_code=400, detail="Username already taken")

    insert = sb.table("users").insert({
        "email": body.email,
        "username": body.username,
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


# ── Forgot password ──────────────────────────────────────────────────────────

@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Send password reset link to email. Always returns 200 (no user enumeration)."""
    sb = get_supabase()
    res = sb.table("users").select("id, email, name").eq("email", body.email).limit(1).execute()
    if not res.data:
        return {"message": "If that email is registered, a reset link has been sent"}

    user = res.data[0]
    token = generate_token()
    token_hash = hash_token(token)
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    # Invalidate previous tokens for this user
    sb.table("password_reset_tokens").update({"used": True}).eq("user_id", user["id"]).eq("used", False).execute()

    sb.table("password_reset_tokens").insert({
        "user_id": user["id"],
        "token_hash": token_hash,
        "expires_at": expires_at,
    }).execute()

    from app.config import get_settings as _get_settings
    reset_url = f"{_get_settings().frontend_url}/reset-password?token={token}"
    await send_email(
        to=user["email"],
        subject="Reset your COP Platform password",
        html=f"""
        <p>Hi {user['name']},</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <p><a href="{reset_url}">{reset_url}</a></p>
        <p>If you didn't request this, ignore this email.</p>
        """,
    )

    from app.config import get_settings
    settings = get_settings()
    if not settings.email_send_enabled:
        return {"message": "Dev mode — token returned", "token": token}

    return {"message": "If that email is registered, a reset link has been sent"}


# ── Reset password ───────────────────────────────────────────────────────────

@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    try:
        validate_password(body.password)
    except PasswordError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token_hash = hash_token(body.token)
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    res = sb.table("password_reset_tokens").select("*").eq("token_hash", token_hash).eq("used", False).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    record = res.data[0]
    if record["expires_at"] < now:
        raise HTTPException(status_code=400, detail="Reset link has expired")

    sb.table("password_reset_tokens").update({"used": True}).eq("id", record["id"]).execute()
    new_hash = hash_password(body.password)
    sb.table("users").update({"password_hash": new_hash}).eq("id", record["user_id"]).execute()

    try:
        sb.table("audit_log").insert({
            "user_id": record["user_id"],
            "action": "password_reset",
            "detail": "Password reset via email link",
        }).execute()
    except Exception:
        pass

    return {"message": "Password updated successfully"}


# ── 2FA setup ────────────────────────────────────────────────────────────────

@router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(user: Annotated[dict, Depends(current_user)]):
    """Generate a new TOTP secret. Does not enable 2FA yet — call /2fa/enable after verifying."""
    sb = get_supabase()
    res = sb.table("users").select("username, email").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")

    username = res.data[0].get("username") or res.data[0]["email"]
    secret = generate_totp_secret()
    sb.table("users").update({"totp_secret": secret}).eq("id", user["sub"]).execute()

    return Setup2FAResponse(
        secret=secret,
        otpauth_uri=get_totp_uri(secret, username),
    )


@router.post("/2fa/enable")
async def enable_2fa(
    body: TwoFALoginRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Verify a TOTP code and enable 2FA for the account."""
    sb = get_supabase()
    res = sb.table("users").select("totp_secret").eq("id", user["sub"]).limit(1).execute()
    if not res.data or not res.data[0].get("totp_secret"):
        raise HTTPException(status_code=400, detail="Run /2fa/setup first")

    secret = res.data[0]["totp_secret"]
    if not verify_totp_code(secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid code — check your authenticator app")

    sb.table("users").update({"totp_enabled": True}).eq("id", user["sub"]).execute()
    try:
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "2fa_enabled",
            "detail": "Two-factor authentication enabled",
        }).execute()
    except Exception:
        pass
    return {"message": "2FA enabled successfully"}


@router.post("/2fa/disable")
async def disable_2fa(
    body: TwoFALoginRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Verify current TOTP code then disable 2FA."""
    sb = get_supabase()
    res = sb.table("users").select("totp_secret, totp_enabled").eq("id", user["sub"]).limit(1).execute()
    if not res.data or not res.data[0].get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")

    if not verify_totp_code(res.data[0]["totp_secret"], body.code):
        raise HTTPException(status_code=400, detail="Invalid code")

    sb.table("users").update({"totp_enabled": False, "totp_secret": None}).eq("id", user["sub"]).execute()
    try:
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "2fa_disabled",
            "detail": "Two-factor authentication disabled",
        }).execute()
    except Exception:
        pass
    return {"message": "2FA disabled"}


# ── Accept invite ────────────────────────────────────────────────────────────

@router.post("/accept-invite", response_model=TokenPair)
async def accept_invite(body: AcceptInviteRequest):
    """Accept an invite link: set username + password, return tokens."""
    try:
        validate_password(body.password)
    except PasswordError as e:
        raise HTTPException(status_code=400, detail=str(e))

    token_hash = hash_token(body.token)
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    res = sb.table("invite_tokens").select("*").eq("token_hash", token_hash).eq("used", False).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")

    invite = res.data[0]
    if invite["expires_at"] < now:
        raise HTTPException(status_code=400, detail="Invite link has expired")

    if sb.table("users").select("id").eq("username", body.username).execute().data:
        raise HTTPException(status_code=400, detail="Username already taken")

    sb.table("invite_tokens").update({"used": True}).eq("id", invite["id"]).execute()

    insert = sb.table("users").insert({
        "email": invite["email"],
        "username": body.username,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": invite["role"],
        "theme": "midnight",
    }).execute()
    if not insert.data:
        raise HTTPException(status_code=500, detail="Failed to create account")

    user = insert.data[0]
    try:
        sb.table("audit_log").insert({
            "user_id": user["id"],
            "action": "account_created",
            "detail": f"Account created via invite (role: {invite['role']})",
        }).execute()
    except Exception:
        pass
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )


@router.post("/accept-invite-code", response_model=TokenPair)
async def accept_invite_code(body: AcceptInviteRequest):
    """Accept an invite code: set name, username, password, return tokens."""
    try:
        validate_password(body.password)
    except PasswordError as e:
        raise HTTPException(status_code=400, detail=str(e))

    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    res = sb.table("invite_codes").select("*").eq("code", body.token).eq("used", False).execute()
    if not res.data:
        raise HTTPException(status_code=400, detail="Invalid or expired invite code")
    invite = res.data[0]
    if invite["expires_at"] < now:
        raise HTTPException(status_code=400, detail="Invite code has expired")
    if sb.table("users").select("id").eq("username", body.username).execute().data:
        raise HTTPException(status_code=400, detail="Username already taken")

    sb.table("invite_codes").update({"used": True}).eq("id", invite["id"]).execute()
    insert = sb.table("users").insert({
        "name": body.name,
        "username": body.username,
        "email": f"{body.username}@invited.local",
        "password_hash": hash_password(body.password),
        "role": invite["role"],
        "theme": "midnight",
    }).execute()
    if not insert.data:
        raise HTTPException(status_code=500, detail="Failed to create account")
    user = insert.data[0]
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )
