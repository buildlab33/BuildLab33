"use client";
import { useEffect, useState, useRef } from "react";
import { getTrendHeadlines, logTrendInteraction, TrendHeadline } from "@/lib/api";
import { Bookmark, BookmarkCheck, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  brandId: string;
  goal: string;
  audience: string;
  platform: string;
  value: TrendHeadline | null;
  onChange: (headline: TrendHeadline | null) => void;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TrendAnchorPicker({ brandId, goal, audience, platform, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [headlines, setHeadlines] = useState<TrendHeadline[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"ok" | "degraded" | "unavailable" | "loading">("loading");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const prevParams = useRef("");

  useEffect(() => {
    if (!brandId || !goal || !audience) return;
    const key = `${brandId}:${goal}:${audience}:${platform}`;
    if (key === prevParams.current) return;
    prevParams.current = key;

    setSourceStatus("loading");
    getTrendHeadlines({ brand_id: brandId, goal, audience, platform })
      .then((res) => {
        setHeadlines(res.data.headlines);
        setSourceStatus(res.data.source_status);
        if (res.data.headlines.length > 0 && !open) setOpen(true);
      })
      .catch(() => setSourceStatus("unavailable"));
  }, [brandId, goal, audience, platform]);

  const handleSelect = (h: TrendHeadline) => {
    const next = value?.url === h.url ? null : h;
    onChange(next);
    if (next) {
      logTrendInteraction({
        brand_id: brandId,
        headline_url: h.url,
        headline_title: h.title,
        action: "clicked",
      }).catch(() => {});
    }
  };

  const handleSave = (h: TrendHeadline, e: React.MouseEvent) => {
    e.stopPropagation();
    const isSaved = saved.has(h.url);
    setSaved((prev) => {
      const next = new Set(prev);
      isSaved ? next.delete(h.url) : next.add(h.url);
      return next;
    });
    logTrendInteraction({
      brand_id: brandId,
      headline_url: h.url,
      headline_title: h.title,
      action: "saved",
    }).catch(() => {});
  };

  if (!brandId || !goal || !audience) return null;

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-text-primary w-full text-left"
      >
        <span>Ground in a current trend</span>
        <span className="text-text-muted text-xs">(optional)</span>
        {open ? <ChevronUp size={14} className="ml-auto text-text-muted" /> : <ChevronDown size={14} className="ml-auto text-text-muted" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {sourceStatus === "loading" && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-elevated animate-pulse" />
              ))}
            </div>
          )}

          {sourceStatus === "unavailable" && (
            <p className="text-xs text-text-muted py-2">Headlines unavailable — check back shortly.</p>
          )}

          {sourceStatus === "degraded" && headlines.length > 0 && (
            <p className="text-xs text-text-muted mb-2">Some sources unavailable. Showing available headlines.</p>
          )}

          {(sourceStatus === "ok" || sourceStatus === "degraded") && headlines.map((h) => {
            const isSelected = value?.url === h.url;
            const isSaved = saved.has(h.url);
            return (
              <button
                key={h.url}
                type="button"
                onClick={() => handleSelect(h)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 flex items-start gap-3 transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:bg-elevated"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        h.label === "picked_for_you"
                          ? "bg-primary/10 text-primary"
                          : "bg-elevated text-text-muted"
                      }`}
                    >
                      {h.label === "picked_for_you" ? "Picked for you" : "Trending"}
                    </span>
                    <span className="text-[10px] text-text-muted">{h.source} · {timeAgo(h.published_at)}</span>
                  </div>
                  <p
                    className="text-xs text-text-primary leading-snug line-clamp-2"
                    title={h.title}
                  >
                    {h.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSave(h, e)}
                  className="flex-shrink-0 text-text-muted hover:text-primary mt-0.5"
                  title={isSaved ? "Remove from saved" : "Save as relevant"}
                >
                  {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                </button>
              </button>
            );
          })}

          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-text-muted hover:text-text-primary"
            >
              × Clear trend anchor
            </button>
          )}
        </div>
      )}
    </div>
  );
}
