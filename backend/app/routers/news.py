"""News feed endpoint — fetches RSS articles matched to brand industry."""
from datetime import datetime, timedelta, timezone
from typing import Annotated

import feedparser
import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_supabase
from app.security import current_user

router = APIRouter(prefix="/news", tags=["news"])

CACHE_TTL = timedelta(minutes=15)
_cache: dict[str, tuple[list, datetime]] = {}

# Industry keyword → list of (source_name, rss_url)
INDUSTRY_FEEDS: list[tuple[list[str], list[tuple[str, str]]]] = [
    (
        ["media", "tech", "ott"],
        [
            ("TechCrunch", "https://techcrunch.com/feed/"),
            ("The Verge", "https://www.theverge.com/rss/index.xml"),
            ("Wired", "https://www.wired.com/feed/rss"),
        ],
    ),
    (
        ["marketing", "content", "social"],
        [
            ("Marketing Week", "https://www.marketingweek.com/feed/"),
            ("AdAge", "https://adage.com/rss"),
            ("HubSpot", "https://blog.hubspot.com/marketing/rss.xml"),
        ],
    ),
    (
        ["retail", "fashion", "ecommerce"],
        [
            ("Retail Dive", "https://www.retaildive.com/feeds/news/"),
            ("Business of Fashion", "https://www.businessoffashion.com/rss/"),
        ],
    ),
    (
        ["finance", "fintech"],
        [
            ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
            ("CNBC Finance", "https://www.cnbc.com/id/10000664/device/rss/rss.html"),
        ],
    ),
]

FALLBACK_FEEDS: list[tuple[str, str]] = [
    ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("Reuters", "https://feeds.reuters.com/reuters/topNews"),
]


def _get_feeds_for_industry(industry: str) -> list[tuple[str, str]]:
    industry_lower = industry.lower()
    matched: list[tuple[str, str]] = []
    for keywords, feeds in INDUSTRY_FEEDS:
        if any(kw in industry_lower for kw in keywords):
            matched.extend(feeds)
    return matched if matched else FALLBACK_FEEDS


def _parse_entry(entry: dict, source: str) -> dict | None:
    title = entry.get("title", "").strip()
    url = entry.get("link", "").strip()
    if not title or not url:
        return None
    summary = entry.get("summary", "") or entry.get("description", "")
    import re
    summary = re.sub(r"<[^>]+>", "", summary).strip()[:300]
    published_at = None
    if entry.get("published_parsed"):
        try:
            published_at = datetime(*entry["published_parsed"][:6], tzinfo=timezone.utc).isoformat()
        except Exception:
            pass
    return {
        "title": title,
        "url": url,
        "source": source,
        "summary": summary,
        "published_at": published_at or datetime.now(timezone.utc).isoformat(),
    }


async def _fetch_feed(client: httpx.AsyncClient, source: str, url: str) -> list[dict]:
    try:
        resp = await client.get(url, timeout=8.0, follow_redirects=True)
        resp.raise_for_status()
        parsed = feedparser.parse(resp.text)
        articles = []
        for entry in parsed.entries:
            article = _parse_entry(entry, source)
            if article:
                articles.append(article)
        return articles
    except Exception:
        return []


async def _fetch_all(feeds: list[tuple[str, str]]) -> list[dict]:
    import asyncio
    async with httpx.AsyncClient(headers={"User-Agent": "COP-Platform/1.0"}) as client:
        tasks = [_fetch_feed(client, source, url) for source, url in feeds]
        results = await asyncio.gather(*tasks)
    articles: list[dict] = []
    for batch in results:
        articles.extend(batch)
    articles.sort(key=lambda a: a["published_at"], reverse=True)
    return articles[:30]


@router.get("")
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

    feeds = _get_feeds_for_industry(industry)
    articles = await _fetch_all(feeds)

    _cache[brand_id] = (articles, datetime.now(timezone.utc))
    return articles
