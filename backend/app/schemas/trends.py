"""Pydantic schemas for trend endpoints."""
from typing import Literal
from pydantic import BaseModel, Field


class TrendHeadline(BaseModel):
    title: str
    url: str
    source: str
    published_at: str
    summary: str
    label: Literal["picked_for_you", "trending"]


class TrendHeadlinesResponse(BaseModel):
    headlines: list[TrendHeadline]
    source_status: Literal["ok", "degraded", "unavailable"]


class TrendInteractionRequest(BaseModel):
    brand_id: str
    headline_url: str = Field(max_length=2000)
    headline_title: str = Field(max_length=300)
    action: Literal["clicked", "saved"]
