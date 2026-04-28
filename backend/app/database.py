"""Supabase client singleton."""
from functools import lru_cache
from supabase import Client, create_client
from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    """Returns a service-role Supabase client for backend use.

    Service role bypasses Row Level Security. Use carefully — only for
    server-side operations that need full access. User-scoped operations
    should pass the user's JWT instead.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env."
        )
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@lru_cache
def get_supabase_anon() -> Client:
    """Returns an anon-key Supabase client. Used for auth flows."""
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_anon_key:
        raise RuntimeError(
            "Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env."
        )
    return create_client(settings.supabase_url, settings.supabase_anon_key)
