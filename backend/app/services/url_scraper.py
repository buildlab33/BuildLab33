"""Fetch and extract readable text from URLs for brand voice ingestion."""
import asyncio
import logging
import re
import httpx
from app.schemas.brands import SourceResult

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; COPBot/1.0)"}
TIMEOUT = 10.0
MAX_CHARS = 10000  # per source
SHORT_THRESHOLD = 200


def _strip_html(html: str) -> str:
    """Remove tags, scripts, styles, collapse whitespace."""
    html = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&#?\w+;", " ", html)
    html = re.sub(r"\s+", " ", html)
    return html.strip()


async def fetch_url_result(url: str) -> SourceResult:
    """Fetch a single URL and return a SourceResult with warning flags."""
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw = _strip_html(resp.text)
            text = raw[:MAX_CHARS]
            if not text.strip():
                return SourceResult(source_label=url, char_count=0, warning="empty", text="")
            if len(text.strip()) < SHORT_THRESHOLD:
                return SourceResult(source_label=url, char_count=len(text), warning="js_rendered", text=text)
            return SourceResult(source_label=url, char_count=len(text), text=text)
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return SourceResult(source_label=url, char_count=0, warning="empty", text="")


def make_pasted_result(text: str, index: int) -> SourceResult:
    """Wrap pasted text as a SourceResult."""
    capped = text[:MAX_CHARS]
    label = f"Pasted text {index + 1}"
    if not capped.strip():
        return SourceResult(source_label=label, char_count=0, warning="empty", text="")
    if len(capped.strip()) < SHORT_THRESHOLD:
        return SourceResult(source_label=label, char_count=len(capped), warning="short", text=capped)
    return SourceResult(source_label=label, char_count=len(capped), text=capped)


async def analyse_sources(urls: list[str], pasted_texts: list[str]) -> list[SourceResult]:
    """Fetch all URLs concurrently and wrap pasted texts; return per-source results."""
    url_results = await asyncio.gather(*[fetch_url_result(u) for u in urls])
    paste_results = [make_pasted_result(t, i) for i, t in enumerate(pasted_texts)]
    return list(url_results) + paste_results
