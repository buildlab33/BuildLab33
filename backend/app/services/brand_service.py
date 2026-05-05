"""Brand database operations."""
from datetime import datetime, timezone
from typing import Optional
from app.database import get_supabase


def list_brands_for_user(user_id: str, role: str) -> list[dict]:
    """Return brands the user can see. Super Admin/Admin see all active brands."""
    sb = get_supabase()
    if role in ("super_admin", "admin"):
        res = sb.table("brands").select("id, name, industry, logo_url, brand_colour, default_timezone, status").eq("status", "active").execute()
    else:
        assignment_res = sb.table("user_brands").select("brand_id").eq("user_id", user_id).execute()
        brand_ids = [r["brand_id"] for r in (assignment_res.data or [])]
        if not brand_ids:
            return []
        res = sb.table("brands").select("id, name, industry, logo_url, brand_colour, default_timezone, status").in_("id", brand_ids).eq("status", "active").execute()
    return res.data or []


def list_all_brands(include_archived: bool = False) -> list[dict]:
    """Super Admin view — all brands, optionally including archived."""
    sb = get_supabase()
    query = sb.table("brands").select("id, name, industry, logo_url, brand_colour, default_timezone, status, created_at")
    if not include_archived:
        query = query.eq("status", "active")
    return query.execute().data or []


def get_brand(brand_id: str) -> Optional[dict]:
    """Get full brand record by ID."""
    sb = get_supabase()
    res = sb.table("brands").select("*").eq("id", brand_id).limit(1).execute()
    return res.data[0] if res.data else None


def create_brand(data: dict, created_by: str) -> dict:
    """Insert a new brand and return the created record."""
    sb = get_supabase()
    payload = {**data, "created_by": created_by, "status": "active"}
    for key in ("content_pillars", "hashtag_sets"):
        if key in payload and isinstance(payload[key], list):
            payload[key] = [item.model_dump() if hasattr(item, "model_dump") else item for item in payload[key]]
    res = sb.table("brands").insert(payload).execute()
    if not res.data:
        raise RuntimeError("Failed to create brand")
    return res.data[0]


def update_brand(brand_id: str, updates: dict) -> dict:
    """Update brand fields and refresh updated_at."""
    sb = get_supabase()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    for key in ("content_pillars", "hashtag_sets"):
        if key in updates and isinstance(updates.get(key), list):
            updates[key] = [item.model_dump() if hasattr(item, "model_dump") else item for item in updates[key]]
    res = sb.table("brands").update(updates).eq("id", brand_id).execute()
    if not res.data:
        raise RuntimeError("Failed to update brand")
    return res.data[0]


def archive_brand(brand_id: str) -> dict:
    return update_brand(brand_id, {"status": "archived"})


def restore_brand(brand_id: str) -> dict:
    return update_brand(brand_id, {"status": "active"})


def assign_user_to_brand(user_id: str, brand_id: str) -> None:
    sb = get_supabase()
    sb.table("user_brands").upsert({"user_id": user_id, "brand_id": brand_id}).execute()


def remove_user_from_brand(user_id: str, brand_id: str) -> None:
    sb = get_supabase()
    sb.table("user_brands").delete().eq("user_id", user_id).eq("brand_id", brand_id).execute()
