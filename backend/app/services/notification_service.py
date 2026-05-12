"""Notification helpers — insert rows into the notifications table."""
from app.database import get_supabase


def notify_admins(message: str, link: str | None = None) -> None:
    """Insert a notification row for every admin/super_admin user."""
    sb = get_supabase()
    admins = sb.table("users").select("id").in_("role", ["admin", "super_admin"]).execute()
    if not admins.data:
        return
    rows = [
        {"user_id": a["id"], "type": "info", "message": message, "link": link, "read": False}
        for a in admins.data
    ]
    sb.table("notifications").insert(rows).execute()


def notify_user(user_id: str, message: str, link: str | None = None) -> None:
    """Insert a notification row for a specific user."""
    if not user_id:
        return
    sb = get_supabase()
    sb.table("notifications").insert(
        {"user_id": user_id, "type": "info", "message": message, "link": link, "read": False}
    ).execute()
