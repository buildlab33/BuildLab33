# backend/app/schemas/posts.py
"""Pydantic models for the posts subsystem."""
from typing import Literal, Optional
from pydantic import BaseModel, Field

PostStatus = Literal["draft", "pending", "approved", "scheduled", "published", "rejected"]


class PostCreate(BaseModel):
    brand_id: str
    platform: str
    text: str
    campaign_goal: Optional[str] = None
    audience: Optional[str] = None
    content_format: Optional[str] = None
    growth_angle: Optional[str] = None
    status: Literal["draft", "pending"] = "draft"


class PostUpdate(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class PostOut(BaseModel):
    id: str
    brand_id: str
    created_by: Optional[str] = None
    platform: str
    text: str
    status: PostStatus
    campaign_goal: Optional[str] = None
    audience: Optional[str] = None
    content_format: Optional[str] = None
    growth_angle: Optional[str] = None
    rejection_reason: Optional[str] = None
    scheduled_at: Optional[str] = None
    created_at: str
    updated_at: str


class ScheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string, e.g. "2026-05-12T09:00:00+00:00"


class RescheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string, e.g. "2026-05-12T14:00:00+00:00"


class ForceScheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string — no clash check applied
