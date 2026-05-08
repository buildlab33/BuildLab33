# Scheduling / Calendar Subsystem — Design Spec

**Date:** 2026-05-08
**Status:** Approved

---

## Goal

Wire approved posts onto a calendar so content managers can schedule them to specific dates and times, view the content pipeline visually, and reschedule posts without leaving the calendar.

---

## Decisions Made

| Question | Decision |
|---|---|
| Calendar view | Monthly grid (default) + weekly timeline (toggle) |
| Scheduling entry points | Both: from Post Detail page AND by clicking a date on the Calendar |
| Brand filtering | Brand filter pill row at top of calendar; defaults to "All" |
| Click scheduled post | Slide-over panel (reschedule + view link) — no page navigation |

---

## Database

No new tables. The `posts` table already has `scheduled_at timestamptz` and `published_at timestamptz`.

**One migration required:** The current `status` CHECK constraint includes `'removed'` but not `'scheduled'`. Fix:

```sql
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft','pending','approved','scheduled','published','rejected','removed'));
```

The `rejection_reason` column was already added in the Posts subsystem.

---

## Status Flow (full)

```
draft → pending → approved → scheduled → published
                           ↘ rejected (re-editable → resubmit)
```

- `approved → scheduled`: triggered by Schedule action (either entry point)
- `scheduled → scheduled`: Reschedule updates `scheduled_at`, status stays `scheduled`
- `scheduled → approved`: Unschedule removes `scheduled_at` and reverts status to `approved`

---

## Backend

### New endpoints (add to `backend/app/routers/posts.py`)

#### `POST /api/posts/{post_id}/schedule`

- **Auth:** Any authenticated user (own post) or admin
- **Body:** `{ "scheduled_at": "<ISO 8601 datetime>" }`
- **Validation:** Post must be `approved` status. `scheduled_at` must be a future datetime.
- **Action:** Sets `scheduled_at`, changes `status` to `"scheduled"`
- **Returns:** Updated `PostOut`

#### `POST /api/posts/{post_id}/unschedule`

- **Auth:** Any authenticated user (own post) or admin
- **Body:** none
- **Validation:** Post must be `scheduled` status.
- **Action:** Clears `scheduled_at` (sets to NULL), reverts `status` to `"approved"`
- **Returns:** Updated `PostOut`

#### `PATCH /api/posts/{post_id}/reschedule`

- **Auth:** Any authenticated user (own post) or admin
- **Body:** `{ "scheduled_at": "<ISO 8601 datetime>" }`
- **Validation:** Post must be `scheduled` status. `scheduled_at` must be future.
- **Action:** Updates `scheduled_at` only, status stays `"scheduled"`
- **Returns:** Updated `PostOut`

### Existing endpoint already works

`GET /api/posts?status=scheduled` — no changes needed. The calendar fetches all scheduled posts for the current month using this endpoint with optional `brand_id` filter.

### New Pydantic schema (add to `backend/app/schemas/posts.py`)

```python
class ScheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string, validated as future in router

class RescheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string, validated as future in router
```

---

## Frontend

### Files to create / modify

| Action | File | What changes |
|---|---|---|
| Modify | `frontend/lib/api.ts` | Add `schedulePost`, `unschedulePost`, `reschedulePost` functions |
| Replace | `frontend/app/dashboard/calendar/page.tsx` | Full calendar implementation |
| Modify | `frontend/app/dashboard/posts/[id]/page.tsx` | Add Schedule card for approved posts |

### Calendar page — `frontend/app/dashboard/calendar/page.tsx`

**Layout:**
```
[← May 2026 →]  [Month | Week]          [All · Yeon Studios · BeLive Studios]
┌──────────────────── Monthly Grid ──────────────────────────────────────────┐
│  Mon   Tue   Wed   Thu   Fri   Sat   Sun                                   │
│  [ ]   [ ]   [ ]   [●LI] [ ]   [ ]   [ ]                                  │
│  [ ]   [●IG] [ ]   [ ]   [today][ ]  [ ]                                  │
│  ...                                                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

**Top bar:**
- Month navigator: `← {Month Year} →` — clicking arrows shifts month
- View toggle: `Month | Week` buttons (active state styled with `bg-primary-muted text-text-active`)
- Brand filter pills: `All` + one pill per brand from `getBrands()`. Active pill styled same as view toggle.

**Monthly grid:**
- 7-column CSS grid (Mon–Sun header row)
- Each cell: date number + post pills stacked vertically
- Post pill: coloured by brand (brand_colour from brands API), truncated platform + brand name, `cursor-pointer`
- Today's cell: subtle `bg-primary-muted/10` background with bold date
- Empty cell click → opens Schedule Panel (slide-in from right)
- Post pill click → opens Reschedule Slide-over

**Weekly timeline:**
- 8-column grid: time labels (left) + 7 day columns
- Default: current week (Mon–Sun). `← Week →` arrows in top bar replace `← Month →` when in week view.
- Time rows: every 2 hours (8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm)
- Post pills placed at their approximate time slot
- Same click behaviours as monthly

**Schedule Panel** (click empty date — slides in from right, ~360px wide):
- Header: "Schedule for {date}"
- Body: list of all `approved` + unscheduled posts (`GET /api/posts?status=approved`)
- Each post row: brand name · platform · first 60 chars of text
- Click a post row → expands inline time picker (native `<input type="time">`)
- "Schedule" button → calls `POST /posts/:id/schedule` → panel closes → calendar refreshes

**Reschedule Slide-over** (click scheduled post pill — slides in from right):
- Header: brand name · platform · StatusBadge
- Body: first 120 chars of post text (read-only)
- Date picker: `<input type="date">` pre-filled with current `scheduled_at`
- Time picker: `<input type="time">` pre-filled with current time
- "Reschedule" button → calls `PATCH /posts/:id/reschedule` → updates pill in place
- "Unschedule" ghost button → calls `POST /posts/:id/unschedule` → removes pill, reverts to approved
- "View full post →" link → navigates to `/dashboard/posts/[id]`
- Outside click or × button closes the slide-over

**Data loading:**
- On mount + on month/brand change: fetch `GET /api/posts?status=scheduled` (+ `brand_id` if brand filter active)
- On opening Schedule Panel: fetch `GET /api/posts?status=approved` (unscheduled = `scheduled_at` is null, filter client-side)
- No polling — manual refresh after actions

### Post detail page modification — `frontend/app/dashboard/posts/[id]/page.tsx`

Add a **Schedule card** that appears only when `post.status === "approved"`:

```
┌─ Schedule This Post ──────────────────────────────────┐
│  Date: [2026-05-12]   Time: [09:00]   [Schedule →]   │
└───────────────────────────────────────────────────────┘
```

- Native `<input type="date">` and `<input type="time">` inputs
- On submit: calls `POST /posts/:id/schedule` → updates local post state to `scheduled`
- On success: shows the scheduled date/time as read-only text with an "Unschedule" ghost button
- Styled consistent with existing cards on the page

---

## API helpers to add to `frontend/lib/api.ts`

```typescript
export const schedulePost = (id: string, scheduled_at: string) =>
  api.post<PostItem>(`/api/posts/${id}/schedule`, { scheduled_at });

export const unschedulePost = (id: string) =>
  api.post<PostItem>(`/api/posts/${id}/unschedule`);

export const reschedulePost = (id: string, scheduled_at: string) =>
  api.patch<PostItem>(`/api/posts/${id}/reschedule`, { scheduled_at });
```

`PostItem` interface already exists in `api.ts` — add `scheduled_at: string | null` if not already present (it is, from the Posts subsystem).

---

## Out of Scope

- Actual social media publishing (no API integrations with LinkedIn/Instagram/etc.)
- Recurring post schedules
- Drag-and-drop rescheduling on the calendar
- Conflict/clash detection (e.g. two posts on same platform same day) — can be added later
- Push notifications when a post is due

---

## Component Notes

- Slide-over panels: implement as absolute-positioned `div` with `right-0 top-0 h-full w-[360px]` inside a relative wrapper, with a semi-transparent backdrop. Follow the same pattern used by the notification bell panel in `frontend/components/layout/Sidebar.tsx`.
- Brand colours: fetch brands via `getBrands()` and use `brand.brand_colour` for pill colours. Fall back to `--color-primary` if null.
- Date/time inputs: use native HTML `<input type="date">` and `<input type="time">` — styled with the existing border/bg token classes. No date-picker library needed.
