# Outreach + Leads Subsystem — Design Spec

**Date:** 2026-05-08
**Status:** Approved

---

## Goal

Build a lightweight CRM layer so content managers can track contacts through a lead-to-client lifecycle and log outreach activities against them. Replaces the three "Coming Soon" stub pages: Leads, Outreach, and Clients.

---

## Decisions Made

| Question | Decision |
|---|---|
| Lead vs Client | Same contact at different lifecycle stages — one `contacts` table, status tracks the journey |
| Outreach tracking | Current status on contact card + activity log of individual touches |
| Contact fields | Lean set — name, company, role, email, linkedin_url, brand_id, status, notes |
| Leads page layout | Filterable table (not Kanban) |
| Architecture | Single `contacts` table + `outreach_activities` table |

---

## Database

### `contacts` table

```sql
CREATE TABLE contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     text REFERENCES brands(id) ON DELETE SET NULL,
  created_by   uuid NOT NULL,
  name         text NOT NULL,
  company      text,
  role         text,
  email        text,
  linkedin_url text,
  status       text NOT NULL DEFAULT 'lead'
               CHECK (status IN ('lead','contacted','replied','meeting','won','lost','client')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
```

### `outreach_activities` table

```sql
CREATE TABLE outreach_activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id    uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  created_by    uuid NOT NULL,
  channel       text NOT NULL
                CHECK (channel IN ('linkedin','email','call','meeting','other')),
  notes         text NOT NULL,
  activity_date date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

### Status flow

```
lead -> contacted -> replied -> meeting -> won -> client
                                        -> lost (from any stage)
```

---

## Backend

### New file: `backend/app/schemas/contacts.py`

Pydantic models: `ActivityCreate`, `ActivityOut`, `ContactCreate`, `ContactUpdate`, `ContactOut`

- `ContactOut` includes `activities: list[ActivityOut] = []` (populated only on single-contact GET)
- `ContactCreate`: name required, all other fields optional, status defaults to "lead"
- `ContactUpdate`: all fields optional
- `ActivityCreate`: channel (Literal), notes (min 1 char), activity_date (ISO date string "YYYY-MM-DD")

```python
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

### New file: `backend/app/routers/contacts.py`

Router prefix: `/contacts`, tag: `contacts`

Auth pattern: owner (`created_by == user["sub"]`) OR admin (`role in {"admin","super_admin"}`) can write. Any authenticated user can read.

#### Endpoints

| Method | Path | Auth | Action |
|---|---|---|---|
| GET | `/api/contacts` | Any authed | List; optional `?brand_id=`, `?status=`; activities empty |
| POST | `/api/contacts` | Any authed | Create; set `created_by = user["sub"]` |
| GET | `/api/contacts/{contact_id}` | Any authed | Get with full activities list |
| PATCH | `/api/contacts/{contact_id}` | Owner or admin | Update non-null fields; refresh `updated_at` |
| DELETE | `/api/contacts/{contact_id}` | Owner or admin | Delete (cascades activities) |
| POST | `/api/contacts/{contact_id}/activities` | Any authed | Log activity |
| DELETE | `/api/contacts/{contact_id}/activities/{activity_id}` | Activity owner or admin | Delete activity |

### Register in `backend/app/main.py`

```python
from app.routers import contacts
app.include_router(contacts.router, prefix=settings.api_prefix)
```

---

## Frontend

### New file: `frontend/lib/contacts-api.ts`

Separate file (keeps `api.ts` manageable). Imports `api` default export from `./api`.

```typescript
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

export const getContacts = (params?: { brand_id?: string; status?: string }) =>
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

### New component: `frontend/components/domain/ContactSlideOver.tsx`

**Props:** `contactId: string | null`, `mode: "view" | "create"`, `onClose: () => void`, `onUpdated: (c: ContactItem) => void`, `onCreated: (c: ContactItem) => void`

**Behaviour:**
- `mode="view"`: fetches `GET /api/contacts/{contactId}` on open; shows edit fields + activity log + log-activity form
- `mode="create"`: shows create form; on submit calls `POST /api/contacts` then `onCreated`
- Fixed `inset-0` backdrop + `absolute right-0 top-0 h-full w-[420px]` panel
- Outside-click (`mousedown` on backdrop ref) or x button closes
- Same slide-over pattern as `frontend/app/dashboard/calendar/page.tsx`

**Panel sections (view mode):**
1. Header — name, company/role, StatusBadge, x close button
2. Edit fields — name, company, role, email, linkedin_url, brand select, status select, notes. "Save changes" button -> PATCH -> onUpdated
3. Activity log — reverse-chronological. Each entry: activity_date, channel pill, notes, x delete button
4. Log Activity form — date input (default today), channel select, notes textarea, "Log Activity" button

**Status badge colours:**

| Status | Style |
|---|---|
| lead | `text-text-muted bg-surface` |
| contacted | `text-primary bg-primary/10` |
| replied | `text-warning bg-amber-500/10` |
| meeting | `text-info bg-blue-500/10` |
| won | `text-success bg-green-500/10` |
| lost | `text-error bg-red-500/10` |
| client | `text-success font-bold bg-green-500/10` |

**Channel pill colours:**

| Channel | Style |
|---|---|
| linkedin | `bg-primary/15 text-primary` |
| email | `bg-blue-500/15 text-blue-400` |
| call | `bg-amber-500/15 text-amber-400` |
| meeting | `bg-green-500/15 text-green-400` |
| other | `bg-surface text-text-muted` |

### Leads page — `frontend/app/dashboard/leads/page.tsx`

- Fetches `getContacts()` on mount and on filter change
- Status filter pills: All, Lead, Contacted, Replied, Meeting, Won, Lost, Client
- Brand filter dropdown top-right (`getBrands()`)
- Table columns: Name, Company, Role, Status badge, Brand name, Updated date
- Click row -> `ContactSlideOver` in view mode
- "Add Contact" button -> `ContactSlideOver` in create mode
- On create/update: refresh contacts list

### Outreach page — `frontend/app/dashboard/outreach/page.tsx`

- Fetches `getContacts()` with optional brand filter, flattens all activities client-side sorted by `activity_date` descending
- Activity feed rows: activity_date, channel pill, contact name, company, notes (truncated 80 chars)
- Brand filter dropdown top-right
- Click row -> `ContactSlideOver` in view mode for that contact
- "Log Activity" button -> two-step slide-over: (1) contact select dropdown, (2) channel + notes + date -> POST activity
- Empty state if no activities yet

### Clients page — `frontend/app/dashboard/clients/page.tsx`

Identical to Leads page except:
- Always fetches with `?status=client` — no status filter pills
- Page title "Clients", subtitle "Your active client relationships"
- "Add Contact" pre-sets status to "client"

---

## Out of Scope

- Email/LinkedIn sending (log only — no actual message sending)
- Bulk CSV import
- Contact deduplication
- Deal value / revenue tracking
- Assigned user per contact
- Reminders / follow-up scheduling
