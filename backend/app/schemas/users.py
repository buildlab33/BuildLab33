# backend/app/schemas/users.py
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class UserListItem(BaseModel):
    id: str
    name: str
    email: str
    username: Optional[str] = None
    role: str
    status: str
    created_at: str


class EmailInviteRequest(BaseModel):
    email: EmailStr
    role: Literal["admin", "user"] = "user"


class DirectCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "user"] = "user"


class GenerateInviteCodeRequest(BaseModel):
    role: Literal["admin", "user"] = "user"


class ChangeRoleRequest(BaseModel):
    role: Literal["admin", "user"]
