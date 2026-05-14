"""Pydantic schemas for content generation."""
from typing import Literal
from pydantic import BaseModel, Field

Platform = Literal["instagram", "linkedin", "tiktok", "youtube", "facebook", "x"]


class TrendContext(BaseModel):
    title: str = Field(max_length=200)
    summary: str = Field(max_length=500)


class GenerateRequest(BaseModel):
    brand_id: str
    platform: Platform
    content_format: str = Field(default="", max_length=80)
    campaign_goal: str = Field(min_length=1, max_length=200)
    audience: str = Field(min_length=1, max_length=200)
    growth_angle: str = Field(default="", max_length=2000)
    trend_context: TrendContext | None = None


class GenerateResponse(BaseModel):
    text: str
    platform: Platform
    word_count: int
    char_count: int
    brand_name: str
    model: str
