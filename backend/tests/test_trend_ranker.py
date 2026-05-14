import pytest
from datetime import datetime, timezone, timedelta
from app.services.trend_ranker import (
    rank_headlines,
    extract_keywords,
    compute_relevance,
    compute_recency,
    deduplicate_headlines,
    CHIP_KEYWORD_MAP,
)
from app.services.news_provider import Headline


def make_headline(title: str, url: str, summary: str = "", hours_ago: int = 1) -> Headline:
    published = (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()
    return Headline(title=title, url=url, source="Test", published_at=published, summary=summary)


def test_chip_keyword_map_covers_all_chip_labels():
    for label in ["Build Brand Awareness", "Drive Sign-ups / Leads", "Showcase Client Work",
                  "Educate the Audience", "Promote an Offer"]:
        assert label in CHIP_KEYWORD_MAP, f"Missing chip label: {label}"


def test_extract_keywords_maps_chip_labels():
    kws = extract_keywords(campaign_goal="Build Brand Awareness", audience="SME Founders", platform="linkedin")
    assert "brand" in kws
    assert "marketing" in kws


def test_extract_keywords_falls_back_to_raw_text():
    kws = extract_keywords(campaign_goal="quantum computing launch", audience="enterprise CTOs", platform="linkedin")
    assert "quantum" in kws
    assert "computing" in kws


def test_compute_relevance_scores_title_and_summary():
    h = make_headline("AI reshapes marketing", "https://x.com/1", summary="Brand marketing with AI tools")
    score = compute_relevance(h, ["marketing", "brand", "AI"])
    assert score > 0.0


def test_compute_relevance_zero_for_no_overlap():
    h = make_headline("Sports results today", "https://x.com/2", summary="Football scores")
    score = compute_relevance(h, ["B2B", "SaaS", "enterprise"])
    assert score == 0.0


def test_compute_recency_recent_scores_higher():
    fresh = make_headline("Fresh news", "https://x.com/3", hours_ago=1)
    old = make_headline("Old news", "https://x.com/4", hours_ago=72)
    assert compute_recency(fresh) > compute_recency(old)


def test_deduplicate_removes_same_url():
    h1 = make_headline("Story A", "https://x.com/same")
    h2 = make_headline("Story A duplicate", "https://x.com/same")
    result = deduplicate_headlines([h1, h2])
    assert len(result) == 1


def test_deduplicate_removes_near_duplicate_titles():
    h1 = make_headline("AI Is Reshaping B2B Sales in Southeast Asia", "https://x.com/5")
    h2 = make_headline("AI Is Reshaping B2B Sales in Southeast Asia Today", "https://x.com/6")
    result = deduplicate_headlines([h1, h2])
    assert len(result) == 1


def test_rank_returns_at_most_5():
    headlines = [make_headline(f"Story {i}", f"https://x.com/{i}") for i in range(20)]
    results = rank_headlines(headlines, keywords=["marketing"], preferences=[])
    assert len(results) <= 5


def test_rank_label_is_trending_with_no_preferences():
    headlines = [make_headline("Marketing trends", "https://x.com/10", summary="Marketing news")]
    results = rank_headlines(headlines, keywords=["marketing"], preferences=[])
    assert results[0]["label"] == "trending"


def test_rank_label_is_picked_for_you_with_strong_preference():
    headlines = [make_headline("Marketing trends", "https://x.com/10", summary="Marketing news")]
    preferences = [
        {"headline_url": "https://x.com/10", "action": "saved",
         "created_at": datetime.now(timezone.utc).isoformat()}
    ]
    results = rank_headlines(headlines, keywords=["marketing"], preferences=preferences)
    assert results[0]["label"] == "picked_for_you"
