# backend/app/schemas/leads.py
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class DiscoverRequest(BaseModel):
    brand_id: str


class LeadSuggestion(BaseModel):
    name: str
    platform: Literal["instagram", "youtube", "linkedin", "blog", "podcast", "twitter"]
    handle: str
    company: str
    niche: str
    audience_size: str
    fit_score: int = Field(ge=1, le=10)
    reason: str
    outreach_opener: str

    @field_validator("fit_score", mode="before")
    @classmethod
    def coerce_fit_score(cls, v):
        try:
            return max(1, min(10, int(float(str(v).split("/")[0]))))
        except (ValueError, TypeError):
            return 5

    @field_validator("platform", mode="before")
    @classmethod
    def normalise_platform(cls, v):
        return str(v).lower().strip()


class DiscoverResponse(BaseModel):
    leads: list[LeadSuggestion]
