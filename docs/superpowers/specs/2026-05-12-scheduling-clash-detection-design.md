# Scheduling Clash Detection — Design Spec

## Goal

Prevent two posts for the same brand + platform from being scheduled on the same calendar day. When a clash is detected, present a 3-choice modal: Keep Both, Replace, or Pick a Different Time.

---

## Clash Definition

A clash occurs when a post being scheduled shares the same **brand_id**, **platform**, and **calendar day** (date only, not time) as an existing `scheduled` post.

---

## Lifecycle Change: Unschedule → Draft

All unschedule actions — whether triggered manually or via clash replacement — move the post back to `draft` status (not `approved`). The post must go through the full approval workflow again before it can be re-scheduled.

This applies to:
- `POST /posts/{id}/unschedule` (manual unschedule button)
- The Replace flow in the clash modal (unschedule the clashing post)

---

## Backend Changes

### Modified: `POST /posts/{id}/schedule`

Before setting `scheduled_at`, query for existing scheduled posts matching:
- `brand_id` = same as the post being scheduled
- `platform` = same as the post being scheduled
- `scheduled_at` date (calendar day, not time) = same day as the requested `scheduled_at`
- `status` = `"scheduled"`

If a clash is found, return:
```
HTTP 409
{
  "detail": "clash",
  "clashing_post": {
    "id": "...",
    "text": "...",
    "platform": "...",
    "scheduled_at": "..."
  }
}
```

If no clash, schedule normally (set `scheduled_at`, set `status = "scheduled"`).

### Modified: `PATCH /posts/{id}/reschedule`

Same clash check as above, applied to the new requested `scheduled_at`. If clash found, return 409 with same structure. If no clash, update normally.

### Modified: `POST /posts/{id}/unschedule`

Set `status = "draft"` (was `"approved"`). Clear `scheduled_at`.

### New: `POST /posts/{id}/force-schedule`

Schedule the post without clash checking. Sets `scheduled_at` and `status = "scheduled"`. Used by:
- Keep Both (schedule new post ignoring the clash)
- Replace (after clashing post is unscheduled, schedule the new post)

Request body: `{ "scheduled_at": "<ISO datetime>" }`

---

## Frontend Changes

### New component: `ClashModal`

Props:
```typescript
interface ClashModalProps {
  clashingPost: { id: string; text: string; platform: string; scheduled_at: string };
  onKeepBoth: () => Promise<void>;
  onReplace: () => Promise<void>;
  onPickDifferentTime: () => void;
  submitting: boolean;
}
```

Three actions:
1. **Keep both** — calls `force-schedule` on the incoming post, closes modal, refreshes calendar
2. **Replace** — shows inline confirmation text ("This will move this post back to draft. Continue?") with a Confirm button. On confirm: calls `unschedule` on `clashingPost.id`, then calls `force-schedule` on the incoming post, closes modal, refreshes calendar
3. **Pick a different time** — closes modal, returns user to schedule/reschedule panel (time input focused)

The modal displays the clashing post's brand, platform, date/time, and a truncated preview of its text so the user knows what they're replacing.

### Modified: `handleSchedule` in `CalendarPage`

Catch 409 from `schedulePost`:
```typescript
if (error.status === 409 && error.data?.detail === "clash") {
  setClashData({ clashingPost: error.data.clashing_post, pendingPostId: selectedPostId, pendingDateTime: isoDateTime(scheduleDate, scheduleTime) });
  setShowClashModal(true);
}
```

### Modified: `handleReschedule` in `CalendarPage`

Same 409 catch, storing the pending reschedule target.

### Modified: `handleUnschedule` in `CalendarPage`

No UI change needed. Backend now returns the post as `draft` — refreshing `loadPosts()` removes it from the calendar automatically.

### New state in `CalendarPage`

```typescript
const [clashData, setClashData] = useState<{
  clashingPost: { id: string; text: string; platform: string; scheduled_at: string };
  pendingPostId: string;
  pendingDateTime: string;
} | null>(null);
const [showClashModal, setShowClashModal] = useState(false);
const [clashSubmitting, setClashSubmitting] = useState(false);
const [replaceConfirming, setReplaceConfirming] = useState(false);
```

---

## API Helpers (`frontend/lib/api.ts`)

Add:
```typescript
export const forceSchedulePost = (id: string, scheduled_at: string) =>
  api.post<PostItem>(`/api/posts/${id}/force-schedule`, { scheduled_at });
```

---

## Data Flow

```
User picks date + time → handleSchedule / handleReschedule
  → POST /posts/{id}/schedule  (or PATCH reschedule)
  → 200: success → refresh calendar
  → 409: { clashing_post }
       → show ClashModal
            Keep both    → POST /posts/{id}/force-schedule → refresh
            Replace      → confirm inline
                         → POST /posts/{clashing_id}/unschedule (→ draft)
                         → POST /posts/{id}/force-schedule
                         → refresh
            Pick diff time → close modal, return to panel
```

No optimistic updates. All state changes wait for server confirmation.

---

## Out of Scope

- Clash detection across platforms (only same brand + same platform + same day)
- Clash detection for `published` posts
- Bulk scheduling
- Email/push notification on clash
