import pytest
from unittest.mock import AsyncMock, patch
from app.services.news_provider import RSSProvider, Headline


@pytest.mark.asyncio
async def test_rss_provider_returns_headlines():
    mock_articles = [
        {"title": "AI in Retail", "url": "https://example.com/1", "source": "TechCrunch",
         "summary": "AI is changing retail.", "published_at": "2026-05-14T10:00:00+00:00"},
    ]
    with patch("app.services.news_provider._fetch_all", new=AsyncMock(return_value=mock_articles)):
        provider = RSSProvider()
        headlines = await provider.fetch_headlines(["retail", "AI"])
    assert len(headlines) == 1
    assert isinstance(headlines[0], Headline)
    assert headlines[0].title == "AI in Retail"


@pytest.mark.asyncio
async def test_rss_provider_returns_empty_on_failure():
    with patch("app.services.news_provider._fetch_all", new=AsyncMock(side_effect=Exception("fail"))):
        provider = RSSProvider()
        headlines = await provider.fetch_headlines(["retail"])
    assert headlines == []


def test_headline_has_required_fields():
    h = Headline(
        title="Test", url="https://x.com", source="BBC",
        published_at="2026-05-14T10:00:00+00:00", summary="A summary"
    )
    assert h.title == "Test"
    assert h.summary == "A summary"
