# Scheduling / Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire approved posts onto a calendar with monthly/weekly views, schedule from post detail or by clicking a date, and reschedule/unschedule via a slide-over panel.

**Architecture:** Three new backend endpoints (`/schedule`, `/unschedule`, `/reschedule`) added to the existing posts router. Frontend: calendar page rebuilt from placeholder with monthly grid + weekly toggle, brand filter pills, schedule panel, and reschedule slide-over; post detail page gains a Schedule card for approved posts.

**Tech Stack:** FastAPI, Pydantic v2, Supabase, Next.js 15 App Router, Tailwind CSS v4 tokens, Zustand (`useAuthStore`), Sonner toast via `@/components/ui/toast`, axios via `@/lib/api`.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| SQL (Supabase) | — | Fix status CHECK to include `'scheduled'` |
| Modify | `backend/app/schemas/posts.py` | Add `ScheduleRequest`, `RescheduleRequest` |
| Modify | `backend/app/routers/posts.py` | Add 3 new endpoints |
| Modify | `frontend/lib/api.ts` | Add `schedulePost`, `unschedulePost`, `reschedulePost` |
| Replace | `frontend/app/dashboard/calendar/page.tsx` | Full calendar implementation |
| Modify | `frontend/app/dashboard/posts/[id]/page.tsx` | Add Schedule card for approved posts |

---

### Task 1: Supabase — fix status CHECK constraint

**Files:**
- SQL run in Supabase Dashboard SQL Editor

The existing `posts_status_check` constraint on the `posts` table was added during the Posts subsystem. It currently includes `'rejected'` and `'removed'` but NOT `'scheduled'`. We need to drop and re-add it.

- [ ] **Step 1: Open Supabase SQL Editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Run the migration**

```sql
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check
  CHECK (status IN ('draft','pending','approved','scheduled','published','rejected','removed'));
```

Expected: "Success. No rows returned."

- [ ] **Step 3: Verify**

Run a quick check:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'posts'::regclass AND contype = 'c';
```

Confirm `posts_status_check` now includes `'scheduled'` in the list.

---

### Task 2: Backend — add ScheduleRequest and RescheduleRequest schemas

**Files:**
- Modify: `backend/app/schemas/posts.py`

Current file ends after the `PostOut` class. Add two new schema classes.

- [ ] **Step 1: Read the current end of the file**

Open `backend/app/schemas/posts.py` and confirm it ends at `updated_at: str`.

- [ ] **Step 2: Append the two new schemas**

Add these two classes at the bottom of `backend/app/schemas/posts.py`:

```python
class ScheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string, e.g. "2026-05-12T09:00:00+00:00"


class RescheduleRequest(BaseModel):
    scheduled_at: str  # ISO 8601 datetime string, e.g. "2026-05-12T14:00:00+00:00"
```

- [ ] **Step 3: Verify syntax**

```bash
python -c "import ast; ast.parse(open('backend/app/schemas/posts.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/schemas/posts.py
git commit -m "feat: add ScheduleRequest and RescheduleRequest schemas"
```

---

### Task 3: Backend — add schedule, unschedule, reschedule endpoints

**Files:**
- Modify: `backend/app/routers/posts.py`

The posts router currently imports `PostCreate, PostOut, PostUpdate, RejectRequest` from `app.schemas.posts`. We need to add `ScheduleRequest, RescheduleRequest` to that import and add three new endpoint functions.

**Role rules for new endpoints:**
- Own post (any role) OR admin/super_admin can schedule/unschedule/reschedule.
- Validation: `scheduled_at` must parse as a valid datetime and be in the future.

- [ ] **Step 1: Update the import line**

In `backend/app/routers/posts.py`, find line:
```python
from app.schemas.posts import PostCreate, PostOut, PostUpdate, RejectRequest
```

Change to:
```python
from app.schemas.posts import PostCreate, PostOut, PostUpdate, RejectRequest, ScheduleRequest, RescheduleRequest
```

- [ ] **Step 2: Add the three endpoints**

At the end of `backend/app/routers/posts.py`, add:

```python
@router.post("/{post_id}/schedule", response_model=PostOut)
async def schedule_post(post_id: str, body: ScheduleRequest, user: Annotated[dict, Depends(current_user)]):
    """Move approved → scheduled. Sets scheduled_at."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") not in ADMIN_ROLES and post["created_by"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if post["status"] != "approved":
        raise HTTPException(status_code=400, detail=f"Only approved posts can be scheduled (current: {post['status']})")
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


@router.post("/{post_id}/unschedule", response_model=PostOut)
async def unschedule_post(post_id: str, user: Annotated[dict, Depends(current_user)]):
    """Move scheduled → approved. Clears scheduled_at."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") not in ADMIN_ROLES and post["created_by"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if post["status"] != "scheduled":
        raise HTTPException(status_code=400, detail=f"Only scheduled posts can be unscheduled (current: {post['status']})")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({
        "status": "approved",
        "scheduled_at": None,
        "updated_at": now,
    }).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]


@router.patch("/{post_id}/reschedule", response_model=PostOut)
async def reschedule_post(post_id: str, body: RescheduleRequest, user: Annotated[dict, Depends(current_user)]):
    """Update scheduled_at for a scheduled post. Status stays scheduled."""
    sb = get_supabase()
    res = sb.table("posts").select("*").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = res.data[0]
    if user.get("role") not in ADMIN_ROLES and post["created_by"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if post["status"] != "scheduled":
        raise HTTPException(status_code=400, detail=f"Only scheduled posts can be rescheduled (current: {post['status']})")
    try:
        scheduled_dt = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at format — use ISO 8601")
    if scheduled_dt <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    now = datetime.now(timezone.utc).isoformat()
    updated = sb.table("posts").update({
        "scheduled_at": body.scheduled_at,
        "updated_at": now,
    }).eq("id", post_id).execute()
    if not updated.data:
        raise HTTPException(status_code=500, detail="Update failed or row no longer accessible")
    return updated.data[0]
```

- [ ] **Step 3: Verify syntax**

```bash
python -c "import ast; ast.parse(open('backend/app/routers/posts.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/posts.py
git commit -m "feat: add schedule, unschedule, reschedule endpoints to posts router"
```

---

### Task 4: Frontend — add scheduling API helpers to api.ts

**Files:**
- Modify: `frontend/lib/api.ts`

The file already has a `// ── Posts ─────` section with `PostItem` and 8 helpers. Append three more at the end of that section.

- [ ] **Step 1: Open the file and find the last posts function**

The last line in the posts section is:
```typescript
export const deletePost = (id: string) =>
  api.delete(`/api/posts/${id}`);
```

- [ ] **Step 2: Append the three new helpers**

Add immediately after the `deletePost` line:

```typescript
export const schedulePost = (id: string, scheduled_at: string) =>
  api.post<PostItem>(`/api/posts/${id}/schedule`, { scheduled_at });

export const unschedulePost = (id: string) =>
  api.post<PostItem>(`/api/posts/${id}/unschedule`);

export const reschedulePost = (id: string, scheduled_at: string) =>
  api.patch<PostItem>(`/api/posts/${id}/reschedule`, { scheduled_at });
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add schedulePost, unschedulePost, reschedulePost API helpers"
```

---

### Task 5: Frontend — calendar page (full implementation)

**Files:**
- Replace: `frontend/app/dashboard/calendar/page.tsx`

This replaces the current placeholder (`EmptyState` + "Coming Soon"). The new page has:
- Top bar: month/week navigator + view toggle + brand filter pills
- Monthly grid (7-column, Mon–Sun) with post pills
- Weekly timeline (8-column with time rows)
- Schedule Panel slide-over (click empty date → pick approved post → set time → schedule)
- Reschedule Slide-over (click scheduled post pill → reschedule/unschedule)

**Key patterns from the codebase:**
- Slide-over: `absolute left-full top-0` panel inside a `relative` wrapper with outside-click close (see `Sidebar.tsx` notification panel)
- Brand colour: `brand.brand_colour` from `getBrands()` response, fallback `"var(--color-primary)"`
- Tokens: `bg-surface`, `bg-elevated`, `border-border`, `text-text-primary`, `text-text-muted`, `text-text-active`, `bg-primary-muted`, `rounded-md`
- Toast: `import { toast } from "@/components/ui/toast"`
- API: `getPosts`, `getBrands`, `schedulePost`, `unschedulePost`, `reschedulePost` from `@/lib/api`

- [ ] **Step 1: Replace the entire file**

Replace the full contents of `frontend/app/dashboard/calendar/page.tsx` with:

```typescript
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getPosts, getBrands, schedulePost, unschedulePost, reschedulePost,
  PostItem, BrandPublic,
} from "@/lib/api";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { toast } from "@/components/ui/toast";

// ── Helpers ────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  // Returns 0=Mon ... 6=Sun
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7;
}

function isoDate(date: Date) {
  return date.toISOString().split("T")[0];
}

function isoDateTime(date: string, time: string) {
  // Combine "2026-05-12" + "09:00" → ISO string with UTC offset
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatScheduledAt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const TIME_SLOTS = ["8am","10am","12pm","2pm","4pm","6pm","8pm"];
const TIME_HOURS = [8, 10, 12, 14, 16, 18, 20];

// ── Main Component ─────────────────────────────────────────────────────────

export default function CalendarPage() {
  const router = useRouter();
  const today = new Date();

  // View state
  const [view, setView] = useState<"month" | "week">("month");
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [weekStart, setWeekStart] = useState(getWeekStart(today));

  // Data
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [approvedPosts, setApprovedPosts] = useState<PostItem[]>([]);
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // Schedule panel (click empty date)
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
  const schedulePanelRef = useRef<HTMLDivElement>(null);

  // Reschedule slide-over (click scheduled post pill)
  const [reschedulePost_, setReschedulePost] = useState<PostItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("09:00");
  const [rescheduling, setRescheduling] = useState(false);
  const reschedulePanelRef = useRef<HTMLDivElement>(null);

  // Close panels on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (schedulePanelRef.current && !schedulePanelRef.current.contains(e.target as Node)) {
        setScheduleDate(null);
        setSelectedPostId(null);
      }
      if (reschedulePanelRef.current && !reschedulePanelRef.current.contains(e.target as Node)) {
        setReschedulePost(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;
  const getBrandColour = (id: string) => brands.find((b) => b.id === id)?.brand_colour ?? "var(--color-primary)";

  // Load brands once
  useEffect(() => {
    getBrands().then((res) => {
      const data: BrandPublic[] = res.data?.brands || res.data || [];
      setBrands(data);
    }).catch(() => {});
  }, []);

  // Load scheduled posts when month/brand changes
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status: string; brand_id?: string } = { status: "scheduled" };
      if (brandFilter !== "all") params.brand_id = brandFilter;
      const res = await getPosts(params);
      setPosts(res.data);
    } catch {
      toast.error("Failed to load calendar posts");
    } finally {
      setLoading(false);
    }
  }, [brandFilter]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  // Load approved posts when schedule panel opens
  const openSchedulePanel = async (dateStr: string) => {
    setScheduleDate(dateStr);
    setSelectedPostId(null);
    try {
      const res = await getPosts({ status: "approved" });
      const unscheduled = res.data.filter((p) => !p.scheduled_at);
      setApprovedPosts(unscheduled);
    } catch {
      toast.error("Failed to load approved posts");
    }
  };

  const openReschedulePanel = (post: PostItem) => {
    setReschedulePost(post);
    if (post.scheduled_at) {
      const d = new Date(post.scheduled_at);
      setRescheduleDate(isoDate(d));
      setRescheduleTime(d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }));
    }
  };

  // Actions
  const handleSchedule = async () => {
    if (!scheduleDate || !selectedPostId) return;
    setScheduling(true);
    try {
      await schedulePost(selectedPostId, isoDateTime(scheduleDate, scheduleTime));
      toast.success("Post scheduled");
      setScheduleDate(null);
      setSelectedPostId(null);
      loadPosts();
    } catch {
      toast.error("Failed to schedule post");
    } finally {
      setScheduling(false);
    }
  };

  const handleReschedule = async () => {
    if (!reschedulePost_ || !rescheduleDate) return;
    setRescheduling(true);
    try {
      await reschedulePost(reschedulePost_.id, isoDateTime(rescheduleDate, rescheduleTime));
      toast.success("Post rescheduled");
      setReschedulePost(null);
      loadPosts();
    } catch {
      toast.error("Failed to reschedule post");
    } finally {
      setRescheduling(false);
    }
  };

  const handleUnschedule = async () => {
    if (!reschedulePost_) return;
    setRescheduling(true);
    try {
      await unschedulePost(reschedulePost_.id);
      toast.success("Post unscheduled");
      setReschedulePost(null);
      loadPosts();
    } catch {
      toast.error("Failed to unschedule post");
    } finally {
      setRescheduling(false);
    }
  };

  // Navigation
  const prevPeriod = () => {
    if (view === "month") {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear((y) => y - 1); }
      else setCurrentMonth((m) => m - 1);
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
    }
  };
  const nextPeriod = () => {
    if (view === "month") {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear((y) => y + 1); }
      else setCurrentMonth((m) => m + 1);
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
    }
  };

  // Posts indexed by date string "YYYY-MM-DD"
  const postsByDate: Record<string, PostItem[]> = {};
  posts.forEach((p) => {
    if (!p.scheduled_at) return;
    const key = isoDate(new Date(p.scheduled_at));
    if (!postsByDate[key]) postsByDate[key] = [];
    postsByDate[key].push(p);
  });

  const todayStr = isoDate(today);

  // ── Monthly Grid ─────────────────────────────────────────────────────────

  const renderMonthGrid = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDow = getFirstDayOfWeek(currentYear, currentMonth);
    const cells: React.ReactNode[] = [];

    // Empty leading cells
    for (let i = 0; i < firstDow; i++) {
      cells.push(<div key={`empty-${i}`} className="min-h-[80px] rounded-lg" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayPosts = postsByDate[dateStr] || [];
      const isToday = dateStr === todayStr;

      cells.push(
        <div
          key={dateStr}
          className={`min-h-[80px] rounded-lg border p-1.5 cursor-pointer transition-colors ${
            isToday ? "border-primary/40 bg-primary-muted/10" : "border-border hover:border-elevated"
          }`}
          onClick={() => openSchedulePanel(dateStr)}
        >
          <div className={`text-xs font-semibold mb-1 px-0.5 ${isToday ? "text-text-active" : "text-text-muted"}`}>
            {day}
          </div>
          <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
            {dayPosts.map((p) => (
              <button
                key={p.id}
                onClick={() => openReschedulePanel(p)}
                className="w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate font-medium"
                style={{
                  backgroundColor: `${getBrandColour(p.brand_id)}26`,
                  border: `1px solid ${getBrandColour(p.brand_id)}60`,
                  color: getBrandColour(p.brand_id),
                }}
              >
                {p.platform} · {getBrandName(p.brand_id)}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return cells;
  };

  // ── Weekly Timeline ───────────────────────────────────────────────────────

  const renderWeekGrid = () => {
    const weekDates = getWeekDates(weekStart);
    return (
      <div className="overflow-x-auto">
        <div style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)", gap: "2px" }}>
          {/* Header row */}
          <div />
          {weekDates.map((d, i) => {
            const ds = isoDate(d);
            const isToday = ds === todayStr;
            return (
              <div key={i} className={`text-center text-xs py-2 font-semibold ${isToday ? "text-text-active" : "text-text-muted"}`}>
                {WEEK_DAYS[i]}<br />
                <span className={`text-[11px] ${isToday ? "font-bold" : "font-normal opacity-60"}`}>{d.getDate()}</span>
              </div>
            );
          })}
          {/* Time rows */}
          {TIME_HOURS.map((hour, rowIdx) => (
            <>
              <div key={`label-${hour}`} className="text-[10px] text-text-muted text-right pr-2 pt-1.5">
                {TIME_SLOTS[rowIdx]}
              </div>
              {weekDates.map((d, colIdx) => {
                const ds = isoDate(d);
                const dayPosts = (postsByDate[ds] || []).filter((p) => {
                  if (!p.scheduled_at) return false;
                  const h = new Date(p.scheduled_at).getHours();
                  return h >= hour && h < hour + 2;
                });
                return (
                  <div
                    key={`${hour}-${colIdx}`}
                    className="border border-border rounded min-h-[40px] p-0.5 cursor-pointer hover:border-elevated transition-colors"
                    onClick={() => openSchedulePanel(ds)}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      {dayPosts.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => openReschedulePanel(p)}
                          className="w-full text-left text-[9px] px-1 py-0.5 rounded truncate font-medium mb-0.5"
                          style={{
                            backgroundColor: `${getBrandColour(p.brand_id)}26`,
                            border: `1px solid ${getBrandColour(p.brand_id)}60`,
                            color: getBrandColour(p.brand_id),
                          }}
                        >
                          {p.platform}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    );
  };

  // ── Period Label ──────────────────────────────────────────────────────────

  const periodLabel = view === "month"
    ? `${MONTH_NAMES[currentMonth]} ${currentYear}`
    : (() => {
        const end = new Date(weekStart);
        end.setDate(end.getDate() + 6);
        return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
      })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative">
      <PageHeader title="Calendar" subtitle="Schedule and view your content pipeline" />

      {/* Top bar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Period navigator */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevPeriod}
            className="px-2 py-1.5 rounded-md border border-border text-text-muted hover:bg-elevated hover:text-text-primary text-sm transition-colors"
          >←</button>
          <span className="px-3 text-sm font-semibold text-text-primary min-w-[180px] text-center">{periodLabel}</span>
          <button
            onClick={nextPeriod}
            className="px-2 py-1.5 rounded-md border border-border text-text-muted hover:bg-elevated hover:text-text-primary text-sm transition-colors"
          >→</button>
        </div>

        {/* View toggle */}
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                view === v
                  ? "bg-primary-muted text-text-active border-r border-border last:border-0"
                  : "text-text-muted hover:bg-elevated border-r border-border last:border-0"
              }`}
            >{v}</button>
          ))}
        </div>

        {/* Brand filter */}
        <div className="flex gap-1 flex-wrap ml-auto">
          <button
            onClick={() => setBrandFilter("all")}
            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
              brandFilter === "all"
                ? "border-primary bg-primary-muted text-text-active"
                : "border-border text-text-muted hover:bg-elevated"
            }`}
          >All</button>
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => setBrandFilter(b.id)}
              className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                brandFilter === b.id
                  ? "border-primary bg-primary-muted text-text-active"
                  : "border-border text-text-muted hover:bg-elevated"
              }`}
            >{b.name}</button>
          ))}
        </div>
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="text-center py-16 text-text-muted text-sm">Loading...</div>
      ) : view === "month" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
          {WEEK_DAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-text-muted py-2">{d}</div>
          ))}
          {renderMonthGrid()}
        </div>
      ) : (
        renderWeekGrid()
      )}

      {/* ── Schedule Panel (click empty date) ── */}
      {scheduleDate && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div
            ref={schedulePanelRef}
            className="absolute right-0 top-0 h-full w-[360px] bg-surface border-l border-border flex flex-col shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <span className="text-sm font-bold text-text-primary">
                Schedule for {new Date(scheduleDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </span>
              <button
                onClick={() => { setScheduleDate(null); setSelectedPostId(null); }}
                className="text-text-muted hover:text-text-primary text-lg leading-none"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {approvedPosts.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-8">No approved posts ready to schedule.</p>
              ) : (
                approvedPosts.map((p) => (
                  <div key={p.id}>
                    <button
                      onClick={() => setSelectedPostId(selectedPostId === p.id ? null : p.id)}
                      className={`w-full text-left rounded-lg border p-3 mb-2 transition-colors ${
                        selectedPostId === p.id
                          ? "border-primary bg-primary-muted/20"
                          : "border-border hover:border-elevated"
                      }`}
                    >
                      <div className="text-xs font-semibold text-text-primary mb-1">
                        {getBrandName(p.brand_id)} · {p.platform}
                      </div>
                      <div className="text-xs text-text-muted truncate">{p.text.slice(0, 60)}</div>
                    </button>
                    {selectedPostId === p.id && (
                      <div className="px-1 pb-3">
                        <label className="text-xs text-text-muted block mb-1">Time</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary mb-2"
                        />
                        <Button onClick={handleSchedule} disabled={scheduling} className="w-full text-sm">
                          {scheduling ? "Scheduling..." : "Schedule"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={() => router.push("/dashboard/posts")}
                className="text-xs text-text-muted hover:text-text-active transition-colors"
              >
                View all approved posts →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reschedule Slide-over (click scheduled pill) ── */}
      {reschedulePost_ && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div
            ref={reschedulePanelRef}
            className="absolute right-0 top-0 h-full w-[360px] bg-surface border-l border-border flex flex-col shadow-xl"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border">
              <div>
                <div className="text-sm font-bold text-text-primary">
                  {getBrandName(reschedulePost_.brand_id)} · {reschedulePost_.platform}
                </div>
                <div className="mt-1">
                  <StatusBadge status={reschedulePost_.status} />
                </div>
              </div>
              <button
                onClick={() => setReschedulePost(null)}
                className="text-text-muted hover:text-text-primary text-lg leading-none"
              >×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="bg-elevated rounded-lg p-3 text-sm text-text-primary mb-4 leading-relaxed">
                {reschedulePost_.text.slice(0, 120)}{reschedulePost_.text.length > 120 ? "…" : ""}
              </div>
              {reschedulePost_.scheduled_at && (
                <p className="text-xs text-text-muted mb-4">
                  Currently: {formatScheduledAt(reschedulePost_.scheduled_at)}
                </p>
              )}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-text-muted block mb-1">New Date</label>
                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-text-muted block mb-1">New Time</label>
                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <Button onClick={handleReschedule} disabled={rescheduling || !rescheduleDate} className="w-full">
                  {rescheduling ? "Saving..." : "Reschedule"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleUnschedule}
                  disabled={rescheduling}
                  className="w-full text-error hover:text-error border border-error/30 hover:border-error/50"
                >
                  Unschedule
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={() => router.push(`/dashboard/posts/${reschedulePost_.id}`)}
                className="text-xs text-text-muted hover:text-text-active transition-colors"
              >
                View full post →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/dashboard/calendar/page.tsx
git commit -m "feat: implement calendar page with monthly/weekly views, schedule and reschedule panels"
```

---

### Task 6: Frontend — add Schedule card to post detail page

**Files:**
- Modify: `frontend/app/dashboard/posts/[id]/page.tsx`

The post detail page already exists. When `post.status === "approved"`, show a Schedule card. When `post.status === "scheduled"`, show the scheduled time with an Unschedule button. Add imports and state for the new card.

- [ ] **Step 1: Update the imports**

Current import from `@/lib/api`:
```typescript
import {
  getPost, updatePost, submitPost, approvePost, rejectPost,
  PostItem, getBrands, BrandPublic,
} from "@/lib/api";
```

Change to:
```typescript
import {
  getPost, updatePost, submitPost, approvePost, rejectPost,
  schedulePost, unschedulePost,
  PostItem, getBrands, BrandPublic,
} from "@/lib/api";
```

- [ ] **Step 2: Add schedule state variables**

After `const [actioning, setActioning] = useState(false);`, add:
```typescript
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);
```

- [ ] **Step 3: Add handleSchedule and handleUnschedule functions**

After the `handleReject` function, add:
```typescript
  const handleSchedule = async () => {
    if (!post || !schedDate) return;
    setScheduling(true);
    try {
      const scheduled_at = new Date(`${schedDate}T${schedTime}:00`).toISOString();
      const res = await schedulePost(post.id, scheduled_at);
      setPost(res.data);
      toast.success("Post scheduled");
    } catch {
      toast.error("Failed to schedule post");
    } finally {
      setScheduling(false);
    }
  };

  const handleUnscheduleFromDetail = async () => {
    if (!post) return;
    setScheduling(true);
    try {
      const res = await unschedulePost(post.id);
      setPost(res.data);
      toast.success("Post unscheduled");
    } catch {
      toast.error("Failed to unschedule post");
    } finally {
      setScheduling(false);
    }
  };
```

- [ ] **Step 4: Add the Schedule card to the JSX**

Find the submit card block:
```typescript
      {/* Submit action for draft/rejected owners */}
      {(post.status === "draft" || post.status === "rejected") && (
```

Immediately after the closing `)}` of that block, add:
```typescript
      {/* Schedule card — approved posts */}
      {post.status === "approved" && (
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">Schedule this post</p>
              <p className="text-xs text-text-muted">Pick a date and time to put it on the calendar.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              />
              <input
                type="time"
                value={schedTime}
                onChange={(e) => setSchedTime(e.target.value)}
                className="rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-primary"
              />
              <Button onClick={handleSchedule} disabled={scheduling || !schedDate}>
                {scheduling ? "Scheduling..." : "Schedule"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Scheduled info — scheduled posts */}
      {post.status === "scheduled" && post.scheduled_at && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">Scheduled</p>
              <p className="text-xs text-text-muted">
                {new Date(post.scheduled_at).toLocaleDateString(undefined, {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })} at {new Date(post.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <Button
              variant="ghost"
              className="text-xs text-error hover:text-error border border-error/30 hover:border-error/50"
              onClick={handleUnscheduleFromDetail}
              disabled={scheduling}
            >
              Unschedule
            </Button>
          </div>
        </Card>
      )}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Manual test**

1. Find an approved post → detail page → Schedule card appears with date/time inputs
2. Pick a future date, click Schedule → status changes to `scheduled`, card changes to "Scheduled: {date}"
3. Click Unschedule → status reverts to `approved`, Schedule card returns
4. Go to `/dashboard/calendar` → scheduled post appears as a pill on the correct date
5. Click the pill → reschedule slide-over opens with current date/time pre-filled
6. Change date and click Reschedule → pill moves
7. Click Unschedule in slide-over → pill disappears

- [ ] **Step 7: Commit**

```bash
git add frontend/app/dashboard/posts/[id]/page.tsx
git commit -m "feat: add Schedule card to post detail page"
```
