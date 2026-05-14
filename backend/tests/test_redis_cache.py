import json
import pytest
from unittest.mock import MagicMock, patch


def test_get_returns_none_when_key_missing():
    mock_client = MagicMock()
    mock_client.get.return_value = None
    with patch("app.services.redis_cache._get_client", return_value=mock_client):
        from app.services.redis_cache import cache_get
        assert cache_get("missing_key") is None


def test_set_and_get_roundtrip():
    store: dict = {}
    mock_client = MagicMock()
    mock_client.get.side_effect = lambda k: store.get(k)
    mock_client.setex.side_effect = lambda k, ttl, v: store.update({k: v})
    with patch("app.services.redis_cache._get_client", return_value=mock_client):
        from app.services.redis_cache import cache_get, cache_set
        cache_set("my_key", {"foo": "bar"}, ttl=60)
        result = cache_get("my_key")
    assert result == {"foo": "bar"}


def test_get_returns_none_when_redis_unavailable():
    with patch("app.services.redis_cache._get_client", side_effect=Exception("no redis")):
        from app.services.redis_cache import cache_get
        assert cache_get("any_key") is None
