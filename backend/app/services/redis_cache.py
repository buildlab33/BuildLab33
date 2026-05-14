"""Thin Redis cache wrapper. Returns None gracefully when Redis is unavailable."""
import json
import logging
from functools import lru_cache
from typing import Any

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_client():
    from app.config import get_settings
    import redis
    settings = get_settings()
    if not settings.redis_url:
        raise RuntimeError("REDIS_URL not configured")
    return redis.from_url(settings.redis_url, decode_responses=True)


def cache_get(key: str) -> Any | None:
    try:
        client = _get_client()
        raw = client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as e:
        logger.warning("Redis get failed for %s: %s", key, e)
        return None


def cache_set(key: str, value: Any, ttl: int = 10800) -> None:
    try:
        client = _get_client()
        client.setex(key, ttl, json.dumps(value))
    except Exception as e:
        logger.warning("Redis set failed for %s: %s", key, e)
