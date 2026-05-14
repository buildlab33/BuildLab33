"""News provider abstraction. Swap implementations without touching the algorithm."""
import asyncio
import logging
import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import feedparser
import httpx
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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


class Headline(BaseModel):
    title: str
    url: str
    source: str
    published_at: str
    summary: str


class NewsProvider(ABC):
    @abstractmethod
    async def fetch_headlines(self, keywords: list[str]) -> list[Headline]:
        """Fetch headlines relevant to the given keywords. Returns [] on failure."""


def get_feeds_for_keywords(keywords: list[str]) -> tuple[list[tuple[str, str]], bool]:
    """Returns (feeds, matched) where matched=False means fallback was used."""
    kw_lower = [k.lower() for k in keywords]
    matched: list[tuple[str, str]] = []
    for industry_kws, feeds in INDUSTRY_FEEDS:
        if any(kw in " ".join(kw_lower) for kw in industry_kws):
            matched.extend(feeds)
    if matched:
        return matched, True
    return FALLBACK_FEEDS, False


def _parse_entry(entry: dict, source: str) -> dict | None:
    title = entry.get("title", "").strip()
    url = entry.get("link", "").strip()
    if not title or not url:
        return None
    if not url.startswith(("http://", "https://")):
        return None
    summary = entry.get("summary", "") or entry.get("description", "")
    summary = re.sub(r"<[^>]+>", "", summary).strip()[:500]
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
        parsed = feedparser.parse(resp.content)
        return [a for e in parsed.entries if (a := _parse_entry(e, source))]
    except Exception as e:
        logger.warning("Feed fetch failed %s: %s", url, e)
        return []


async def _fetch_all(feeds: list[tuple[str, str]]) -> list[dict]:
    async with httpx.AsyncClient(headers={"User-Agent": "COP-Platform/1.0"}) as client:
        results = await asyncio.gather(*[_fetch_feed(client, s, u) for s, u in feeds])
    articles: list[dict] = []
    for batch in results:
        articles.extend(batch)
    articles.sort(key=lambda a: a["published_at"], reverse=True)
    return articles[:50]


class RSSProvider(NewsProvider):
    async def fetch_headlines(self, keywords: list[str]) -> list[Headline]:
        try:
            feeds, _ = get_feeds_for_keywords(keywords)
            articles = await _fetch_all(feeds)
            return [Headline(**a) for a in articles]
        except Exception as e:
            logger.error("RSSProvider failed: %s", e)
            return []
