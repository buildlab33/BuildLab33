"""Fetch and extract readable text from URLs for brand voice ingestion."""
import asyncio
import logging
import re
import httpx

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; COPBot/1.0)"}
TIMEOUT = 10.0
MAX_CHARS = 3000  # per URL, truncated to keep prompts sane


def _strip_html(html: str) -> str:
    """Remove tags, scripts, styles, collapse whitespace."""
    html = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&#?\w+;", " ", html)
    html = re.sub(r"\s+", " ", html)
    return html.strip()


async def fetch_url_text(url: str) -> str:
    """Fetch a URL and return extracted plain text, capped at MAX_CHARS."""
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            text = _strip_html(resp.text)
            return text[:MAX_CHARS]
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return ""


async def scrape_urls(urls: list[str]) -> str:
    """Fetch all URLs concurrently and join their text with separators."""
    results = await asyncio.gather(*[fetch_url_text(u) for u in urls])
    parts = [f"[Source: {url}]\n{text}" for url, text in zip(urls, results) if text.strip()]
    return "\n\n---\n\n".join(parts)
