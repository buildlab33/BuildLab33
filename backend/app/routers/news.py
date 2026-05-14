"""News feed endpoint — delegates fetching to RSSProvider."""
import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_supabase
from app.security import current_user
from app.services.news_provider import RSSProvider

logger = logging.getLogger(__name__)

CACHE_TTL = timedelta(minutes=15)
_cache: dict[str, tuple[list, datetime]] = {}


class NewsArticle(BaseModel):
    title: str
    url: str
    source: str
    summary: str
    published_at: str


router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=list[NewsArticle])
async def get_news(
    brand_id: str,
    user: Annotated[dict, Depends(current_user)],
):
    """Return up to 30 RSS articles matched to the brand's industry."""
    if brand_id in _cache:
        articles, cached_at = _cache[brand_id]
        if datetime.now(timezone.utc) - cached_at < CACHE_TTL:
            return articles

    sb = get_supabase()
    res = sb.table("brands").select("industry").eq("id", brand_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Brand not found")
    industry = res.data[0].get("industry", "")

    provider = RSSProvider()
    keywords = [kw for kw in industry.lower().split() if len(kw) > 3]
    headlines = await provider.fetch_headlines(keywords)
    articles = [h.model_dump() for h in headlines[:30]]

    _cache[brand_id] = (articles, datetime.now(timezone.utc))
    return articles
