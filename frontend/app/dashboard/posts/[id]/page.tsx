"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getPost, updatePost, submitPost, approvePost, rejectPost,
  schedulePost, unschedulePost,
  PostItem, getBrands, BrandPublic,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandBadge } from "@/components/domain/BrandBadge";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [post, setPost] = useState<PostItem | null>(null);
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [editText, setEditText] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actioning, setActioning] = useState(false);
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  const [scheduling, setScheduling] = useState(false);

  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  useEffect(() => {
    getPost(id)
      .then((res) => {
        setPost(res.data);
        setEditText(res.data.text);
      })
      .catch(() => toast.error("Post not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    getBrands().then((res) => {
      const data = res.data?.brands || res.data || [];
      setBrands(data);
    }).catch(() => {});
  }, []);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";
  const canEdit = post && (post.status === "draft" || post.status === "rejected");
  const canApprove = isAdmin && post && (post.status === "pending" || (isSuperAdmin && post.status !== "approved"));
  const canReject = isAdmin && post && (post.status === "pending" || (isSuperAdmin && post.status !== "rejected"));

  const handleSaveEdit = async () => {
    if (!post) return;
    setSaving(true);
    try {
      const res = await updatePost(post.id, editText);
      setPost(res.data);
      setEditing(false);
      toast.success("Post updated");
    } catch {
      toast.error("Failed to update post");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!post) return;
    setActioning(true);
    try {
      const res = await submitPost(post.id);
      setPost(res.data);
      toast.success("Post submitted for approval");
    } catch {
      toast.error("Failed to submit post");
    } finally {
      setActioning(false);
    }
  };

  const handleApprove = async () => {
    if (!post) return;
    setActioning(true);
    try {
      const res = await approvePost(post.id);
      setPost(res.data);
      toast.success("Post approved");
    } catch {
      toast.error("Failed to approve post");
    } finally {
      setActioning(false);
    }
  };

  const handleReject = async () => {
    if (!post || !rejectReason.trim()) {
      toast.error("Please enter a rejection reason");
      return;
    }
    setActioning(true);
    try {
      const res = await rejectPost(post.id, rejectReason.trim());
      setPost(res.data);
      setRejectReason("");
      toast.success("Post rejected");
    } catch {
      toast.error("Failed to reject post");
    } finally {
      setActioning(false);
    }
  };

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

  if (loading) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">Loading...</div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">Post not found.</div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Post Detail"
        subtitle={`${post.platform} · ${new Date(post.created_at).toLocaleDateString()}`}
        action={
          <Button variant="ghost" onClick={() => router.back()}>
            ← Back
          </Button>
        }
      />

      {/* Meta row */}
      <div className="flex gap-2 items-center mb-6 flex-wrap">
        <BrandBadge brandId={post.brand_id} brandName={getBrandName(post.brand_id)} />
        <Badge>{post.platform}</Badge>
        <StatusBadge status={post.status} />
      </div>

      {/* Rejection banner */}
      {post.status === "rejected" && post.rejection_reason && (
        <div className="mb-4 rounded-lg border border-error/30 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm text-error">
          <span className="font-semibold">Rejected: </span>{post.rejection_reason}
        </div>
      )}

      {/* Post text — view or edit */}
      <Card className="mb-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-bold text-text-primary">Post Text</h3>
          {canEdit && !editing && (
            <Button variant="ghost" className="text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>
        {editing ? (
          <>
            <textarea
              className="w-full min-h-[200px] rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary resize-y focus:outline-none focus:border-primary"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
            <div className="mt-3 flex gap-2">
              <Button onClick={handleSaveEdit} disabled={saving} className="text-xs">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="ghost"
                className="text-xs"
                onClick={() => { setEditing(false); setEditText(post.text); }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="bg-elevated rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-text-primary min-h-[120px]">
            {post.text}
          </div>
        )}
      </Card>

      {/* Submit action for draft/rejected owners */}
      {(post.status === "draft" || post.status === "rejected") && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary mb-1">Ready to submit?</p>
              <p className="text-xs text-text-muted">Send this post for admin review.</p>
            </div>
            <Button onClick={handleSubmit} disabled={actioning}>
              {actioning ? "Submitting..." : "Submit for Approval"}
            </Button>
          </div>
        </Card>
      )}

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

      {/* Admin approve / reject */}
      {(canApprove || canReject) && (
        <Card>
          <h3 className="text-sm font-bold text-text-primary mb-4">Admin Actions</h3>
          {canApprove && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">Approve post</p>
                <p className="text-xs text-text-muted">Move to approved — ready to schedule.</p>
              </div>
              <Button onClick={handleApprove} disabled={actioning}>
                {actioning ? "Processing..." : "Approve"}
              </Button>
            </div>
          )}
          {canReject && (
            <div>
              <p className="text-sm font-semibold text-text-primary mb-2">Reject post</p>
              <textarea
                className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary resize-none focus:outline-none focus:border-primary mb-2"
                rows={3}
                placeholder="Reason for rejection (required)…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <Button
                variant="ghost"
                className="text-xs text-error hover:text-error border border-error/30 hover:border-error/50"
                onClick={handleReject}
                disabled={actioning || !rejectReason.trim()}
              >
                {actioning ? "Processing..." : "Reject"}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Campaign metadata */}
      {(post.campaign_goal || post.audience || post.content_format || post.growth_angle) && (
        <Card className="mt-4">
          <h3 className="text-sm font-bold text-text-primary mb-3">Campaign Details</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {post.campaign_goal && (
              <>
                <dt className="text-text-muted">Goal</dt>
                <dd className="text-text-primary">{post.campaign_goal}</dd>
              </>
            )}
            {post.audience && (
              <>
                <dt className="text-text-muted">Audience</dt>
                <dd className="text-text-primary">{post.audience}</dd>
              </>
            )}
            {post.content_format && (
              <>
                <dt className="text-text-muted">Format</dt>
                <dd className="text-text-primary">{post.content_format}</dd>
              </>
            )}
            {post.growth_angle && (
              <>
                <dt className="text-text-muted">Angle</dt>
                <dd className="text-text-primary">{post.growth_angle}</dd>
              </>
            )}
          </dl>
        </Card>
      )}
    </div>
  );
}
