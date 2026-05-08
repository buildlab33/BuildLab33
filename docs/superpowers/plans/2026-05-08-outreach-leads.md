# Outreach + Leads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight CRM subsystem — contacts table, outreach activity log, and three live pages (Leads, Outreach, Clients) replacing the current stubs.

**Architecture:** One contacts Supabase table (lead-to-client lifecycle via status field) + one outreach_activities table. FastAPI router at /api/contacts with 7 endpoints. Frontend: shared ContactSlideOver component used by all three pages; Outreach page flattens activities client-side using ?include_activities=true.

**Tech Stack:** FastAPI + Pydantic v2 + Supabase · Next.js 15 App Router · TypeScript · Tailwind CSS v4 tokens · axios

---

## File Map

| Action | File |
|---|---|
| SQL (manual) | Supabase SQL editor — contacts + outreach_activities tables |
| Create | `backend/app/schemas/contacts.py` |
| Create | `backend/app/routers/contacts.py` |
| Modify | `backend/app/main.py` |
| Create | `frontend/lib/contacts-api.ts` |
| Create | `frontend/components/domain/ContactSlideOver.tsx` |
| Create | `frontend/app/dashboard/leads/page.tsx` |
| Create | `frontend/app/dashboard/outreach/page.tsx` |
| Create | `frontend/app/dashboard/clients/page.tsx` |

---

### Task 1: Database migrations (manual Supabase)

**Files:**
- Manual: Supabase SQL editor

- [ ] **Step 1: Open Supabase SQL editor and run the contacts migration**



- [ ] **Step 2: Run the outreach_activities migration**



- [ ] **Step 3: Enable RLS and add policies (run as superuser)**



- [ ] **Step 4: Verify both tables exist in Supabase Table Editor**

Check that contacts and outreach_activities appear with correct columns.


---

### Task 2: Pydantic schemas

**Files:**
- Create: `backend/app/schemas/contacts.py`

- [ ] **Step 1: Create the schemas file**

```python
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
```

- [ ] **Step 2: Verify no import errors**

Run from backend: `python -c "from app.schemas.contacts import ContactOut; print(ContactOut)"`

Expected: `<class 'app.schemas.contacts.ContactOut'>`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/contacts.py
git commit -m "feat: contacts Pydantic schemas"
```


---

### Task 3: FastAPI contacts router + register in main.py

**Files:**
- Create: `backend/app/routers/contacts.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create the router file**

```python
# backend/app/routers/contacts.py
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user
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
    user: dict = Depends(get_current_user),
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
def create_contact(body: ContactCreate, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    payload = body.model_dump(exclude_none=True)
    payload["created_by"] = user["sub"]
    result = sb.table("contacts").insert(payload).execute()
    row = result.data[0]
    row["activities"] = []
    return row


@router.get("/{contact_id}", response_model=ContactOut)
def get_contact(contact_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    result = sb.table("contacts").select("*").eq("id", contact_id).limit(1).execute()
    if not result.data:
        raise HTTPException(404, "Contact not found")
    contact = result.data[0]
    acts = sb.table("outreach_activities").select("*").eq("contact_id", contact_id).order("activity_date", desc=True).execute().data or []
    contact["activities"] = acts
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
def update_contact(contact_id: str, body: ContactUpdate, user: dict = Depends(get_current_user)):
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
def delete_contact(contact_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("contacts").select("id,created_by").eq("id", contact_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Contact not found")
    _require_write(existing.data[0], user)
    sb.table("contacts").delete().eq("id", contact_id).execute()


@router.post("/{contact_id}/activities", response_model=ActivityOut, status_code=201)
def log_activity(contact_id: str, body: ActivityCreate, user: dict = Depends(get_current_user)):
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
def delete_activity(contact_id: str, activity_id: str, user: dict = Depends(get_current_user)):
    sb = get_supabase()
    existing = sb.table("outreach_activities").select("*").eq("id", activity_id).eq("contact_id", contact_id).limit(1).execute()
    if not existing.data:
        raise HTTPException(404, "Activity not found")
    act = existing.data[0]
    if act["created_by"] != user["sub"] and user.get("role") not in ADMIN_ROLES:
        raise HTTPException(403, "Forbidden")
    sb.table("outreach_activities").delete().eq("id", activity_id).execute()
```

- [ ] **Step 2: Register the router in main.py**

Open `backend/app/main.py`. Find the block where other routers are included (e.g. `app.include_router(posts.router, ...)`). Add after the last include_router line:

```python
from app.routers import contacts
app.include_router(contacts.router, prefix=settings.api_prefix)
```

- [ ] **Step 3: Smoke-test the endpoint**

Start backend, then:
```bash
curl -s -H "Authorization: Bearer <token>" http://localhost:8000/api/contacts | python3 -m json.tool
```
Expected: empty array `[]` (200 OK).

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/contacts.py backend/app/main.py
git commit -m "feat: contacts FastAPI router, 7 endpoints"
```


---

### Task 4: Frontend contacts-api.ts

**Files:**
- Create: `frontend/lib/contacts-api.ts`

- [ ] **Step 1: Create the API helpers file**

```typescript
// frontend/lib/contacts-api.ts
import api from "./api";

export type ContactStatus = "lead" | "contacted" | "replied" | "meeting" | "won" | "lost" | "client";
export type ActivityChannel = "linkedin" | "email" | "call" | "meeting" | "other";

export interface ActivityItem {
  id: string;
  contact_id: string;
  created_by: string;
  channel: ActivityChannel;
  notes: string;
  activity_date: string;
  created_at: string;
}

export interface ContactItem {
  id: string;
  brand_id: string | null;
  created_by: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  status: ContactStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  activities: ActivityItem[];
}

export const getContacts = (params?: { brand_id?: string; status?: string; include_activities?: boolean }) =>
  api.get<ContactItem[]>("/api/contacts", { params });

export const getContact = (id: string) =>
  api.get<ContactItem>(`/api/contacts/${id}`);

export const createContact = (data: Partial<ContactItem>) =>
  api.post<ContactItem>("/api/contacts", data);

export const updateContact = (id: string, data: Partial<ContactItem>) =>
  api.patch<ContactItem>(`/api/contacts/${id}`, data);

export const deleteContact = (id: string) =>
  api.delete(`/api/contacts/${id}`);

export const logActivity = (
  contact_id: string,
  data: { channel: ActivityChannel; notes: string; activity_date: string }
) => api.post<ActivityItem>(`/api/contacts/${contact_id}/activities`, data);

export const deleteActivity = (contact_id: string, activity_id: string) =>
  api.delete(`/api/contacts/${contact_id}/activities/${activity_id}`);
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -20`

Expected: no errors referencing contacts-api.ts.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/contacts-api.ts
git commit -m "feat: contacts frontend API helpers"
```


---

### Task 5: ContactSlideOver shared component

**Files:**
- Create: `frontend/components/domain/ContactSlideOver.tsx`

Reference the slide-over pattern in `frontend/app/dashboard/calendar/page.tsx` for backdrop + panel structure.

- [ ] **Step 1: Create the component**

```typescript
// frontend/components/domain/ContactSlideOver.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import {
  ActivityChannel, ActivityItem, ContactItem, ContactStatus,
  createContact, deleteActivity, getContact, logActivity, updateContact,
} from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";

interface Brand { id: string; name: string }

const STATUS_OPTIONS: ContactStatus[] = ["lead","contacted","replied","meeting","won","lost","client"];
const CHANNEL_OPTIONS: ActivityChannel[] = ["linkedin","email","call","meeting","other"];

const STATUS_STYLE: Record<ContactStatus, string> = {
  lead:      "text-text-muted bg-surface",
  contacted: "text-primary bg-primary/10",
  replied:   "text-warning bg-amber-500/10",
  meeting:   "text-info bg-blue-500/10",
  won:       "text-success bg-green-500/10",
  lost:      "text-error bg-red-500/10",
  client:    "text-success font-bold bg-green-500/10",
};

const CHANNEL_STYLE: Record<ActivityChannel, string> = {
  linkedin: "bg-primary/15 text-primary",
  email:    "bg-blue-500/15 text-blue-400",
  call:     "bg-amber-500/15 text-amber-400",
  meeting:  "bg-green-500/15 text-green-400",
  other:    "bg-surface text-text-muted",
};

interface Props {
  contactId: string | null;
  mode: "view" | "create";
  initialStatus?: ContactStatus;
  onClose: () => void;
  onUpdated: (c: ContactItem) => void;
  onCreated: (c: ContactItem) => void;
}

export default function ContactSlideOver({ contactId, mode, initialStatus, onClose, onUpdated, onCreated }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [contact, setContact] = useState<ContactItem | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const [status, setStatus] = useState<ContactStatus>(initialStatus ?? "lead");
  const [notes, setNotes] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [actDate, setActDate] = useState(today);
  const [actChannel, setActChannel] = useState<ActivityChannel>("linkedin");
  const [actNotes, setActNotes] = useState("");
  const [actSaving, setActSaving] = useState(false);

  useEffect(() => {
    getBrands().then(r => setBrands(r.data ?? [])).catch(() => {});
    if (mode === "view" && contactId) {
      getContact(contactId).then(r => {
        const c = r.data;
        setContact(c);
        setName(c.name);
        setCompany(c.company ?? "");
        setRole(c.role ?? "");
        setEmail(c.email ?? "");
        setLinkedin(c.linkedin_url ?? "");
        setBrandId(c.brand_id ?? "");
        setStatus(c.status);
        setNotes(c.notes ?? "");
      });
    }
  }, [contactId, mode]);

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        name, company: company || null, role: role || null,
        email: email || null, linkedin_url: linkedin || null,
        brand_id: brandId || null, status, notes: notes || null,
      };
      if (mode === "create") {
        const r = await createContact(payload);
        onCreated(r.data);
      } else if (contactId) {
        const r = await updateContact(contactId, payload);
        onUpdated(r.data);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLogActivity() {
    if (!contactId || !actNotes.trim()) return;
    setActSaving(true);
    try {
      await logActivity(contactId, { channel: actChannel, notes: actNotes, activity_date: actDate });
      const r = await getContact(contactId);
      setContact(r.data);
      setActNotes("");
      setActDate(today);
    } finally {
      setActSaving(false);
    }
  }

  async function handleDeleteActivity(activityId: string) {
    if (!contactId) return;
    await deleteActivity(contactId, activityId);
    const r = await getContact(contactId);
    setContact(r.data);
  }

  return (
    <div ref={backdropRef} className="fixed inset-0 z-50 bg-black/40" onMouseDown={handleBackdropMouseDown}>
      <div className="absolute right-0 top-0 h-full w-[420px] bg-background overflow-y-auto flex flex-col shadow-xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text">{mode === "create" ? "Add Contact" : (name || "Contact")}</h2>
            {mode === "view" && (company || role) && (
              <p className="text-sm text-text-muted">{[role, company].filter(Boolean).join(" @ ")}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === "view" && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[status]}`}>{status}</span>
            )}
            <button onClick={onClose} className="text-text-muted hover:text-text transition-colors text-xl leading-none">&times;</button>
          </div>
        </div>
        <div className="p-5 border-b border-border space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Company</label>
              <input value={company} onChange={e => setCompany(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Role</label>
              <input value={role} onChange={e => setRole(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">LinkedIn URL</label>
            <input value={linkedin} onChange={e => setLinkedin(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Brand</label>
              <div className="relative">
                <select value={brandId} onChange={e => setBrandId(e.target.value)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                  <option value="">None</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-text-muted uppercase tracking-wide">Status</label>
              <div className="relative">
                <select value={status} onChange={e => setStatus(e.target.value as ContactStatus)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text resize-none" />
          </div>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : mode === "create" ? "Create Contact" : "Save changes"}
          </button>
        </div>
        {mode === "view" && contact && (
          <>
            <div className="p-5 border-b border-border">
              <h3 className="text-sm font-semibold text-text mb-3">Activity Log</h3>
              {contact.activities.length === 0 ? (
                <p className="text-sm text-text-muted">No activities logged yet.</p>
              ) : (
                <div className="space-y-3">
                  {contact.activities.map((a: ActivityItem) => (
                    <div key={a.id} className="flex gap-3 items-start">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${CHANNEL_STYLE[a.channel as ActivityChannel]}`}>{a.channel}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-muted">{a.activity_date}</p>
                        <p className="text-sm text-text break-words">{a.notes}</p>
                      </div>
                      <button onClick={() => handleDeleteActivity(a.id)} className="text-text-muted hover:text-error transition-colors text-sm leading-none flex-shrink-0">&times;</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <h3 className="text-sm font-semibold text-text">Log Activity</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Date</label>
                  <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Channel</label>
                  <div className="relative">
                    <select value={actChannel} onChange={e => setActChannel(e.target.value as ActivityChannel)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                      {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
                <textarea value={actNotes} onChange={e => setActNotes(e.target.value)} rows={2} placeholder="What happened?" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text resize-none" />
              </div>
              <button onClick={handleLogActivity} disabled={actSaving || !actNotes.trim()} className="w-full bg-surface border border-border text-text rounded-lg py-2 text-sm font-medium hover:bg-surface/80 disabled:opacity-50 transition-colors">
                {actSaving ? "Logging..." : "Log Activity"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep ContactSlideOver`

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/ContactSlideOver.tsx
git commit -m "feat: ContactSlideOver shared slide-over component"
```


---

### Task 6: Leads page

**Files:**
- Create: `frontend/app/dashboard/leads/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// frontend/app/dashboard/leads/page.tsx
"use client";
import { useEffect, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ContactItem, ContactStatus, getContacts } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";

interface Brand { id: string; name: string }

const STATUS_OPTIONS: ContactStatus[] = ["lead","contacted","replied","meeting","won","lost","client"];

const STATUS_STYLE: Record<ContactStatus, string> = {
  lead:      "text-text-muted bg-surface border border-border",
  contacted: "text-primary bg-primary/10",
  replied:   "text-warning bg-amber-500/10",
  meeting:   "text-info bg-blue-500/10",
  won:       "text-success bg-green-500/10",
  lost:      "text-error bg-red-500/10",
  client:    "text-success font-bold bg-green-500/10",
};

export default function LeadsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterStatus, setFilterStatus] = useState<ContactStatus | "all">("all");
  const [filterBrand, setFilterBrand] = useState("");
  const [slideOver, setSlideOver] = useState<{ contactId: string | null; mode: "view" | "create" } | null>(null);

  async function load() {
    const params: Record<string, string> = {};
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterBrand) params.brand_id = filterBrand;
    const r = await getContacts(params);
    setContacts(r.data ?? []);
  }

  useEffect(() => { load(); }, [filterStatus, filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data ?? [])).catch(() => {}); }, []);

  function brandName(id: string | null) {
    if (!id) return "—";
    return brands.find(b => b.id === id)?.name ?? "—";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Leads</h1>
          <p className="text-sm text-text-muted mt-1">Track and manage your prospects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <button onClick={() => setSlideOver({ contactId: null, mode: "create" })} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Add Contact
          </button>
        </div>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterStatus("all")} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filterStatus === "all" ? "bg-primary text-white" : "bg-surface text-text-muted border border-border hover:border-primary"}`}>
          All
        </button>
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-sm font-medium transition-colors capitalize ${filterStatus === s ? "bg-primary text-white" : "bg-surface text-text-muted border border-border hover:border-primary"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">No contacts found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Brand</th>
                <th className="text-left px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} onClick={() => setSlideOver({ contactId: c.id, mode: "view" })} className="border-b border-border last:border-0 hover:bg-background transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                  <td className="px-4 py-3 text-text-muted">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{c.role ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLE[c.status as ContactStatus]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{brandName(c.brand_id)}</td>
                  <td className="px-4 py-3 text-text-muted">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {slideOver && (
        <ContactSlideOver
          contactId={slideOver.contactId}
          mode={slideOver.mode}
          onClose={() => setSlideOver(null)}
          onUpdated={updated => { load(); setSlideOver({ contactId: updated.id, mode: "view" }); }}
          onCreated={() => { load(); setSlideOver(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep leads`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/leads/page.tsx
git commit -m "feat: Leads page — filterable contacts table"
```


---

### Task 7: Outreach page

**Files:**
- Create: `frontend/app/dashboard/outreach/page.tsx`

The "Log Activity" button opens an inline modal (not ContactSlideOver). The modal has two steps: (1) pick a contact, (2) fill channel + notes + date.

- [ ] **Step 1: Create the page**

```typescript
// frontend/app/dashboard/outreach/page.tsx
"use client";
import { useEffect, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ActivityChannel, ActivityItem, ContactItem, getContacts, logActivity } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";

interface Brand { id: string; name: string }
interface FlatActivity extends ActivityItem {
  contact: ContactItem;
}

const CHANNEL_STYLE: Record<ActivityChannel, string> = {
  linkedin: "bg-primary/15 text-primary",
  email:    "bg-blue-500/15 text-blue-400",
  call:     "bg-amber-500/15 text-amber-400",
  meeting:  "bg-green-500/15 text-green-400",
  other:    "bg-surface text-text-muted",
};
const CHANNEL_OPTIONS: ActivityChannel[] = ["linkedin","email","call","meeting","other"];

export default function OutreachPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState("");
  const [viewContactId, setViewContactId] = useState<string | null>(null);
  const [logModal, setLogModal] = useState(false);
  const [logStep, setLogStep] = useState<1 | 2>(1);
  const [logContactId, setLogContactId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [logDate, setLogDate] = useState(today);
  const [logChannel, setLogChannel] = useState<ActivityChannel>("linkedin");
  const [logNotes, setLogNotes] = useState("");
  const [logSaving, setLogSaving] = useState(false);

  async function load() {
    const params: Record<string, string | boolean> = { include_activities: true };
    if (filterBrand) params.brand_id = filterBrand;
    const r = await getContacts(params as Parameters<typeof getContacts>[0]);
    setContacts(r.data ?? []);
  }

  useEffect(() => { load(); }, [filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data ?? [])).catch(() => {}); }, []);

  const activities: FlatActivity[] = contacts
    .flatMap(c => (c.activities ?? []).map(a => ({ ...a, contact: c })))
    .sort((a, b) => b.activity_date.localeCompare(a.activity_date));

  function openLogModal() {
    setLogStep(1);
    setLogContactId("");
    setLogDate(today);
    setLogChannel("linkedin");
    setLogNotes("");
    setLogModal(true);
  }

  async function submitLog() {
    if (!logContactId || !logNotes.trim()) return;
    setLogSaving(true);
    try {
      await logActivity(logContactId, { channel: logChannel, notes: logNotes, activity_date: logDate });
      await load();
      setLogModal(false);
    } finally {
      setLogSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Outreach</h1>
          <p className="text-sm text-text-muted mt-1">Activity log across all contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <button onClick={openLogModal} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Log Activity
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border p-12 text-center text-text-muted text-sm">
          No activities logged yet.
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Channel</th>
                <th className="text-left px-4 py-3">Contact</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {activities.map(a => (
                <tr key={a.id} onClick={() => setViewContactId(a.contact.id)} className="border-b border-border last:border-0 hover:bg-background transition-colors cursor-pointer">
                  <td className="px-4 py-3 text-text-muted whitespace-nowrap">{a.activity_date}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_STYLE[a.channel as ActivityChannel]}`}>{a.channel}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-text">{a.contact.name}</td>
                  <td className="px-4 py-3 text-text-muted">{a.contact.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted max-w-xs truncate">{a.notes.length > 80 ? a.notes.slice(0, 80) + "…" : a.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Activity inline modal */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onMouseDown={e => { if (e.target === e.currentTarget) setLogModal(false); }}>
          <div className="bg-background rounded-xl border border-border w-full max-w-md p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">{logStep === 1 ? "Select Contact" : "Log Activity"}</h2>
              <button onClick={() => setLogModal(false)} className="text-text-muted hover:text-text text-xl leading-none">&times;</button>
            </div>
            {logStep === 1 ? (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Contact</label>
                  <div className="relative">
                    <select value={logContactId} onChange={e => setLogContactId(e.target.value)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                      <option value="">Select a contact…</option>
                      {contacts.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ""}</option>)}
                    </select>
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                  </div>
                </div>
                <button onClick={() => logContactId && setLogStep(2)} disabled={!logContactId} className="w-full bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  Next
                </button>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-text-muted uppercase tracking-wide">Date</label>
                    <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-text-muted uppercase tracking-wide">Channel</label>
                    <div className="relative">
                      <select value={logChannel} onChange={e => setLogChannel(e.target.value as ActivityChannel)} className="w-full appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
                        {CHANNEL_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-text-muted uppercase tracking-wide">Notes</label>
                  <textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={3} placeholder="What happened?" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setLogStep(1)} className="flex-1 bg-surface border border-border text-text rounded-lg py-2 text-sm font-medium hover:bg-background transition-colors">
                    Back
                  </button>
                  <button onClick={submitLog} disabled={logSaving || !logNotes.trim()} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {logSaving ? "Saving..." : "Log Activity"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {viewContactId && (
        <ContactSlideOver
          contactId={viewContactId}
          mode="view"
          onClose={() => setViewContactId(null)}
          onUpdated={() => { load(); }}
          onCreated={() => {}}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep outreach`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/outreach/page.tsx
git commit -m "feat: Outreach page — activity feed + log activity modal"
```


---

### Task 8: Clients page

**Files:**
- Create: `frontend/app/dashboard/clients/page.tsx`

Identical to Leads page but always fetches `?status=client`, no status filter pills, and "Add Contact" pre-sets status to "client".

- [ ] **Step 1: Create the page**

```typescript
// frontend/app/dashboard/clients/page.tsx
"use client";
import { useEffect, useState } from "react";
import ContactSlideOver from "@/components/domain/ContactSlideOver";
import { ContactItem, getContacts } from "@/lib/contacts-api";
import { getBrands } from "@/lib/api";

interface Brand { id: string; name: string }

export default function ClientsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [filterBrand, setFilterBrand] = useState("");
  const [slideOver, setSlideOver] = useState<{ contactId: string | null; mode: "view" | "create" } | null>(null);

  async function load() {
    const params: Record<string, string> = { status: "client" };
    if (filterBrand) params.brand_id = filterBrand;
    const r = await getContacts(params);
    setContacts(r.data ?? []);
  }

  useEffect(() => { load(); }, [filterBrand]);
  useEffect(() => { getBrands().then(r => setBrands(r.data ?? [])).catch(() => {}); }, []);

  function brandName(id: string | null) {
    if (!id) return "—";
    return brands.find(b => b.id === id)?.name ?? "—";
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Clients</h1>
          <p className="text-sm text-text-muted mt-1">Your active client relationships</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <button onClick={() => setSlideOver({ contactId: null, mode: "create" })} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Add Client
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {contacts.length === 0 ? (
          <div className="p-12 text-center text-text-muted text-sm">No clients yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Company</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Brand</th>
                <th className="text-left px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map(c => (
                <tr key={c.id} onClick={() => setSlideOver({ contactId: c.id, mode: "view" })} className="border-b border-border last:border-0 hover:bg-background transition-colors cursor-pointer">
                  <td className="px-4 py-3 font-medium text-text">{c.name}</td>
                  <td className="px-4 py-3 text-text-muted">{c.company ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{c.role ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-3 text-text-muted">{brandName(c.brand_id)}</td>
                  <td className="px-4 py-3 text-text-muted">{new Date(c.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {slideOver && (
        <ContactSlideOver
          contactId={slideOver.contactId}
          mode={slideOver.mode}
          initialStatus="client"
          onClose={() => setSlideOver(null)}
          onUpdated={updated => { load(); setSlideOver({ contactId: updated.id, mode: "view" }); }}
          onCreated={() => { load(); setSlideOver(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep clients`

Expected: no output.

- [ ] **Step 3: Confirm stub pages are replaced**

Verify `frontend/app/dashboard/clients/`, `leads/`, and `outreach/` each have a `page.tsx` (not just a "Coming Soon" stub). Check git status shows new files.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/clients/page.tsx
git commit -m "feat: Clients page — contacts filtered to client status"
```

---

## Done

All 8 tasks complete. The full subsystem is live:

- `contacts` and `outreach_activities` tables in Supabase
- `GET/POST/PATCH/DELETE /api/contacts` + `POST/DELETE /api/contacts/{id}/activities`
- `frontend/lib/contacts-api.ts` — typed API helpers
- `frontend/components/domain/ContactSlideOver.tsx` — shared view/create panel
- `frontend/app/dashboard/leads/page.tsx` — filterable table with status pills
- `frontend/app/dashboard/outreach/page.tsx` — activity feed + inline Log Activity modal
- `frontend/app/dashboard/clients/page.tsx` — client-only contacts view

