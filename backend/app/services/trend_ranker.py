"""Trend ranking algorithm. Scores headlines by relevance, recency, and learned preferences."""
import math
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any

from app.services.news_provider import Headline

# Maps chip UX labels to semantic search keywords
CHIP_KEYWORD_MAP: dict[str, list[str]] = {
    "Build Brand Awareness": ["brand", "marketing", "visibility", "awareness"],
    "Drive Sign-ups / Leads": ["lead generation", "conversion", "growth", "acquisition"],
    "Showcase Client Work": ["case study", "client", "results", "portfolio"],
    "Educate the Audience": ["education", "tips", "how-to", "explainer", "guide"],
    "Promote an Offer": ["promotion", "offer", "discount", "sale", "launch"],
    "SME Founders": ["SME", "small business", "founder", "entrepreneur"],
    "Marketing Teams": ["marketing", "campaign", "brand", "content"],
    "Tech Decision Makers": ["technology", "enterprise", "software", "CTO", "IT"],
    "C-Suite Executives": ["executive", "leadership", "strategy", "CEO"],
    "Startup Teams": ["startup", "growth", "venture", "scale"],
    "Agency Professionals": ["agency", "client", "creative", "B2B"],
    "Thought Leadership": ["opinion", "insight", "perspective", "industry"],
    "Case Study": ["case study", "results", "client", "success"],
    "Tips & Tactics": ["tips", "tactics", "how-to", "strategy"],
    "Industry Insight": ["industry", "trend", "market", "analysis"],
    "Behind the Scenes": ["behind the scenes", "team", "process", "culture"],
    "Pain Point": ["challenge", "problem", "struggle", "pain"],
    "Industry Trend": ["trend", "market", "emerging", "shift"],
    "Success Story": ["success", "results", "achievement", "growth"],
    "Contrarian Take": ["contrarian", "myth", "wrong", "unpopular"],
    "Data & Stats": ["data", "statistics", "research", "numbers"],
    "Hot Topic": ["viral", "trending", "breaking", "news"],
}

# Scoring weights (must sum to 1.0)
W_RELEVANCE = 0.5
W_RECENCY = 0.3
W_PREFERENCE = 0.2

# Preference boost weights
BOOST_SAVED = 3.0
BOOST_CLICKED = 1.0

# Decay windows in days
DECAY_CLICKED_DAYS = 14
DECAY_SAVED_DAYS = 30
IGNORE_AFTER_DAYS = 90

# Minimum preference boost to earn "picked_for_you" label
PICKED_THRESHOLD = 0.1


def extract_keywords(campaign_goal: str, audience: str, platform: str) -> list[str]:
    """Extract semantic search keywords from post context, expanding chip labels."""
    keywords: set[str] = set()
    for field_value in [campaign_goal, audience]:
        if field_value in CHIP_KEYWORD_MAP:
            keywords.update(CHIP_KEYWORD_MAP[field_value])
        else:
            keywords.update(w.lower() for w in field_value.split() if len(w) > 3)
    return list(keywords)


def compute_relevance(headline: Headline, keywords: list[str]) -> float:
    """Keyword overlap score (0-1) against title + summary combined."""
    if not keywords:
        return 0.0
    text = (headline.title + " " + headline.summary).lower()
    matches = sum(1 for kw in keywords if kw.lower() in text)
    return min(matches / max(len(keywords), 1), 1.0)


def compute_recency(headline: Headline) -> float:
    """Exponential decay score (0-1). Half-life = 24 hours."""
    try:
        pub = datetime.fromisoformat(headline.published_at)
        if pub.tzinfo is None:
            pub = pub.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - pub).total_seconds() / 3600
        return math.exp(-0.693 * age_hours / 24)
    except Exception:
        return 0.0


def compute_preference_boost(headline_url: str, preferences: list[dict[str, Any]]) -> float:
    """Weighted, time-decayed preference boost (0-1 normalised)."""
    now = datetime.now(timezone.utc)
    boost = 0.0
    for pref in preferences:
        if pref["headline_url"] != headline_url:
            continue
        try:
            created = datetime.fromisoformat(pref["created_at"])
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age_days = (now - created).total_seconds() / 86400
            if age_days > IGNORE_AFTER_DAYS:
                continue
            if pref["action"] == "saved":
                if age_days > DECAY_SAVED_DAYS:
                    continue
                weight = BOOST_SAVED
                decay = max(0.0, 1.0 - age_days / DECAY_SAVED_DAYS)
            else:
                if age_days > DECAY_CLICKED_DAYS:
                    continue
                weight = BOOST_CLICKED
                decay = max(0.0, 1.0 - age_days / DECAY_CLICKED_DAYS)
            boost += weight * decay
        except Exception:
            continue
    return min(boost / 3.0, 1.0)


def _title_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def deduplicate_headlines(headlines: list[Headline]) -> list[Headline]:
    """Remove exact URL duplicates and near-duplicate titles (similarity > 0.8)."""
    seen_urls: set[str] = set()
    seen_titles: list[str] = []
    result: list[Headline] = []
    for h in headlines:
        if h.url in seen_urls:
            continue
        if any(_title_similarity(h.title, t) > 0.8 for t in seen_titles):
            continue
        seen_urls.add(h.url)
        seen_titles.append(h.title)
        result.append(h)
    return result


def rank_headlines(
    headlines: list[Headline],
    keywords: list[str],
    preferences: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Score, deduplicate, and return top 5 headlines with labels."""
    deduped = deduplicate_headlines(headlines)
    scored = []
    for h in deduped:
        relevance = compute_relevance(h, keywords)
        recency = compute_recency(h)
        pref_boost = compute_preference_boost(h.url, preferences)
        final_score = W_RELEVANCE * relevance + W_RECENCY * recency + W_PREFERENCE * pref_boost
        label = "picked_for_you" if pref_boost > PICKED_THRESHOLD else "trending"
        scored.append({
            "title": h.title,
            "url": h.url,
            "source": h.source,
            "published_at": h.published_at,
            "summary": h.summary,
            "label": label,
            "score": final_score,
        })
    scored.sort(key=lambda x: x["score"], reverse=True)
    return [
        {k: v for k, v in item.items() if k != "score"}
        for item in scored[:5]
    ]
