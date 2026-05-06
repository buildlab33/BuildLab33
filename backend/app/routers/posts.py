# backend/app/routers/posts.py
"""Posts CRUD and approval workflow."""
from datetime import datetime, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import get_supabase
from app.schemas.posts import PostCreate, PostOut, PostUpdate, RejectRequest
from app.security import current_user

router = APIRouter(prefix="/posts", tags=["posts"])

EDITABLE_STATUSES = {"draft", "rejected"}
ADMIN_ROLES = {"admin", "super_admin"}


def _require_admin(user: dict) -> None:
    if user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("", response_model=list[PostOut])
async def list_posts(
    user: Annotated[dict, Depends(current_user)],
    status: Optional[str] = Query(None),
    brand_id: Optional[str] = Query(None),
):
    """List posts. Admins see all; regular users see only their own."""
    sb = get_supabase()
    query = sb.table("posts").select("*").order("created_at", desc=True)
    if user.get("role") not in ADMIN_ROLES:
        query = query.eq("created_by", user["sub"])
    if status:
        query = query.eq("status", status)
    if brand_id:
        query = query.eq("brand_id", brand_id)
    res = query.execute()
    return res.data or []


@router.post("", response_model=PostOut, status_code=201)
async def create_post(body: PostCreate, user: Annotated[dict, Depends(current_user)]):
    """Save a generated post as draft or immediately submit (pending)."""
    sb = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "brand_id": body.brand_id,
        "created_by": user["sub"],
        "platform": body.platform,
        "text": body.text,
        "status": body.status,
        "campaign_goal": body.campaign_goal,
        "audience": body.audience,
        "content_format": body.content_format,
        "growth_angle": body.growth_angle,
        "created_at": now,
        "updated_at": now,
    }
    res = sb.table("posts").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create post")
    return res.data[0]


@router.get("/{post_id}", response_model=PostOut)
async def get_post(post_id: str, user: Annotated[dict, Depends(current_user)]):
    """Return a single post. Users may only fetch their own."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") not in ADMIN_ROLES and post["created_by"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return post


@router.patch("/{post_id}", response_model=PostOut)
async def update_post(post_id: str, body: PostUpdate, user: Annotated[dict, Depends(current_user)]):
    """Edit the text of a draft or rejected post (own only, unless super_admin)."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") != "super_admin":
        if post["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if post["status"] not in EDITABLE_STATUSES:
            raise HTTPException(status_code=400, detail=f"Cannot edit a post with status '{post['status']}'")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({"text": body.text, "updated_at": now}).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]


@router.post("/{post_id}/submit", response_model=PostOut)
async def submit_post(post_id: str, user: Annotated[dict, Depends(current_user)]):
    """Move a draft to pending (own only)."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if post["created_by"] != user["sub"] and user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Access denied")
    if post["status"] != "draft":
        raise HTTPException(status_code=400, detail=f"Only drafts can be submitted (current: {post['status']})")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({"status": "pending", "updated_at": now}).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]


@router.post("/{post_id}/approve", response_model=PostOut)
async def approve_post(post_id: str, user: Annotated[dict, Depends(current_user)]):
    """Move pending -> approved. Admin or Super Admin only."""
    _require_admin(user)
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    allowed_from = {"pending"} if user.get("role") != "super_admin" else {"draft", "pending", "rejected"}
    if post["status"] not in allowed_from:
        raise HTTPException(status_code=400, detail=f"Cannot approve from status '{post['status']}'")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({"status": "approved", "rejection_reason": None, "updated_at": now}).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]


@router.post("/{post_id}/reject", response_model=PostOut)
async def reject_post(post_id: str, body: RejectRequest, user: Annotated[dict, Depends(current_user)]):
    """Move pending -> rejected with reason. Admin or Super Admin only."""
    _require_admin(user)
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    allowed_from = {"pending"} if user.get("role") != "super_admin" else {"draft", "pending", "approved"}
    if post["status"] not in allowed_from:
        raise HTTPException(status_code=400, detail=f"Cannot reject from status '{post['status']}'")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({"status": "rejected", "rejection_reason": body.reason, "updated_at": now}).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]


@router.delete("/{post_id}", status_code=204)
async def delete_post(post_id: str, user: Annotated[dict, Depends(current_user)]):
    """Delete a draft post (own only, or super_admin)."""
    sb = get_supabase()
    res = sb.table("posts").select("id, created_by, status").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") != "super_admin":
        if post["created_by"] != user["sub"]:
            raise HTTPException(status_code=403, detail="Access denied")
        if post["status"] != "draft":
            raise HTTPException(status_code=400, detail="Only draft posts can be deleted")
    sb.table("posts").delete().eq("id", post_id).execute()
