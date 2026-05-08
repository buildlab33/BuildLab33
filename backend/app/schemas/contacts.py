# backend/app/schemas/contacts.py
from typing import Literal, Optional
from pydantic import BaseModel, Field


class ActivityCreate(BaseModel):
    channel: Literal["linkedin", "email", "call", "meeting", "other"]
    notes: str = Field(min_length=1, max_length=2000)
    activity_date: str  # ISO date "YYYY-MM-DD"


class ActivityOut(BaseModel):
    id: str
    contact_id: str
    created_by: str
    channel: str
    notes: str
    activity_date: str
    created_at: str


class ContactCreate(BaseModel):
    brand_id: Optional[str] = None
    name: str = Field(min_length=1, max_length=120)
    company: Optional[str] = Field(default=None, max_length=120)
    role: Optional[str] = Field(default=None, max_length=80)
    email: Optional[str] = Field(default=None, max_length=200)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    status: Literal["lead","contacted","replied","meeting","won","lost","client"] = "lead"
    notes: Optional[str] = Field(default=None, max_length=5000)


class ContactUpdate(BaseModel):
    brand_id: Optional[str] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    company: Optional[str] = Field(default=None, max_length=120)
    role: Optional[str] = Field(default=None, max_length=80)
    email: Optional[str] = Field(default=None, max_length=200)
    linkedin_url: Optional[str] = Field(default=None, max_length=500)
    status: Optional[Literal["lead","contacted","replied","meeting","won","lost","client"]] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


class ContactOut(BaseModel):
    id: str
    brand_id: Optional[str] = None
    created_by: str
    name: str
    company: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: str
    updated_at: str
    activities: list[ActivityOut] = []
