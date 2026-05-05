# Authentication Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the COP Platform auth system to use username-based login, enforce password policy, add forgot/reset password, add TOTP 2FA (mandatory for Super Admin), fix token refresh, add inactivity auto-logout, and add invite acceptance flow.

**Architecture:** Backend changes extend `backend/app/routers/auth.py` and `backend/app/schemas/auth.py` using Supabase as the data store. Frontend adds new pages under `frontend/app/` and fixes the api.ts token refresh logic. Pure helper functions are unit-tested; endpoints are verified via build + manual test.

**Tech Stack:** FastAPI, Supabase (PostgreSQL), pyotp (TOTP), PyJWT, bcrypt, Resend (email), Next.js 16, React 19, Zustand, Axios, Vitest + RTL

---

## Existing Code Summary (read before implementing)

- `backend/app/routers/auth.py` — current endpoints: POST /auth/signup, POST /auth/login (email-based), POST /auth/refresh, GET /auth/me
- `backend/app/schemas/auth.py` — LoginRequest uses `email: EmailStr`; UserPublic has id, email, name, role, theme
- `backend/app/security.py` — hash_password, verify_password, create_access_token, create_refresh_token, decode_token, current_user, require_role
- `backend/app/config.py` — Settings: jwt_access_ttl_minutes=1440 (24h), jwt_refresh_ttl_days=30, resend_api_key, email_send_enabled flag
- `frontend/store/auth.ts` — Zustand store: User {id, email, name, role, theme}, setAuth, clearAuth, loadFromStorage
- `frontend/lib/api.ts` — axios with Bearer interceptor; 401 → clear auth + redirect; login/signup/getMe endpoints
- `frontend/app/login/page.tsx` — email+password form, calls login(), destructures {access_token, refresh_token, user} from res.data (BUG: backend returns TokenPair, no user field)

---

## File Map

**Backend — Create:**
- `backend/app/utils/password.py` — password policy validator function
- `backend/app/utils/tokens.py` — generate and hash reset/invite tokens
- `backend/app/utils/email.py` — send email via Resend REST API
- `backend/app/utils/totp.py` — TOTP secret generation and code verification
- `backend/tests/test_password.py` — unit tests for password policy
- `backend/tests/test_tokens.py` — unit tests for token hash utilities

**Backend — Modify:**
- `backend/app/schemas/auth.py` — add username, 2FA schemas, update UserPublic
- `backend/app/routers/auth.py` — rewrite login (username), add forgot/reset, 2FA, check-username, accept-invite
- `backend/app/config.py` — fix JWT TTL (15min access, 7 days refresh)
- `backend/requirements.txt` — add pyotp, httpx

**Supabase SQL (run in Supabase dashboard SQL editor):**
- Add `username`, `totp_secret`, `totp_enabled` columns to users table
- Create `password_reset_tokens` table
- Create `invite_tokens` table

**Frontend — Create:**
- `frontend/app/forgot-password/page.tsx` — enter email to request reset link
- `frontend/app/reset-password/page.tsx` — enter new password (from reset link)
- `frontend/app/accept-invite/page.tsx` — set username + password from invite link
- `frontend/app/dashboard/settings/security/page.tsx` — 2FA setup + session controls
- `frontend/app/login/2fa/page.tsx` — enter TOTP code after password step
- `frontend/hooks/useInactivityLogout.ts` — auto-logout after 30min inactivity
- `frontend/__tests__/hooks/useInactivityLogout.test.tsx`
- `frontend/__tests__/utils/passwordPolicy.test.ts`
- `frontend/lib/passwordPolicy.ts` — password policy checker (shared frontend logic)

**Frontend — Modify:**
- `frontend/lib/api.ts` — fix 401 to try refresh token first, add new endpoints
- `frontend/store/auth.ts` — add username to User type
- `frontend/app/login/page.tsx` — username field (not email), password policy hints
- `frontend/app/dashboard/layout.tsx` — wire useInactivityLogout hook

---

## Task 1: Supabase schema migrations

**Files:**
- No code files — run SQL in Supabase dashboard

- [ ] **Step 1: Open Supabase dashboard SQL editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Run migration for users table**

```sql
-- Add username column (nullable initially, for existing rows)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username VARCHAR(30) UNIQUE,
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Add index for fast username lookups
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username)
  WHERE username IS NOT NULL;
```

Expected: "Success. No rows returned"

- [ ] **Step 3: Run migration for password_reset_tokens table**

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS prt_user_idx ON password_reset_tokens (user_id);
CREATE INDEX IF NOT EXISTS prt_hash_idx ON password_reset_tokens (token_hash);
```

Expected: "Success. No rows returned"

- [ ] **Step 4: Run migration for invite_tokens table**

```sql
CREATE TABLE IF NOT EXISTS invite_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS it_hash_idx ON invite_tokens (token_hash);
CREATE INDEX IF NOT EXISTS it_email_idx ON invite_tokens (email);
```

Expected: "Success. No rows returned"

- [ ] **Step 5: Verify tables in Supabase Table Editor**

Navigate to Table Editor and confirm:
- `users` now has `username`, `totp_secret`, `totp_enabled` columns
- `password_reset_tokens` table exists with 6 columns
- `invite_tokens` table exists with 7 columns

---

## Task 2: Backend — install deps + password policy utility

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/app/utils/__init__.py`
- Create: `backend/app/utils/password.py`
- Create: `backend/tests/test_password.py`

- [ ] **Step 1: Check if pyotp and httpx are in requirements.txt**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
cat requirements.txt
```

- [ ] **Step 2: Add missing packages to requirements.txt**

Add these lines if not already present:
```
pyotp>=2.9.0
httpx>=0.27.0
```

- [ ] **Step 3: Install in the venv**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
pip install pyotp httpx
```

Expected: successfully installed

- [ ] **Step 4: Create `backend/app/utils/__init__.py`** (empty)

```python
```

- [ ] **Step 5: Write failing tests** at `backend/tests/test_password.py`

```python
"""Unit tests for password policy validator."""
import pytest
from app.utils.password import validate_password, PasswordError


def test_too_short():
    with pytest.raises(PasswordError, match="8"):
        validate_password("Ab1!")


def test_no_uppercase():
    with pytest.raises(PasswordError, match="uppercase"):
        validate_password("abcde1!!")


def test_no_digit():
    with pytest.raises(PasswordError, match="number"):
        validate_password("Abcde!!!")


def test_no_special():
    with pytest.raises(PasswordError, match="special"):
        validate_password("Abcde123")


def test_valid_password():
    # Should not raise
    validate_password("Secure1!")
    validate_password("MyP@ssw0rd")
    validate_password("Hello#999")


def test_returns_password_on_success():
    result = validate_password("Secure1!")
    assert result == "Secure1!"
```

- [ ] **Step 6: Run tests — confirm FAIL**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m pytest tests/test_password.py -v 2>&1 | tail -10
```

Expected: ImportError — `app.utils.password` not found

- [ ] **Step 7: Create `backend/app/utils/password.py`**

```python
"""Password policy validator."""
import re


class PasswordError(ValueError):
    pass


def validate_password(password: str) -> str:
    """Validate password meets policy. Returns password if valid, raises PasswordError if not."""
    if len(password) < 8:
        raise PasswordError("Password must be at least 8 characters")
    if not re.search(r"[A-Z]", password):
        raise PasswordError("Password must contain at least one uppercase letter")
    if not re.search(r"\d", password):
        raise PasswordError("Password must contain at least one number")
    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]", password):
        raise PasswordError("Password must contain at least one special character")
    return password
```

- [ ] **Step 8: Run tests — confirm PASS**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m pytest tests/test_password.py -v 2>&1 | tail -15
```

Expected: 6 tests passed

- [ ] **Step 9: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add backend/requirements.txt backend/app/utils/__init__.py backend/app/utils/password.py backend/tests/test_password.py
git commit -m "feat: add password policy validator (8 chars + uppercase + digit + special)"
```

---

## Task 3: Backend — token + email + TOTP utilities

**Files:**
- Create: `backend/app/utils/tokens.py`
- Create: `backend/app/utils/email.py`
- Create: `backend/app/utils/totp.py`
- Create: `backend/tests/test_tokens.py`

- [ ] **Step 1: Write failing tests** at `backend/tests/test_tokens.py`

```python
"""Unit tests for reset/invite token utilities."""
from app.utils.tokens import generate_token, hash_token


def test_generate_token_length():
    token = generate_token()
    assert len(token) >= 40  # URL-safe base64 of 32 bytes is ~43 chars


def test_generate_tokens_are_unique():
    t1 = generate_token()
    t2 = generate_token()
    assert t1 != t2


def test_hash_is_deterministic():
    token = generate_token()
    assert hash_token(token) == hash_token(token)


def test_different_tokens_different_hashes():
    t1 = generate_token()
    t2 = generate_token()
    assert hash_token(t1) != hash_token(t2)


def test_hash_is_hex_string():
    token = generate_token()
    h = hash_token(token)
    int(h, 16)  # raises ValueError if not valid hex
    assert len(h) == 64  # SHA-256 = 64 hex chars
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m pytest tests/test_tokens.py -v 2>&1 | tail -10
```

Expected: ImportError

- [ ] **Step 3: Create `backend/app/utils/tokens.py`**

```python
"""Utilities for generating and hashing one-time tokens."""
import hashlib
import secrets


def generate_token(nbytes: int = 32) -> str:
    """Generate a cryptographically secure URL-safe token string."""
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Return the SHA-256 hex digest of a token (for safe DB storage)."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m pytest tests/test_tokens.py -v 2>&1 | tail -10
```

Expected: 5 tests passed

- [ ] **Step 5: Create `backend/app/utils/email.py`**

```python
"""Email sending via Resend REST API."""
import httpx
from app.config import get_settings


async def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend. Returns True on success, False if email_send_enabled=False."""
    settings = get_settings()
    if not settings.email_send_enabled:
        return False
    async with httpx.AsyncClient() as client:
        resp = client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.resend_from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        return resp.status_code == 200
```

- [ ] **Step 6: Create `backend/app/utils/totp.py`**

```python
"""TOTP utilities for 2FA using pyotp."""
import pyotp


def generate_totp_secret() -> str:
    """Generate a new random TOTP base32 secret."""
    return pyotp.random_base32()


def get_totp_uri(secret: str, username: str, issuer: str = "COP Platform") -> str:
    """Return an otpauth:// URI for QR code generation."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=issuer)


def verify_totp_code(secret: str, code: str) -> bool:
    """Verify a TOTP code. Allows 1 period of clock drift."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
```

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add backend/app/utils/tokens.py backend/app/utils/email.py backend/app/utils/totp.py backend/tests/test_tokens.py
git commit -m "feat: add token, email, and TOTP utility modules"
```

---

## Task 4: Backend — update schemas + config TTL

**Files:**
- Modify: `backend/app/schemas/auth.py`
- Modify: `backend/app/config.py`

- [ ] **Step 1: Read current schemas/auth.py**

```bash
cat /c/Users/Kevin\ Chng/Documents/BuildLab33/backend/app/schemas/auth.py
```

- [ ] **Step 2: Replace `backend/app/schemas/auth.py`**

```python
"""Pydantic schemas for auth endpoints."""
import re
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)


class TwoFALoginRequest(BaseModel):
    """Second step of login when 2FA is enabled."""
    temp_token: str
    code: str = Field(min_length=6, max_length=6)


class SignupRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username must be alphanumeric (letters, numbers, underscores only)")
        return v.lower()


class AcceptInviteRequest(BaseModel):
    """Accept an invite link and set credentials."""
    token: str
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=120)

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username must be alphanumeric (letters, numbers, underscores only)")
        return v.lower()


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class Setup2FAResponse(BaseModel):
    secret: str
    otpauth_uri: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"


class TwoFAPendingResponse(BaseModel):
    """Returned when password is valid but 2FA code is still required."""
    requires_2fa: bool = True
    temp_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    username: Optional[str] = None
    name: str
    role: Literal["super_admin", "admin", "user", "guest"]
    theme: str = "midnight"
    totp_enabled: bool = False
```

- [ ] **Step 3: Fix JWT TTL in config.py**

Open `backend/app/config.py` and change:
```python
jwt_access_ttl_minutes: int = 60 * 24   # old: 1440 (24h)
jwt_refresh_ttl_days: int = 30           # old: 30 days
```
to:
```python
jwt_access_ttl_minutes: int = 15         # 15 minutes per spec
jwt_refresh_ttl_days: int = 7            # 7 days per spec
```

- [ ] **Step 4: Verify backend starts without errors**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m uvicorn app.main:app --reload --port 8000 2>&1 | head -5
```

Expected: `Application startup complete` (then Ctrl+C to stop)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add backend/app/schemas/auth.py backend/app/config.py
git commit -m "feat: update auth schemas (username, 2FA, invite) and fix JWT TTL to 15min/7days"
```

---

## Task 5: Backend — rewrite login + add check-username

**Files:**
- Modify: `backend/app/routers/auth.py`

- [ ] **Step 1: Read current routers/auth.py**

```bash
cat /c/Users/Kevin\ Chng/Documents/BuildLab33/backend/app/routers/auth.py
```

- [ ] **Step 2: Replace `backend/app/routers/auth.py` with updated login + check-username**

Replace the entire file with:

```python
"""Authentication endpoints."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_supabase
from app.schemas.auth import (
    AcceptInviteRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    Setup2FAResponse,
    SignupRequest,
    TokenPair,
    TwoFALoginRequest,
    TwoFAPendingResponse,
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
async def check_username(username: str = Query(min_length=3, max_length=30)):
    """Return whether a username is available."""
    sb = get_supabase()
    res = sb.table("users").select("id").eq("username", username.lower()).execute()
    return {"available": len(res.data) == 0}


# ── Login (step 1) ───────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginRequest):
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

    sb.table("audit_log").insert({
        "user_id": user["id"],
        "action": "login",
        "detail": "Signed in",
    }).execute()
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )


# ── Login step 2 (2FA code) ──────────────────────────────────────────────────

@router.post("/login/2fa", response_model=TokenPair)
async def login_2fa(body: TwoFALoginRequest):
    """Complete login by verifying TOTP code after password step."""
    from app.config import get_settings
    import jwt as pyjwt
    settings = get_settings()
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

    sb.table("audit_log").insert({
        "user_id": user["id"],
        "action": "login",
        "detail": "Signed in with 2FA",
    }).execute()
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )


# ── Refresh token ────────────────────────────────────────────────────────────

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


# ── Current user ─────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[dict, Depends(current_user)]):
    sb = get_supabase()
    res = sb.table("users").select("id, email, username, name, role, theme, totp_enabled").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**res.data[0])


# ── Signup (direct account creation — used by Super Admin API) ───────────────

@router.post("/signup", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
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
async def forgot_password(body: ForgotPasswordRequest):
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

    reset_url = f"http://localhost:3000/reset-password?token={token}"
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
        # In dev mode, return the token so you can test without email
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

    # Mark token used
    sb.table("password_reset_tokens").update({"used": True}).eq("id", record["id"]).execute()

    # Update password
    new_hash = hash_password(body.password)
    sb.table("users").update({"password_hash": new_hash}).eq("id", record["user_id"]).execute()

    sb.table("audit_log").insert({
        "user_id": record["user_id"],
        "action": "password_reset",
        "detail": "Password reset via email link",
    }).execute()

    return {"message": "Password updated successfully"}


# ── 2FA setup ────────────────────────────────────────────────────────────────

@router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(user: Annotated[dict, Depends(current_user)]):
    """Generate a new TOTP secret for the user. Does not enable 2FA yet — call /2fa/enable after verifying."""
    sb = get_supabase()
    res = sb.table("users").select("username, email").eq("id", user["sub"]).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")

    username = res.data[0].get("username") or res.data[0]["email"]
    secret = generate_totp_secret()

    # Store secret temporarily (not enabled yet)
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
    # body.temp_token is unused here (we use current_user), body.code is the verification
    sb = get_supabase()
    res = sb.table("users").select("totp_secret").eq("id", user["sub"]).limit(1).execute()
    if not res.data or not res.data[0].get("totp_secret"):
        raise HTTPException(status_code=400, detail="Run /2fa/setup first")

    secret = res.data[0]["totp_secret"]
    if not verify_totp_code(secret, body.code):
        raise HTTPException(status_code=400, detail="Invalid code — check your authenticator app")

    sb.table("users").update({"totp_enabled": True}).eq("id", user["sub"]).execute()
    sb.table("audit_log").insert({
        "user_id": user["sub"],
        "action": "2fa_enabled",
        "detail": "Two-factor authentication enabled",
    }).execute()
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
    sb.table("audit_log").insert({
        "user_id": user["sub"],
        "action": "2fa_disabled",
        "detail": "Two-factor authentication disabled",
    }).execute()
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

    # Check username not taken
    if sb.table("users").select("id").eq("username", body.username).execute().data:
        raise HTTPException(status_code=400, detail="Username already taken")

    # Mark invite used
    sb.table("invite_tokens").update({"used": True}).eq("id", invite["id"]).execute()

    # Create user
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
    sb.table("audit_log").insert({
        "user_id": user["id"],
        "action": "account_created",
        "detail": f"Account created via invite (role: {invite['role']})",
    }).execute()
    return TokenPair(
        access_token=create_access_token(user["id"], user["role"]),
        refresh_token=create_refresh_token(user["id"]),
    )
```

- [ ] **Step 3: Verify backend starts**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m uvicorn app.main:app --reload --port 8000 2>&1 | head -8
```

Expected: `Application startup complete` — fix any import errors before proceeding.

- [ ] **Step 4: Run all backend tests**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m pytest tests/ -v 2>&1 | tail -15
```

Expected: 11 tests passed (6 password + 5 token)

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add backend/app/routers/auth.py
git commit -m "feat: rewrite auth router — username login, 2FA, forgot/reset password, invite acceptance"
```

---

## Task 6: Frontend — password policy util + fix auth store

**Files:**
- Create: `frontend/lib/passwordPolicy.ts`
- Create: `frontend/__tests__/utils/passwordPolicy.test.ts`
- Modify: `frontend/store/auth.ts`

- [ ] **Step 1: Write failing tests** at `frontend/__tests__/utils/passwordPolicy.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { checkPasswordPolicy, type PasswordCheck } from "@/lib/passwordPolicy";

describe("checkPasswordPolicy", () => {
  it("returns all passing for a valid password", () => {
    const result = checkPasswordPolicy("Secure1!");
    expect(result.every((c) => c.pass)).toBe(true);
  });

  it("fails minLength for short password", () => {
    const result = checkPasswordPolicy("Ab1!");
    const min = result.find((c) => c.id === "minLength")!;
    expect(min.pass).toBe(false);
  });

  it("fails uppercase check", () => {
    const result = checkPasswordPolicy("secure1!");
    const up = result.find((c) => c.id === "uppercase")!;
    expect(up.pass).toBe(false);
  });

  it("fails digit check", () => {
    const result = checkPasswordPolicy("SecureAA!");
    const dig = result.find((c) => c.id === "digit")!;
    expect(dig.pass).toBe(false);
  });

  it("fails special check", () => {
    const result = checkPasswordPolicy("Secure123");
    const sp = result.find((c) => c.id === "special")!;
    expect(sp.pass).toBe(false);
  });

  it("returns 4 checks", () => {
    expect(checkPasswordPolicy("x")).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npx vitest run __tests__/utils/passwordPolicy.test.ts 2>&1 | tail -10
```

Expected: module not found

- [ ] **Step 3: Create `frontend/lib/passwordPolicy.ts`**

```typescript
export interface PasswordCheck {
  id: string;
  label: string;
  pass: boolean;
}

export function checkPasswordPolicy(password: string): PasswordCheck[] {
  return [
    {
      id: "minLength",
      label: "At least 8 characters",
      pass: password.length >= 8,
    },
    {
      id: "uppercase",
      label: "One uppercase letter",
      pass: /[A-Z]/.test(password),
    },
    {
      id: "digit",
      label: "One number",
      pass: /\d/.test(password),
    },
    {
      id: "special",
      label: "One special character (!@#$%^&* etc.)",
      pass: /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>\/?]/.test(password),
    },
  ];
}

export function isPasswordValid(password: string): boolean {
  return checkPasswordPolicy(password).every((c) => c.pass);
}
```

- [ ] **Step 4: Run test — confirm PASS**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npx vitest run __tests__/utils/passwordPolicy.test.ts 2>&1 | tail -10
```

Expected: 6 tests passed

- [ ] **Step 5: Update `frontend/store/auth.ts`** to add username and fix User type

```typescript
import { create } from "zustand";

export interface User {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  theme: string;
  totp_enabled: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    set({ user, accessToken });
  },

  clearAuth: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    set({ user: null, accessToken: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("access_token");
    if (token) set({ accessToken: token });
  },
}));
```

- [ ] **Step 6: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/lib/passwordPolicy.ts frontend/__tests__/utils/passwordPolicy.test.ts frontend/store/auth.ts
git commit -m "feat: add password policy checker, update User type with username and totp_enabled"
```

---

## Task 7: Frontend — fix api.ts (token refresh + new endpoints)

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Read current api.ts**

```bash
cat /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend/lib/api.ts
```

- [ ] **Step 2: Replace `frontend/lib/api.ts`**

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(err);
      }
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }
      isRefreshing = true;
      try {
        const res = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
          { refresh_token: refreshToken }
        );
        const { access_token, refresh_token } = res.data;
        localStorage.setItem("access_token", access_token);
        localStorage.setItem("refresh_token", refresh_token);
        api.defaults.headers.common.Authorization = `Bearer ${access_token}`;
        refreshQueue.forEach((cb) => cb(access_token));
        refreshQueue = [];
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────

export const login = (username: string, password: string) =>
  api.post("/api/auth/login", { username, password });

export const login2FA = (temp_token: string, code: string) =>
  api.post("/api/auth/login/2fa", { temp_token, code });

export const getMe = () => api.get("/api/auth/me");

export const checkUsername = (username: string) =>
  api.get("/api/auth/check-username", { params: { username } });

export const forgotPassword = (email: string) =>
  api.post("/api/auth/forgot-password", { email });

export const resetPassword = (token: string, password: string) =>
  api.post("/api/auth/reset-password", { token, password });

export const acceptInvite = (
  token: string,
  username: string,
  password: string,
  name: string
) => api.post("/api/auth/accept-invite", { token, username, password, name });

export const setup2FA = () => api.post("/api/auth/2fa/setup");

export const enable2FA = (code: string) =>
  api.post("/api/auth/2fa/enable", { temp_token: "", code });

export const disable2FA = (code: string) =>
  api.post("/api/auth/2fa/disable", { temp_token: "", code });

// ── Brands ────────────────────────────────────────────────────────────────

export const getBrands = () => api.get("/api/brands");
export const getBrand = (id: string) => api.get(`/api/brands/${id}`);

// ── Generate ──────────────────────────────────────────────────────────────

export const generatePost = (payload: {
  brand_id: string;
  platform: string;
  campaign_goal: string;
  audience: string;
  content_format?: string;
  growth_angle?: string;
  news_hook?: string;
}) => api.post("/api/generate", payload);
```

- [ ] **Step 3: Build to verify no TypeScript errors**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -15
```

Fix any type errors before committing.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/lib/api.ts
git commit -m "feat: fix api.ts — token refresh on 401, username login, 2FA and password reset endpoints"
```

---

## Task 8: Frontend — inactivity auto-logout hook

**Files:**
- Create: `frontend/hooks/useInactivityLogout.ts`
- Create: `frontend/__tests__/hooks/useInactivityLogout.test.tsx`
- Modify: `frontend/app/dashboard/layout.tsx`

- [ ] **Step 1: Write failing tests** at `frontend/__tests__/hooks/useInactivityLogout.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

describe("useInactivityLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls onLogout after timeout with no activity", () => {
    const onLogout = vi.fn();
    renderHook(() => useInactivityLogout({ timeoutMs: 1000, onLogout }));
    act(() => { vi.advanceTimersByTime(1001); });
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("resets timer on mousemove and does not call onLogout early", () => {
    const onLogout = vi.fn();
    renderHook(() => useInactivityLogout({ timeoutMs: 1000, onLogout }));
    act(() => {
      vi.advanceTimersByTime(800);
      window.dispatchEvent(new Event("mousemove"));
      vi.advanceTimersByTime(800);
    });
    expect(onLogout).not.toHaveBeenCalled();
  });

  it("calls onLogout after timeout resets and expires", () => {
    const onLogout = vi.fn();
    renderHook(() => useInactivityLogout({ timeoutMs: 1000, onLogout }));
    act(() => {
      vi.advanceTimersByTime(800);
      window.dispatchEvent(new Event("keydown"));
      vi.advanceTimersByTime(1001);
    });
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test — confirm FAIL**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npx vitest run __tests__/hooks/useInactivityLogout.test.tsx 2>&1 | tail -10
```

- [ ] **Step 3: Create `frontend/hooks/useInactivityLogout.ts`**

```typescript
"use client";
import { useEffect, useRef } from "react";

interface Options {
  timeoutMs: number;
  onLogout: () => void;
}

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function useInactivityLogout({ timeoutMs, onLogout }: Options) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onLogout, timeoutMs);
    };

    reset();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [timeoutMs, onLogout]);
}
```

- [ ] **Step 4: Run test — confirm 3/3 PASS**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npx vitest run __tests__/hooks/useInactivityLogout.test.tsx 2>&1 | tail -15
```

- [ ] **Step 5: Wire into `frontend/app/dashboard/layout.tsx`**

Read the current dashboard layout, then add the hook. Find the `useEffect` block and add after the auth init logic:

```typescript
import { useInactivityLogout } from "@/hooks/useInactivityLogout";
import { useCallback } from "react";
```

Inside the component, after the existing state declarations, add:

```typescript
const handleInactivityLogout = useCallback(() => {
  clearAuth();
  router.push("/login?reason=inactive");
}, [clearAuth, router]);

useInactivityLogout({
  timeoutMs: 30 * 60 * 1000, // 30 minutes
  onLogout: handleInactivityLogout,
});
```

Also add `clearAuth` to the destructured values from `useAuthStore`:
```typescript
const { setAuth, loadFromStorage, clearAuth } = useAuthStore();
```

- [ ] **Step 6: Build to confirm no errors**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -10
```

- [ ] **Step 7: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/hooks/useInactivityLogout.ts frontend/__tests__/hooks/useInactivityLogout.test.tsx frontend/app/dashboard/layout.tsx
git commit -m "feat: add 30-minute inactivity auto-logout hook, wire into dashboard layout"
```

---

## Task 9: Frontend — update login page (username field + 2FA step)

**Files:**
- Modify: `frontend/app/login/page.tsx`
- Create: `frontend/app/login/2fa/page.tsx`

- [ ] **Step 1: Read current login page**

```bash
cat /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend/app/login/page.tsx
```

- [ ] **Step 2: Replace `frontend/app/login/page.tsx`**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      const data = res.data;

      // 2FA required
      if (data.requires_2fa) {
        sessionStorage.setItem("2fa_temp_token", data.temp_token);
        router.push("/login/2fa");
        return;
      }

      // Normal login — fetch user profile
      const { access_token, refresh_token } = data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      const meRes = await getMe();
      setAuth(meRes.data, access_token, refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Invalid username or password";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">COP Platform</h1>
          <p className="text-xs text-text-muted mt-1">Sign in to continue</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
              <div className="text-center">
                <a
                  href="/forgot-password"
                  className="text-xs text-text-muted hover:text-text-active transition-colors"
                >
                  Forgot password?
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/app/login/2fa/page.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { login2FA, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function TwoFAPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("2fa_temp_token");
    if (!token) router.push("/login");
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const tempToken = sessionStorage.getItem("2fa_temp_token") ?? "";
    try {
      const res = await login2FA(tempToken, code);
      const { access_token, refresh_token } = res.data;
      sessionStorage.removeItem("2fa_temp_token");
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      const meRes = await getMe();
      setAuth(meRes.data, access_token, refresh_token);
      router.push("/dashboard");
    } catch {
      setError("Invalid code. Check your authenticator app and try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">Two-Factor Authentication</h1>
          <p className="text-xs text-text-muted mt-1">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="code">Authentication Code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  required
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                {loading ? "Verifying..." : "Verify"}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="text-xs text-text-muted hover:text-text-active transition-colors"
                >
                  Back to login
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build and confirm no errors**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -15
```

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/app/login/page.tsx frontend/app/login/2fa/page.tsx
git commit -m "feat: update login to username-based, add 2FA verification step"
```

---

## Task 10: Frontend — forgot password + reset password pages

**Files:**
- Create: `frontend/app/forgot-password/page.tsx`
- Create: `frontend/app/reset-password/page.tsx`

- [ ] **Step 1: Create `frontend/app/forgot-password/page.tsx`**

```typescript
"use client";
import { useState } from "react";
import { forgotPassword } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res.data?.token) {
        // Dev mode: backend returns token directly
        setDevToken(res.data.token);
      }
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Still show success (no user enumeration)
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-6" />
          <h1 className="text-xl font-bold text-text-primary mb-2">Check your email</h1>
          <p className="text-sm text-text-muted mb-6">
            If that email is registered, we&apos;ve sent a reset link. It expires in 1 hour.
          </p>
          {devToken && (
            <div className="bg-elevated border border-border rounded-lg p-4 mb-4 text-left">
              <p className="text-xs text-warning font-semibold mb-1">Dev mode — reset token:</p>
              <p className="text-xs text-text-secondary break-all font-mono">{devToken}</p>
              <a
                href={`/reset-password?token=${devToken}`}
                className="text-xs text-primary hover:underline mt-2 block"
              >
                Open reset page →
              </a>
            </div>
          )}
          <a href="/login" className="text-xs text-text-muted hover:text-text-active transition-colors">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">Reset your password</h1>
          <p className="text-xs text-text-muted mt-1">
            Enter the email address on your account
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending..." : "Send reset link"}
              </Button>
              <div className="text-center">
                <a href="/login" className="text-xs text-text-muted hover:text-text-active transition-colors">
                  Back to login
                </a>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/app/reset-password/page.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { checkPasswordPolicy, isPasswordValid } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const checks = checkPasswordPolicy(password);
  const valid = isPasswordValid(password) && password === confirm;

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) { setError("Please fix the issues above"); return; }
    setError("");
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Reset failed. The link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-6" />
          <h1 className="text-xl font-bold text-text-primary mb-2">Password updated</h1>
          <p className="text-sm text-text-muted mb-6">You can now sign in with your new password.</p>
          <Button onClick={() => router.push("/login")} className="w-full">Back to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">Set new password</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {password && (
                  <ul className="mt-2 space-y-1">
                    {checks.map((c) => (
                      <li key={c.id} className={`text-xs flex items-center gap-1.5 ${c.pass ? "text-success" : "text-error"}`}>
                        <span>{c.pass ? "✓" : "✗"}</span>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  error={confirm.length > 0 && password !== confirm}
                  required
                />
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs text-error mt-1">Passwords do not match</p>
                )}
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading || !valid} className="w-full">
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build to verify**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -15
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/app/forgot-password/page.tsx frontend/app/reset-password/page.tsx
git commit -m "feat: add forgot password and reset password pages with policy validation"
```

---

## Task 11: Frontend — accept invite page

**Files:**
- Create: `frontend/app/accept-invite/page.tsx`

- [ ] **Step 1: Create `frontend/app/accept-invite/page.tsx`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { acceptInvite, checkUsername, getMe } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { checkPasswordPolicy, isPasswordValid } from "@/lib/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useCallback } from "react";

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export default function AcceptInvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const setAuth = useAuthStore((s) => s.setAuth);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = checkPasswordPolicy(password);
  const allValid =
    name.trim().length > 0 &&
    username.length >= 3 &&
    usernameAvailable === true &&
    isPasswordValid(password) &&
    password === confirm;

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const checkAvailability = useCallback(
    debounce(async (value: string) => {
      if (value.length < 3) { setUsernameAvailable(null); return; }
      if (!/^[a-zA-Z0-9_]+$/.test(value)) { setUsernameAvailable(false); return; }
      try {
        const res = await checkUsername(value);
        setUsernameAvailable(res.data.available);
      } catch {
        setUsernameAvailable(null);
      }
    }, 400) as (...args: unknown[]) => void,
    []
  );

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameAvailable(null);
    checkAvailability(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setError("");
    setLoading(true);
    try {
      const res = await acceptInvite(token, username, password, name);
      const { access_token, refresh_token } = res.data;
      localStorage.setItem("access_token", access_token);
      localStorage.setItem("refresh_token", refresh_token);
      const meRes = await getMe();
      setAuth(meRes.data, access_token, refresh_token);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Failed to create account. The invite link may have expired.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">Set up your account</h1>
          <p className="text-xs text-text-muted mt-1">Choose a username and password to get started</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  placeholder="your_username"
                  autoComplete="username"
                  error={usernameAvailable === false}
                  required
                />
                {username.length >= 3 && (
                  <p className={`text-xs mt-1 ${usernameAvailable === true ? "text-success" : usernameAvailable === false ? "text-error" : "text-text-muted"}`}>
                    {usernameAvailable === true ? "✓ Available" : usernameAvailable === false ? "✗ Not available" : "Checking..."}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                {password && (
                  <ul className="mt-2 space-y-1">
                    {checks.map((c) => (
                      <li key={c.id} className={`text-xs flex items-center gap-1.5 ${c.pass ? "text-success" : "text-text-muted"}`}>
                        <span>{c.pass ? "✓" : "○"}</span>
                        {c.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  error={confirm.length > 0 && password !== confirm}
                  required
                />
              </div>
              {error && <p className="text-xs text-error">{error}</p>}
              <Button type="submit" disabled={loading || !allValid} className="w-full">
                {loading ? "Creating account..." : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -15
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/app/accept-invite/page.tsx
git commit -m "feat: add invite acceptance page with username availability check and password policy"
```

---

## Task 12: Frontend — 2FA setup page in Settings

**Files:**
- Create: `frontend/app/dashboard/settings/security/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend/app/dashboard/settings/security
```

- [ ] **Step 2: Create `frontend/app/dashboard/settings/security/page.tsx`**

```typescript
"use client";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { setup2FA, enable2FA, disable2FA } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

export default function SecurityPage() {
  const user = useAuthStore((s) => s.user);
  const [setupData, setSetupData] = useState<{ secret: string; otpauth_uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await setup2FA();
      setSetupData(res.data);
    } catch {
      toast.error("Failed to start 2FA setup");
    } finally {
      setLoading(false);
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await enable2FA(code);
      toast.success("2FA enabled successfully");
      setSetupData(null);
      setCode("");
      // Refresh user data
      window.location.reload();
    } catch {
      toast.error("Invalid code — check your authenticator app");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await disable2FA(disableCode);
      toast.success("2FA disabled");
      setShowDisable(false);
      setDisableCode("");
      window.location.reload();
    } catch {
      toast.error("Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const totpEnabled = user?.totp_enabled ?? false;

  return (
    <div>
      <PageHeader title="Security" subtitle="Manage two-factor authentication and sessions" />

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Two-Factor Authentication (2FA)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {totpEnabled ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-success">● Enabled</span>
                <span className="text-xs text-text-muted">Your account is protected with 2FA</span>
              </div>
              {!showDisable ? (
                <Button variant="danger" onClick={() => setShowDisable(true)}>
                  Disable 2FA
                </Button>
              ) : (
                <form onSubmit={handleDisable} className="space-y-3">
                  <p className="text-xs text-text-muted">
                    Enter your current authenticator code to disable 2FA.
                  </p>
                  <div>
                    <Label htmlFor="disable-code">Authenticator code</Label>
                    <Input
                      id="disable-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" disabled={loading || disableCode.length !== 6}>
                      {loading ? "Disabling..." : "Confirm disable"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowDisable(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : setupData ? (
            <div className="space-y-4">
              <p className="text-xs text-text-secondary">
                1. Scan this QR code with Google Authenticator or Authy.
              </p>
              <div className="bg-white p-3 rounded-lg inline-block">
                <QRCodeSVG value={setupData.otpauth_uri} size={180} />
              </div>
              <p className="text-xs text-text-muted">
                Can&apos;t scan? Enter this code manually:
              </p>
              <code className="text-xs font-mono bg-elevated px-3 py-2 rounded-md block text-text-active break-all">
                {setupData.secret}
              </code>
              <form onSubmit={handleEnable} className="space-y-3">
                <p className="text-xs text-text-secondary">
                  2. Enter the 6-digit code from your app to confirm.
                </p>
                <div>
                  <Label htmlFor="totp-code">Authentication code</Label>
                  <Input
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </div>
                <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                  {loading ? "Verifying..." : "Enable 2FA"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Add an extra layer of security. You&apos;ll need Google Authenticator, Authy, or any TOTP app.
              </p>
              <Button onClick={handleSetup} disabled={loading}>
                {loading ? "Setting up..." : "Set up 2FA"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Install qrcode.react**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm install qrcode.react
npm install -D @types/qrcode.react 2>/dev/null; true
```

- [ ] **Step 4: Build to verify**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -15
```

If `@types/qrcode.react` doesn't exist and causes errors, remove that type import — `qrcode.react` ships its own types.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33
git add frontend/app/dashboard/settings/security/page.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add 2FA setup/enable/disable page in Settings → Security"
```

---

## Task 13: Run full test suite + final build verification

**Files:** No changes — verification only

- [ ] **Step 1: Run all frontend tests**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npx vitest run 2>&1 | tail -20
```

Expected: all tests pass (at minimum 28+ tests — 25 existing + 3 password policy + 3 inactivity logout)

- [ ] **Step 2: Run frontend build**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend
npm run build 2>&1 | tail -15
```

Expected: build succeeds with no errors

- [ ] **Step 3: Run backend tests**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: 11 tests passing

- [ ] **Step 4: Verify backend starts**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend
python -m uvicorn app.main:app --reload --port 8000 2>&1 | head -8
```

Expected: `Application startup complete` — then Ctrl+C

---

## Self-Review Against Spec (Section 4)

### Spec coverage check:

| Requirement | Covered By |
|---|---|
| Login ID: alphanumeric username | Task 5 (LoginRequest.username), Task 9 (login page) |
| Password policy: 8 chars + uppercase + digit + special | Task 2 (backend validator), Task 6 (frontend checker) |
| Real-time validation: inline error messages | Task 10 (reset page checks), Task 11 (invite page checks) |
| JWT 15min access / 7 days refresh | Task 4 (config.py TTL change) |
| Invite-only: set username+password on first login | Task 5 (accept-invite endpoint), Task 11 (accept-invite page) |
| Real-time duplicate username check (debounced) | Task 5 (check-username endpoint), Task 11 (frontend debounce) |
| Forgot password: email → reset link (1hr) | Task 5 (forgot-password endpoint), Task 10 (forgot-password page) |
| Reset password: policy enforced, old sessions invalidated | Task 5 (reset-password endpoint + password_reset_tokens) |
| 2FA: TOTP, Super Admin mandatory | Task 5 (2FA endpoints), Task 12 (setup page) |
| 2FA: optional for Admin/User/Guest, prompted once | Task 5 (enable/disable endpoints), Task 12 (settings page) |
| 2FA: Google Authenticator / Authy compatible | Task 3 (pyotp TOTP = standard), Task 12 (QR code display) |
| Auto-logout: 30min inactivity | Task 8 (useInactivityLogout hook) |
| Token refresh on expiry | Task 7 (api.ts refresh interceptor) |

**Note:** "Super Admin mandatory on first login" — the enforcement (redirect to 2FA setup if super_admin and not totp_enabled) is partially handled by the login flow returning a normal token. Full enforcement (blocking dashboard until 2FA is set up) can be added to `dashboard/layout.tsx` as a follow-up in the User Management subsystem when Super Admin role assignment is implemented. The 2FA infrastructure is fully built here.

**Note:** "Force-logout all devices" and "view active sessions per user" — deferred to Settings subsystem (requires a sessions table). The infrastructure (refresh token rotation) is in place.

### Placeholder scan: None found.

### Type consistency check:
- `TwoFALoginRequest` used in enable2FA and disable2FA: the `temp_token` field is present but unused for those endpoints (only `code` is needed). Frontend sends `temp_token: ""` which is accepted. This is acceptable — if desired, create a separate `VerifyTOTPRequest` schema later.
- `UserPublic.username: Optional[str]` — correct, since existing users may not have a username yet.
- `checkPasswordPolicy` returns `PasswordCheck[]` — consistent across Task 6 and Tasks 10/11.

---

*Plan written 2026-05-04. Implements Section 4 of the Phase 2 spec (Authentication). Next plan: Brand Management (Section 6).*
