# backend/app/routers/leads.py
"""Lead discovery endpoint — AI-powered influencer/partner suggestions."""
import json
import logging
import re
from typing import Annotated

from anthropic import Anthropic, APIError
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import get_supabase
from app.schemas.leads import DiscoverRequest, DiscoverResponse, LeadSuggestion
from app.security import current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"])
limiter = Limiter(key_func=get_remote_address)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _check_brand_access(brand_id: str, user_id: str, user_role: str) -> bool:
    sb = get_supabase()
    if user_role in ("super_admin", "admin"):
        res = sb.table("brands").select("id").eq("id", brand_id).limit(1).execute()
        return bool(res.data)
    res = (
        sb.table("user_brands")
        .select("brand_id")
        .eq("user_id", user_id)
        .eq("brand_id", brand_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _build_prompt(brand: dict) -> str:
    name = brand.get("name", "")
    industry = brand.get("industry", "")

    pillars = brand.get("content_pillars") or []
    pillars_text = ""
    if pillars:
        lines = [f"- {p['name']}: {p.get('description', '')}" for p in pillars]
        pillars_text = "\nContent pillars:\n" + "\n".join(lines)

    hashtags = brand.get("hashtag_sets") or []
    tags_text = ""
    if hashtags:
        all_tags = []
        for hs in hashtags:
            all_tags.extend(hs.get("tags", []))
        if all_tags:
            tags_text = f"\nRelevant hashtags/topics: {', '.join(all_tags[:20])}"

    voice = brand.get("voice_config") or {}
    tone_text = ""
    tone_descriptors = voice.get("tone_descriptors") or []
    if tone_descriptors:
        tone_text = f"\nBrand tone: {', '.join(tone_descriptors)}"

    return f"""You are a partnership strategist for {name}, a brand in the {industry} industry.{pillars_text}{tags_text}{tone_text}

Generate 12 illustrative influencer and partner archetypes that would be ideal collaborators for this brand.
These are fictional archetypes for discovery inspiration — do NOT claim they are real accounts.

Return ONLY a JSON array with exactly this structure per item:
[
  {{
    "name": "First Last",
    "platform": "instagram",
    "handle": "@handle",
    "company": "Company or Channel Name",
    "niche": "Short niche description",
    "audience_size": "45K followers",
    "fit_score": 9,
    "reason": "1-2 sentences explaining why they fit this brand.",
    "outreach_opener": "A personalised first-message opener for this lead (2-3 sentences)."
  }}
]

Platform must be one of: instagram, youtube, linkedin, blog, podcast, twitter.
fit_score must be an integer 1-10.
Return ONLY the JSON array. No explanation, no markdown, no preamble."""


def _parse_suggestions(raw: str) -> list[LeadSuggestion]:
    cleaned = _FENCE_RE.sub("", raw).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=503, detail=f"Failed to parse AI response: {e}")

    if not isinstance(data, list):
        raise HTTPException(status_code=503, detail="AI response was not a list")

    valid: list[LeadSuggestion] = []
    seen_handles: set[str] = set()
    for item in data:
        try:
            lead = LeadSuggestion(**item)
            key = lead.handle.lower().strip()
            if key not in seen_handles:
                seen_handles.add(key)
                valid.append(lead)
        except Exception:
            continue

    if not valid:
        raise HTTPException(status_code=503, detail="No valid suggestions returned — try again")

    return valid


@router.post("/discover", response_model=DiscoverResponse)
@limiter.limit("5/minute")
async def discover_leads(
    request: Request,
    body: DiscoverRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Generate AI-powered influencer/partner suggestions for a brand."""
    if not _check_brand_access(body.brand_id, user["sub"], user.get("role", "")):
        raise HTTPException(status_code=403, detail="You don't have access to this brand")

    sb = get_supabase()
    brand_res = sb.table("brands").select("*").eq("id", body.brand_id).limit(1).execute()
    if not brand_res.data:
        raise HTTPException(status_code=404, detail="Brand not found")

    brand = brand_res.data[0]
    settings = get_settings()

    if not settings.anthropic_api_key:
        # Dev fallback — return mock data without hitting Claude
        mock = [
            LeadSuggestion(
                name="Alex Rivera",
                platform="instagram",
                handle="@alexrivera",
                company="Rivera Media",
                niche=f"{brand.get('industry', 'General')} content creator",
                audience_size="28K followers",
                fit_score=8,
                reason=f"Strong alignment with {brand.get('name', 'your brand')} values and consistent posting cadence.",
                outreach_opener=f"Hi Alex, I've been following your work and think there's a real synergy with {brand.get('name', 'our brand')}. Would love to explore a collaboration.",
            )
        ]
        return DiscoverResponse(leads=mock)

    prompt = _build_prompt(brand)
    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = "".join(block.text for block in msg.content if hasattr(block, "text")).strip()
    except APIError as e:
        logger.error("Anthropic API error in lead discovery: %s", e)
        raise HTTPException(status_code=503, detail="AI service unavailable — try again in a moment")

    leads = _parse_suggestions(raw)
    return DiscoverResponse(leads=leads)
