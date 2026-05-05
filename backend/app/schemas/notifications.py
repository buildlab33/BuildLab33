# backend/app/schemas/notifications.py
from typing import Optional
from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: str
    type: str
    message: str
    link: Optional[str] = None
    read: bool
    created_at: str


class MarkReadRequest(BaseModel):
    ids: Optional[list[str]] = None  # None = mark all
