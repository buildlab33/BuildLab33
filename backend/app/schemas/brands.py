"""Pydantic schemas for brand endpoints."""
from typing import Any, Literal, Optional
from pydantic import AnyHttpUrl, BaseModel, Field, field_validator


class ContentPillar(BaseModel):
    name: str
    description: str = ""


class HashtagSet(BaseModel):
    platform: str
    tags: list[str]


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(default="", max_length=80)
    brand_colour: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
    default_timezone: str = Field(default="Asia/Singapore", max_length=50)
    content_pillars: list[ContentPillar] = []
    hashtag_sets: list[HashtagSet] = []
    voice_config: dict[str, Any] = {}


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    industry: Optional[str] = Field(default=None, max_length=80)
    brand_colour: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    default_timezone: Optional[str] = Field(default=None, max_length=50)
    content_pillars: Optional[list[ContentPillar]] = None
    hashtag_sets: Optional[list[HashtagSet]] = None
    voice_config: Optional[dict[str, Any]] = None


class BrandPublic(BaseModel):
    id: str
    name: str
    industry: str = ""
    logo_url: Optional[str] = None
    brand_colour: str = "#6366f1"
    default_timezone: str = "Asia/Singapore"
    status: Literal["active", "archived"] = "active"


class BrandDetail(BrandPublic):
    content_pillars: list[dict[str, Any]] = []
    hashtag_sets: list[dict[str, Any]] = []
    voice_config: dict[str, Any] = {}
    created_at: str
    updated_at: str

    @field_validator("content_pillars", "hashtag_sets", mode="before")
    @classmethod
    def coerce_to_list(cls, v: Any) -> list:
        if isinstance(v, dict):
            return []
        return v or []


class InterviewAnswer(BaseModel):
    question_index: int
    question: str
    answer: str


class GenerateVoiceConfigRequest(BaseModel):
    brand_name: str
    industry: str
    interview_answers: list[InterviewAnswer]
    sample_posts: list[str] = []


class VoiceConfigOut(BaseModel):
    tone_descriptors: list[str]
    content_pillars: list[ContentPillar]
    platform_rules: dict[str, str]
    word_bank: list[str]
    avoid: list[str]
    sample_prompts: list[str]


class IngestUrlsRequest(BaseModel):
    urls: list[AnyHttpUrl] = Field(min_length=1, max_length=10)
    save: bool = False  # if True, auto-save the generated config to the brand


class SourceResult(BaseModel):
    source_label: str           # URL or "Pasted text"
    char_count: int
    warning: str | None = None  # "empty", "short", "js_rendered"
    text: str                   # extracted/pasted text, capped at MAX_CHARS


class AnalyseSourcesRequest(BaseModel):
    urls: list[AnyHttpUrl] = Field(default=[], max_length=10)
    pasted_texts: list[str] = Field(default=[], max_length=10)

    @field_validator("pasted_texts")
    @classmethod
    def cap_pasted_texts(cls, v: list[str]) -> list[str]:
        MAX = 5000
        return [t[:MAX] for t in v]


class AnalyseSourcesResponse(BaseModel):
    sources: list[SourceResult]
    combined_text: str
    total_chars: int
    has_warnings: bool
