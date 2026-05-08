# backend/app/routers/contacts.py
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from app.security import current_user
from app.database import get_supabase
from app.schemas.contacts import ActivityCreate, ActivityOut, ContactCreate, ContactOut, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])
ADMIN_ROLES = {"admin", "super_admin"}


def _require_write(contact: dict, user: dict):
    if contact["created_by"] != user["sub"] and user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "Forbidden")


@router.get("", response_model=list[ContactOut])
def list_contacts(
    brand_id: str | None = None,
    status: str | None = None,
    include_activities: bool = False,
    user: Annotated[dict, Depends(current_user)] = None,
):
    sb = get_supabase()
    q = sb.table("contacts").select("*")
    if brand_id:
        q = q.eq("brand_id", brand_id)
    if status:
        q = q.eq("status", status)
    contacts = q.execute().data or []

    if include_activities and contacts:
        ids = [c["id"] for c in contacts]
        acts = sb.table("outreach_activities").select("*").in_("contact_id", ids).execute().data or []
        act_map: dict[str, list] = {}
        for a in acts:
            act_map.setdefault(a["contact_id"], []).append(a)
        for c in contacts:
            c["activities"] = sorted(act_map.get(c["id"], []), key=lambda x: x["activity_date"], reverse=True)
    else:
        for c in contacts:
            c["activities"] = []
    return contacts


@router.post("", response_model=ContactOut, status_code=201)
def create_contact(body: ContactCreate, user: Annotated[dict, Depends(current_user)] = None):
    sb = get_supabase()
    payload = body.model_dump(exclude_none=True)
    payload["created_by"] = user["sub"]
    result = sb.table("contacts").insert(payload).execute()
    row = result.data[0]
    row["activities"] = []
    return row


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, user: Annotated[dict, Depends(current_user)] = None):
    sb = get_supabase()
    result = sb.table("contacts").select("*").eq("id", contact_id).limit(1).execute()
    if not result.data:
        raise HTTPException(404, "Contact not found")
    contact = result.data[0]
    acts = sb.table("outreach_activities").select("*").eq("contact_id", contact_id).order("activity_date", desc=True).execute().data or []
    contact["activities"] = acts
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, body: ContactUpdate, user: Annotated[dict, Depends(current_user)] = None):
    sb = get_supabase()
    existing = sb.table("contacts").select("*").eq("id", contact_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Contact not found")
    _require_write(existing.data[0], user)
    payload = {k: v for k, v in body.model_dump().items() if v is not None}
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = sb.table("contacts").update(payload).eq("id", contact_id).execute()
    row = result.data[0]
    row["activities"] = []
    return row


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: str, user: Annotated[dict, Depends(current_user)] = None):
    sb = get_supabase()
    existing = sb.table("contacts").select("id,created_by").eq("id", contact_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Contact not found")
    _require_write(existing.data[0], user)
    sb.table("contacts").delete().eq("id", contact_id).execute()


@router.post("/{contact_id}/activities", response_model=ActivityOut, status_code=201)
def log_activity(contact_id: str, body: ActivityCreate, user: Annotated[dict, Depends(current_user)] = None):
    sb = get_supabase()
    exists = sb.table("contacts").select("id").eq("id", contact_id).limit(1).execute()
    if not exists.data:
        raise HTTPException(404, "Contact not found")
    payload = body.model_dump()
    payload["contact_id"] = contact_id
    payload["created_by"] = user["sub"]
    result = sb.table("outreach_activities").insert(payload).execute()
    return result.data[0]


@router.delete("/{contact_id}/activities/{activity_id}", status_code=204)
def delete_activity(contact_id: str, activity_id: str, user: Annotated[dict, Depends(current_user)] = None):
    sb = get_supabase()
    existing = sb.table("outreach_activities").select("*").eq("id", activity_id).eq("contact_id", contact_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Activity not found")
    act = existing.data[0]
    if act["created_by"] != user["sub"] and user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "Forbidden")
    sb.table("outreach_activities").delete().eq("id", activity_id).execute()
