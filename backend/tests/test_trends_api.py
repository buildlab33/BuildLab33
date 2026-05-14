import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

MOCK_USER = {"sub": "user-123", "role": "user", "type": "access"}


def auth_header():
    return {"Authorization": "Bearer fake-token"}


def test_get_headlines_requires_auth():
    resp = client.get("/api/trends/headlines?brand_id=brand-456&goal=awareness&audience=founders&platform=linkedin")
    assert resp.status_code == 401


def test_get_headlines_returns_structure():
    mock_headlines = [
        {"title": "AI News", "url": "https://x.com/1", "source": "TC",
         "published_at": "2026-05-14T10:00:00+00:00", "summary": "AI stuff", "label": "trending"}
    ]
    with (
        patch("app.security.decode_token", return_value=MOCK_USER),
        patch("app.routers.trends._check_brand_access", return_value=True),
        patch("app.routers.trends._get_brand_industry", return_value="tech"),
        patch("app.routers.trends._get_user_preferences", return_value=[]),
        patch("app.routers.trends._get_cached_headlines", return_value=None),
        patch("app.routers.trends._fetch_and_cache_headlines", new=AsyncMock(return_value=mock_headlines)),
    ):
        resp = client.get(
            "/api/trends/headlines?brand_id=brand-456&goal=Build+Brand+Awareness&audience=SME+Founders&platform=linkedin",
            headers=auth_header()
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "headlines" in data
    assert "source_status" in data
    assert data["source_status"] in ("ok", "degraded", "unavailable")


def test_post_interaction_requires_auth():
    resp = client.post("/api/trends/interaction", json={
        "brand_id": "brand-456", "headline_url": "https://x.com/1",
        "headline_title": "AI News", "action": "clicked"
    })
    assert resp.status_code == 401


def test_post_interaction_returns_ok():
    with (
        patch("app.security.decode_token", return_value=MOCK_USER),
        patch("app.routers.trends._check_brand_access", return_value=True),
        patch("app.routers.trends._log_interaction", return_value=None),
    ):
        resp = client.post(
            "/api/trends/interaction",
            json={"brand_id": "brand-456", "headline_url": "https://x.com/1",
                  "headline_title": "AI News", "action": "clicked"},
            headers=auth_header()
        )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
