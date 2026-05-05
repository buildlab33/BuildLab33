# backend/app/routers/notifications.py
"""Notification endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends

from app.database import get_supabase
from app.schemas.notifications import MarkReadRequest, NotificationOut
from app.security import current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def get_notifications(user: Annotated[dict, Depends(current_user)]):
    """Return last 20 notifications for current user, newest first."""
    sb = get_supabase()
    res = sb.table("notifications").select("*").eq("user_id", user["sub"]).order("created_at", desc=True).limit(20).execute()
    return res.data or []


@router.get("/unread-count")
async def get_unread_count(user: Annotated[dict, Depends(current_user)]):
    """Return count of unread notifications."""
    sb = get_supabase()
    res = sb.table("notifications").select("id", count="exact").eq("user_id", user["sub"]).eq("read", False).execute()
    return {"count": res.count or 0}


@router.post("/mark-read")
async def mark_read(body: MarkReadRequest, user: Annotated[dict, Depends(current_user)]):
    """Mark all or specific notifications as read."""
    sb = get_supabase()
    query = sb.table("notifications").update({"read": True}).eq("user_id", user["sub"])
    if body.ids:
        query = query.in_("id", body.ids)
    query.execute()
    return {"message": "Marked as read"}
