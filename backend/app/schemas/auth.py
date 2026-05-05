"""Pydantic schemas for auth endpoints."""
import re
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)


class TwoFALoginRequest(BaseModel):
    """Second step of login when 2FA is enabled. Also used for enable/disable 2FA (temp_token optional there)."""
    temp_token: Optional[str] = None
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


class UpdateMeRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    preferences: Optional[dict] = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(max_length=128)
