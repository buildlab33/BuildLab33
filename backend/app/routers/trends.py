"""Trend headlines and interaction logging endpoints."""
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_supabase
from app.schemas.trends import TrendHeadline, TrendHeadlinesResponse, TrendInteractionRequest
from app.security import current_user
from app.services.news_provider import Headline, RSSProvider
from app.services.redis_cache import cache_get, cache_set
from app.services.trend_ranker import extract_keywords, rank_headlines

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/trends", tags=["trends"])

CACHE_TTL = 10800  # 3 hours
DEDUP_WINDOW = timedelta(hours=24)

_INJECTION_PATTERNS = re.compile(
    r"(ignore (all )?(previous|prior) instructions?|you are now|system prompt|"
    r"disregard|forget everything|new instruction)",
    re.IGNORECASE,
)


def _sanitise(text: str, max_len: int) -> str:
    text = _INJECTION_PATTERNS.sub("[removed]", text)
    return text[:max_len]


def _check_brand_access(brand_id: str, user_id: str) -> bool:
    sb = get_supabase()
    res = sb.table("brands").select("id").eq("id", brand_id).limit(1).execute()
    return bool(res.data)


def _get_brand_industry(brand_id: str) -> str:
    sb = get_supabase()
    res = sb.table("brands").select("industry").eq("id", brand_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Brand not found")
    return res.data[0].get("industry", "")


def _get_user_preferences(user_id: str, brand_id: str) -> list[dict]:
    sb = get_supabase()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    res = (
        sb.table("trend_preferences")
        .select("headline_url, action, created_at")
        .eq("user_id", user_id)
        .eq("brand_id", brand_id)
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return res.data or []


def _get_cached_headlines(brand_id: str) -> list[dict] | None:
    return cache_get(f"trends:{brand_id}")


async def _fetch_and_cache_headlines(brand_id: str, industry: str, keywords: list[str]) -> list[dict]:
    provider = RSSProvider()
    industry_keywords = [kw for kw in industry.lower().split() if len(kw) > 3]
    all_keywords = list(set(industry_keywords + keywords))
    if not all_keywords:
        all_keywords = ["business", "industry"]
    headlines = await provider.fetch_headlines(all_keywords)
    ranked = rank_headlines(headlines, all_keywords, [])
    cache_set(f"trends:{brand_id}", ranked, ttl=CACHE_TTL)
    return ranked


def _log_interaction(user_id: str, brand_id: str, req: TrendInteractionRequest) -> None:
    sb = get_supabase()
    if req.action == "clicked":
        cutoff = (datetime.now(timezone.utc) - DEDUP_WINDOW).isoformat()
        existing = (
            sb.table("trend_preferences")
            .select("id")
            .eq("user_id", user_id)
            .eq("brand_id", brand_id)
            .eq("headline_url", req.headline_url)
            .eq("action", "clicked")
            .gte("created_at", cutoff)
            .limit(1)
            .execute()
        )
        if existing.data:
            return
        sb.table("trend_preferences").insert({
            "user_id": user_id,
            "brand_id": brand_id,
            "headline_url": req.headline_url,
            "headline_title": req.headline_title,
            "action": "clicked",
        }).execute()
    else:
        existing = (
            sb.table("trend_preferences")
            .select("id")
            .eq("user_id", user_id)
            .eq("brand_id", brand_id)
            .eq("headline_url", req.headline_url)
            .eq("action", "saved")
            .limit(1)
            .execute()
        )
        if existing.data:
            sb.table("trend_preferences").delete().eq("id", existing.data[0]["id"]).execute()
        else:
            sb.table("trend_preferences").insert({
                "user_id": user_id,
                "brand_id": brand_id,
                "headline_url": req.headline_url,
                "headline_title": req.headline_title,
                "action": "saved",
            }).execute()


@router.get("/headlines", response_model=TrendHeadlinesResponse)
async def get_trend_headlines(
    brand_id: str = Query(...),
    goal: str = Query(default=""),
    audience: str = Query(default=""),
    platform: str = Query(default="linkedin"),
    user: Annotated[dict, Depends(current_user)] = None,
):
    user_id = user["sub"]
    if not _check_brand_access(brand_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")

    industry = _get_brand_industry(brand_id)
    keywords = extract_keywords(goal, audience, platform)
    preferences = _get_user_preferences(user_id, brand_id)

    cached = _get_cached_headlines(brand_id)
    if cached is not None:
        re_ranked = rank_headlines(
            [Headline(**h) for h in cached],
            keywords,
            preferences,
        )
        source_status = "ok"
    else:
        try:
            raw = await _fetch_and_cache_headlines(brand_id, industry, keywords)
            re_ranked = raw if not preferences else rank_headlines(
                [Headline(**h) for h in raw], keywords, preferences
            )
            source_status = "ok" if raw else "unavailable"
        except Exception as e:
            logger.error("Trend fetch failed: %s", e)
            re_ranked = []
            source_status = "unavailable"

    return TrendHeadlinesResponse(
        headlines=[TrendHeadline(**h) for h in re_ranked],
        source_status=source_status,
    )


@router.post("/interaction")
async def log_trend_interaction(
    body: TrendInteractionRequest,
    user: Annotated[dict, Depends(current_user)],
):
    user_id = user["sub"]
    if not _check_brand_access(body.brand_id, user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        _log_interaction(user_id, body.brand_id, body)
    except Exception as e:
        logger.warning("Interaction log failed (non-fatal): %s", e)
    return {"ok": True}
