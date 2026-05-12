# Scheduling Clash Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent two posts for the same brand + platform being scheduled on the same calendar day; when a clash is detected return a 409, and present a 3-choice modal (Keep Both, Replace, Pick a Different Time) on the frontend.

**Architecture:** Backend adds clash detection to `schedule` and `reschedule` endpoints, returning a structured 409; a new `force-schedule` endpoint bypasses the check; `unschedule` is changed to return posts to `draft` instead of `approved`. Frontend adds a `ClashModal` component and wires 409 handling into both scheduling flows on the Calendar page.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, Supabase (PostgreSQL); Next.js 16 App Router, TypeScript, Tailwind CSS v4.

---

## File Map

| File | Change |
|---|---|
| `backend/app/schemas/posts.py` | Add `ForceScheduleRequest` schema |
| `backend/app/routers/posts.py` | Modify `schedule_post`, `unschedule_post`, `reschedule_post`; add `force_schedule_post` |
| `frontend/lib/api.ts` | Add `forceSchedulePost` helper |
| `frontend/components/domain/ClashModal.tsx` | New component |
| `frontend/app/dashboard/calendar/page.tsx` | Add clash state, 409 handling, render `ClashModal` |

---

## Task 1: Backend — `ForceScheduleRequest` schema

**Files:**
- Modify: `backend/app/schemas/posts.py`

- [ ] **Step 1: Add `ForceScheduleRequest` to the schemas file**

Open `backend/app/schemas/posts.py`. The file currently ends at line 50 with `RescheduleRequest`. Add this class at the bottom:

```python
class ForceScheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string — no clash check applied
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
cd backend
python -c "from app.schemas.posts import ForceScheduleRequest; print('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/posts.py
git commit -m "feat: add ForceScheduleRequest schema"
```

---

## Task 2: Backend — clash detection helper

**Files:**
- Modify: `backend/app/routers/posts.py`

The clash check logic is needed by two endpoints (`schedule` and `reschedule`). Extract it as a module-level helper function to avoid duplication.

- [ ] **Step 1: Add the helper function**

In `backend/app/routers/posts.py`, add this function after the `_require_admin` helper (around line 22, before the first `@router` decorator):

```python
def _find_clash(sb, brand_id: str, platform: str, scheduled_at_iso: str, exclude_post_id: str | None = None) -> dict | None:
    """Return the first scheduled post that clashes (same brand+platform+day), or None."""
    scheduled_dt = datetime.fromisoformat(scheduled_at_iso.replace("Z", "+00:00"))
    day_start = scheduled_dt.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    day_end = scheduled_dt.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
    query = (
        sb.table("posts")
        .select("id, text, platform, scheduled_at, brand_id")
        .eq("brand_id", brand_id)
        .eq("platform", platform)
        .eq("status", "scheduled")
        .gte("scheduled_at", day_start)
        .lte("scheduled_at", day_end)
    )
    res = query.execute()
    for row in (res.data or []):
        if exclude_post_id and row["id"] == exclude_post_id:
            continue
        return row
    return None
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
cd backend
python -c "from app.routers.posts import _find_clash; print('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/posts.py
git commit -m "feat: add _find_clash helper to posts router"
```

---

## Task 3: Backend — modify `schedule_post` with clash detection

**Files:**
- Modify: `backend/app/routers/posts.py`

- [ ] **Step 1: Update the import at the top of `posts.py`**

Find this line (around line 12):

```python
from app.schemas.posts import PostCreate, PostOut, PostUpdate, RejectRequest, ScheduleRequest, RescheduleRequest
```

Replace it with:

```python
from app.schemas.posts import PostCreate, PostOut, PostUpdate, RejectRequest, ScheduleRequest, RescheduleRequest, ForceScheduleRequest
```

- [ ] **Step 2: Add the clash check inside `schedule_post`**

Find `schedule_post` (around line 202). The current body validates the post exists, checks status is `approved`, parses and validates the datetime, then writes the update. Add the clash check **after** the datetime validation and **before** the database write. Replace the section from the datetime parse to the `updated` write:

```python
    try:
        scheduled_dt = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format — use ISO 8601")
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    clash = _find_clash(sb, post["brand_id"], post["platform"], body.scheduled_at)
    if clash:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": "clash",
                "clashing_post": {
                    "id": clash["id"],
                    "text": clash["text"],
                    "platform": clash["platform"],
                    "scheduled_at": clash["scheduled_at"],
                },
            },
        )
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({
        "status": "scheduled",
        "scheduled_at": body.scheduled_at,
        "updated_at": now,
    }).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]
```

- [ ] **Step 3: Verify the file parses cleanly**

```bash
cd backend
python -c "from app.routers.posts import schedule_post; print('ok')"
```

Expected output: `ok`

- [ ] **Step 4: Manual smoke test**

Start the backend (`uvicorn app.main:app --reload`) and use the Swagger UI at `http://localhost:8000/docs`:
1. Schedule a post to a date/time — expect 200.
2. Schedule a second post for the same brand + platform + same day — expect 409 with `{ "detail": { "detail": "clash", "clashing_post": {...} } }`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/posts.py
git commit -m "feat: clash detection on schedule_post endpoint"
```

---

## Task 4: Backend — modify `reschedule_post` with clash detection

**Files:**
- Modify: `backend/app/routers/posts.py`

- [ ] **Step 1: Add the clash check inside `reschedule_post`**

Find `reschedule_post` (around line 254). Same pattern as Task 3 — add the clash check after datetime validation, before the database write. Replace from the datetime parse to the `updated` write:

```python
    try:
        scheduled_dt = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format — use ISO 8601")
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    clash = _find_clash(sb, post["brand_id"], post["platform"], body.scheduled_at, exclude_post_id=post_id)
    if clash:
        raise HTTPException(
            status_code=409,
            detail={
                "detail": "clash",
                "clashing_post": {
                    "id": clash["id"],
                    "text": clash["text"],
                    "platform": clash["platform"],
                    "scheduled_at": clash["scheduled_at"],
                },
            },
        )
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({
        "scheduled_at": body.scheduled_at,
        "updated_at": now,
    }).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]
```

Note the `exclude_post_id=post_id` — this prevents the post from clashing with its own current slot when moving to the same day.

- [ ] **Step 2: Verify the file parses cleanly**

```bash
cd backend
python -c "from app.routers.posts import reschedule_post; print('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/posts.py
git commit -m "feat: clash detection on reschedule_post endpoint"
```

---

## Task 5: Backend — `unschedule` → draft, and new `force-schedule` endpoint

**Files:**
- Modify: `backend/app/routers/posts.py`

- [ ] **Step 1: Change `unschedule_post` to set status `"draft"`**

Find `unschedule_post` (around line 231). Find this block:

```python
    updated = sb.table("posts").update({
        "status": "approved",
        "scheduled_at": None,
        "updated_at": now,
    }).eq("id", post_id).execute()
```

Change `"approved"` to `"draft"`:

```python
    updated = sb.table("posts").update({
        "status": "draft",
        "scheduled_at": None,
        "updated_at": now,
    }).eq("id", post_id).execute()
```

Also update the docstring from `"""Move scheduled → approved. Clears scheduled_at."""` to `"""Move scheduled → draft. Clears scheduled_at."""`

- [ ] **Step 2: Add the `force_schedule_post` endpoint**

Add this new endpoint at the end of `backend/app/routers/posts.py` (after the `reschedule_post` function):

```python
@router.post("/{post_id}/force-schedule", response_model=PostOut)
async def force_schedule_post(post_id: str, body: ForceScheduleRequest, user: Annotated[dict, Depends(current_user)]):
    """Schedule a post without clash checking. Used by clash modal (Keep Both / Replace)."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") not in ADMIN_ROLES and post["created_by"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if post["status"] != "approved":
        raise HTTPException(status_code=400, detail=f"Only approved posts can be force-scheduled (current: {post['status']})")
    try:
        scheduled_dt = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format — use ISO 8601")
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({
        "status": "scheduled",
        "scheduled_at": body.scheduled_at,
        "updated_at": now,
    }).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]
```

- [ ] **Step 3: Verify the file parses cleanly**

```bash
cd backend
python -c "from app.routers.posts import force_schedule_post, unschedule_post; print('ok')"
```

Expected output: `ok`

- [ ] **Step 4: Manual smoke test**

In Swagger UI:
1. Unschedule a scheduled post — confirm the returned post has `status: "draft"`.
2. Call `POST /posts/{id}/force-schedule` with a valid future ISO datetime — confirm it schedules without clash check.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/posts.py
git commit -m "feat: unschedule returns draft; add force-schedule endpoint"
```

---

## Task 6: Frontend — `forceSchedulePost` API helper

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add `forceSchedulePost` after the existing `reschedulePost` export**

Open `frontend/lib/api.ts`. Find these lines (around line 306):

```typescript
export const reschedulePost = (id: string, scheduled_at: string) =>
  api.patch<PostItem>(`/api/posts/${id}/reschedule`, { scheduled_at });
```

Add immediately after:

```typescript
export const forceSchedulePost = (id: string, scheduled_at: string) =>
  api.post<PostItem>(`/api/posts/${id}/force-schedule`, { scheduled_at });
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add forceSchedulePost API helper"
```

---

## Task 7: Frontend — `ClashModal` component

**Files:**
- Create: `frontend/components/domain/ClashModal.tsx`

This component receives the clashing post's details and the three callbacks. It manages its own `replaceConfirming` state for the inline replace confirmation.

- [ ] **Step 1: Create the file**

```typescript
"use client";
import { Button } from "@/components/ui/button";

interface ClashingPost {
  id: string;
  text: string;
  platform: string;
  scheduled_at: string;
}

interface ClashModalProps {
  clashingPost: ClashingPost;
  onKeepBoth: () => Promise<void>;
  onReplace: () => Promise<void>;
  onPickDifferentTime: () => void;
  submitting: boolean;
}

function formatDt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function ClashModal({ clashingPost, onKeepBoth, onReplace, onPickDifferentTime, submitting }: ClashModalProps) {
  const [replaceConfirming, setReplaceConfirming] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-bold text-text-primary mb-1">Scheduling Clash</h2>
        <p className="text-sm text-text-muted mb-4">
          There is already a <strong>{clashingPost.platform}</strong> post scheduled for this day:
        </p>
        <div className="bg-elevated rounded-lg p-3 mb-4 text-sm text-text-primary">
          <div className="text-xs text-text-muted mb-1">{formatDt(clashingPost.scheduled_at)}</div>
          <div className="leading-relaxed">
            {clashingPost.text.length > 100 ? clashingPost.text.slice(0, 100) + "…" : clashingPost.text}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={onKeepBoth}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Scheduling…" : "Keep Both"}
          </Button>

          {!replaceConfirming ? (
            <Button
              variant="ghost"
              onClick={() => setReplaceConfirming(true)}
              disabled={submitting}
              className="w-full border border-border"
            >
              Replace Existing Post
            </Button>
          ) : (
            <div className="border border-error/40 rounded-lg p-3 bg-red-50 dark:bg-red-950/20">
              <p className="text-xs text-error mb-3">
                This will move the existing post back to draft. It will need re-approval before it can be scheduled again. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onReplace}
                  disabled={submitting}
                  className="flex-1 text-sm bg-error hover:bg-error/90 text-white"
                >
                  {submitting ? "Replacing…" : "Confirm Replace"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setReplaceConfirming(false)}
                  disabled={submitting}
                  className="flex-1 text-sm border border-border"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={onPickDifferentTime}
            disabled={submitting}
            className="w-full text-text-muted border border-border"
          >
            Pick a Different Time
          </Button>
        </div>
      </div>
    </div>
  );
}
```

Note: the file uses `React.useState` — add the React import at the top:

```typescript
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
```

The full file with the import at the top:

```typescript
"use client";
import React from "react";
import { Button } from "@/components/ui/button";

interface ClashingPost {
  id: string;
  text: string;
  platform: string;
  scheduled_at: string;
}

interface ClashModalProps {
  clashingPost: ClashingPost;
  onKeepBoth: () => Promise<void>;
  onReplace: () => Promise<void>;
  onPickDifferentTime: () => void;
  submitting: boolean;
}

function formatDt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export function ClashModal({ clashingPost, onKeepBoth, onReplace, onPickDifferentTime, submitting }: ClashModalProps) {
  const [replaceConfirming, setReplaceConfirming] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-base font-bold text-text-primary mb-1">Scheduling Clash</h2>
        <p className="text-sm text-text-muted mb-4">
          There is already a <strong>{clashingPost.platform}</strong> post scheduled for this day:
        </p>
        <div className="bg-elevated rounded-lg p-3 mb-4 text-sm text-text-primary">
          <div className="text-xs text-text-muted mb-1">{formatDt(clashingPost.scheduled_at)}</div>
          <div className="leading-relaxed">
            {clashingPost.text.length > 100 ? clashingPost.text.slice(0, 100) + "…" : clashingPost.text}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={onKeepBoth}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? "Scheduling…" : "Keep Both"}
          </Button>

          {!replaceConfirming ? (
            <Button
              variant="ghost"
              onClick={() => setReplaceConfirming(true)}
              disabled={submitting}
              className="w-full border border-border"
            >
              Replace Existing Post
            </Button>
          ) : (
            <div className="border border-error/40 rounded-lg p-3 bg-red-50 dark:bg-red-950/20">
              <p className="text-xs text-error mb-3">
                This will move the existing post back to draft. It will need re-approval before it can be scheduled again. Continue?
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={onReplace}
                  disabled={submitting}
                  className="flex-1 text-sm bg-error hover:bg-error/90 text-white"
                >
                  {submitting ? "Replacing…" : "Confirm Replace"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setReplaceConfirming(false)}
                  disabled={submitting}
                  className="flex-1 text-sm border border-border"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            onClick={onPickDifferentTime}
            disabled={submitting}
            className="w-full text-text-muted border border-border"
          >
            Pick a Different Time
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/ClashModal.tsx
git commit -m "feat: ClashModal component — keep both, replace, pick different time"
```

---

## Task 8: Frontend — wire clash detection into CalendarPage

**Files:**
- Modify: `frontend/app/dashboard/calendar/page.tsx`

This is the largest change. Read the full file before editing. The current file is ~578 lines.

- [ ] **Step 1: Add the import for `ClashModal` and `forceSchedulePost`**

Find the existing imports at the top of `frontend/app/dashboard/calendar/page.tsx`:

```typescript
import {
  getPosts, getBrands, schedulePost, unschedulePost, reschedulePost,
  PostItem, BrandPublic,
} from "@/lib/api";
```

Replace with:

```typescript
import {
  getPosts, getBrands, schedulePost, unschedulePost, reschedulePost, forceSchedulePost,
  PostItem, BrandPublic,
} from "@/lib/api";
import { ClashModal } from "@/components/domain/ClashModal";
```

- [ ] **Step 2: Add clash state variables**

Find the existing state declarations in `CalendarPage`. After this block (around line 93):

```typescript
  const reschedulePanelRef = useRef<HTMLDivElement>(null);
```

Add:

```typescript
  // Clash modal
  const [clashData, setClashData] = useState<{
    clashingPost: { id: string; text: string; platform: string; scheduled_at: string };
    pendingPostId: string;
    pendingDateTime: string;
  } | null>(null);
  const [clashSubmitting, setClashSubmitting] = useState(false);
```

- [ ] **Step 3: Add `closeClashModal` helper**

After the `handleUnschedule` function (around line 205), add:

```typescript
  const closeClashModal = () => {
    setClashData(null);
    setClashSubmitting(false);
  };
```

- [ ] **Step 4: Update `handleSchedule` to catch 409**

Find `handleSchedule` (around line 161). Replace the entire function:

```typescript
  const handleSchedule = async () => {
    if (!scheduleDate || !selectedPostId) return;
    setScheduling(true);
    try {
      await schedulePost(selectedPostId, isoDateTime(scheduleDate, scheduleTime));
      toast.success("Post scheduled");
      setScheduleDate(null);
      setSelectedPostId(null);
      loadPosts();
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { detail?: { detail?: string; clashing_post?: { id: string; text: string; platform: string; scheduled_at: string } } } } };
      if (apiErr?.response?.status === 409 && apiErr?.response?.data?.detail?.detail === "clash") {
        const cp = apiErr.response.data.detail.clashing_post!;
        setClashData({
          clashingPost: cp,
          pendingPostId: selectedPostId,
          pendingDateTime: isoDateTime(scheduleDate, scheduleTime),
        });
      } else {
        toast.error("Failed to schedule post");
      }
    } finally {
      setScheduling(false);
    }
  };
```

- [ ] **Step 5: Update `handleReschedule` to catch 409**

Find `handleReschedule` (around line 177). Replace the entire function:

```typescript
  const handleReschedule = async () => {
    if (!reschedulePost_ || !rescheduleDate) return;
    setRescheduling(true);
    try {
      await reschedulePost(reschedulePost_.id, isoDateTime(rescheduleDate, rescheduleTime));
      toast.success("Post rescheduled");
      setReschedulePost(null);
      loadPosts();
    } catch (err: unknown) {
      const apiErr = err as { response?: { status?: number; data?: { detail?: { detail?: string; clashing_post?: { id: string; text: string; platform: string; scheduled_at: string } } } } };
      if (apiErr?.response?.status === 409 && apiErr?.response?.data?.detail?.detail === "clash") {
        const cp = apiErr.response.data.detail.clashing_post!;
        setClashData({
          clashingPost: cp,
          pendingPostId: reschedulePost_.id,
          pendingDateTime: isoDateTime(rescheduleDate, rescheduleTime),
        });
      } else {
        toast.error("Failed to reschedule post");
      }
    } finally {
      setRescheduling(false);
    }
  };
```

- [ ] **Step 6: Add clash modal action handlers**

After `closeClashModal`, add:

```typescript
  const handleClashKeepBoth = async () => {
    if (!clashData) return;
    setClashSubmitting(true);
    try {
      await forceSchedulePost(clashData.pendingPostId, clashData.pendingDateTime);
      toast.success("Post scheduled alongside existing post");
      closeClashModal();
      setScheduleDate(null);
      setSelectedPostId(null);
      setReschedulePost(null);
      loadPosts();
    } catch {
      toast.error("Failed to schedule post");
      setClashSubmitting(false);
    }
  };

  const handleClashReplace = async () => {
    if (!clashData) return;
    setClashSubmitting(true);
    try {
      await unschedulePost(clashData.clashingPost.id);
      await forceSchedulePost(clashData.pendingPostId, clashData.pendingDateTime);
      toast.success("Existing post moved to draft. New post scheduled.");
      closeClashModal();
      setScheduleDate(null);
      setSelectedPostId(null);
      setReschedulePost(null);
      loadPosts();
    } catch {
      toast.error("Failed to replace post");
      setClashSubmitting(false);
    }
  };

  const handleClashPickDifferentTime = () => {
    closeClashModal();
    // panels remain open — user can change the time and re-submit
  };
```

- [ ] **Step 7: Render `ClashModal` in the JSX**

Find the very end of the `return (...)` block in `CalendarPage` (around line 575, just before the closing `</div>`). Add the `ClashModal` render just before the final closing `</div>`:

```typescript
      {clashData && (
        <ClashModal
          clashingPost={clashData.clashingPost}
          onKeepBoth={handleClashKeepBoth}
          onReplace={handleClashReplace}
          onPickDifferentTime={handleClashPickDifferentTime}
          submitting={clashSubmitting}
        />
      )}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add frontend/app/dashboard/calendar/page.tsx
git commit -m "feat: wire clash detection and ClashModal into CalendarPage"
```

---

## Task 9: End-to-end smoke test

No code changes — verify the complete flow works.

- [ ] **Step 1: Start both servers**

Backend:
```bash
cd backend
uvicorn app.main:app --reload
```

Frontend (separate terminal):
```bash
cd frontend
npm run dev
```

- [ ] **Step 2: Test the clash flow — schedule panel**

1. Navigate to `/dashboard/calendar`.
2. Ensure you have at least two approved posts for the same brand + platform.
3. Click a date, select the first post, pick a time, click Schedule — confirm it schedules (200).
4. Click the same date, select the second post (same brand + platform), pick any time on the same day, click Schedule.
5. Confirm the `ClashModal` appears, showing the existing post's text and time.
6. Click **Keep Both** — confirm both posts appear on the calendar for that day.

- [ ] **Step 3: Test Replace flow**

1. Repeat steps 2–4 above.
2. Click **Replace Existing Post** — confirm the inline confirmation appears.
3. Click **Confirm Replace** — confirm the old post disappears from the calendar, the new one appears, and a toast says "Existing post moved to draft. New post scheduled."
4. Navigate to `/dashboard/posts`, filter by `draft` — confirm the replaced post is there.

- [ ] **Step 4: Test Pick a Different Time**

1. Trigger the clash modal again.
2. Click **Pick a Different Time** — confirm the modal closes and the schedule panel is still open.
3. Change the time to a different time (still same day) — confirm it schedules without re-triggering the clash (same day = still a clash, modal appears again — this is correct behaviour).

- [ ] **Step 5: Test manual unschedule → draft**

1. Click a scheduled post pill on the calendar to open the reschedule slide-over.
2. Click **Unschedule**.
3. Navigate to `/dashboard/posts`, filter by `draft` — confirm the post is now a draft (not approved).

- [ ] **Step 6: Test reschedule clash**

1. Have two scheduled posts on the same day for the same brand + platform (use Keep Both from above).
2. Click one post pill, open reschedule slide-over, change the date to a different day, click Reschedule — confirm it succeeds.
3. Now reschedule it back to the original day — confirm the clash modal appears.
