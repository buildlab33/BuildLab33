"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getPosts, getBrands, schedulePost, unschedulePost, reschedulePost, forceSchedulePost,
  PostItem, BrandPublic,
} from "@/lib/api";
import { ClashModal } from "@/components/domain/ClashModal";
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
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoDateTime(date: string, time: string) {
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

  // Clash modal
  const [clashData, setClashData] = useState<{
    clashingPost: { id: string; text: string; platform: string; scheduled_at: string };
    pendingPostId: string;
    pendingDateTime: string;
  } | null>(null);
  const [clashSubmitting, setClashSubmitting] = useState(false);

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

  // Load scheduled posts when brand changes
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
      setRescheduleTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
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

  const closeClashModal = () => {
    setClashData(null);
    setClashSubmitting(false);
  };

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
          onClick={(e) => { e.stopPropagation(); openSchedulePanel(dateStr); }}
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
              <div key={ds} className={`text-center text-xs py-2 font-semibold ${isToday ? "text-text-active" : "text-text-muted"}`}>
                {WEEK_DAYS[i]}<br />
                <span className={`text-[11px] ${isToday ? "font-bold" : "font-normal opacity-60"}`}>{d.getDate()}</span>
              </div>
            );
          })}
          {/* Time rows */}
          {TIME_HOURS.map((hour, rowIdx) => (
            <React.Fragment key={hour}>
              <div className="text-[10px] text-text-muted text-right pr-2 pt-1.5">
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
                    onClick={(e) => { e.stopPropagation(); openSchedulePanel(ds); }}
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
            </React.Fragment>
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

      {clashData && (
        <ClashModal
          clashingPost={clashData.clashingPost}
          onKeepBoth={handleClashKeepBoth}
          onReplace={handleClashReplace}
          onPickDifferentTime={handleClashPickDifferentTime}
          submitting={clashSubmitting}
        />
      )}
    </div>
  );
}
