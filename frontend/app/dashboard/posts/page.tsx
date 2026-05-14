"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getPosts, submitPost, unsubmitPost, deletePost, PostItem, getBrands, BrandPublic } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/domain/BrandBadge";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

const FILTER_OPTIONS = ["all", "draft", "pending", "approved", "scheduled", "published", "rejected"];

export default function PostsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter !== "all" ? { status: filter } : undefined;
      const res = await getPosts(params);
      setPosts(res.data);
    } catch {
      toast.error("Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    getBrands().then((res) => {
      const data = res.data?.brands || res.data || [];
      setBrands(data);
    }).catch(() => toast.error("Failed to load brands"));
  }, []);

  const handleSubmit = async (e: React.MouseEvent, post: PostItem) => {
    e.stopPropagation();
    setActionLoading(post.id);
    try {
      await submitPost(post.id);
      toast.success("Post submitted for approval");
      loadPosts();
    } catch {
      toast.error("Failed to submit post");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsubmit = async (e: React.MouseEvent, post: PostItem) => {
    e.stopPropagation();
    setActionLoading(post.id);
    try {
      await unsubmitPost(post.id);
      toast.success("Post moved back to draft");
      loadPosts();
    } catch {
      toast.error("Failed to unsubmit post");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, post: PostItem) => {
    e.stopPropagation();
    setDeleteConfirm(post.id);
  };

  const handleDeleteConfirm = async (e: React.MouseEvent, post: PostItem) => {
    e.stopPropagation();
    setDeleteConfirm(null);
    setActionLoading(post.id);
    try {
      await deletePost(post.id);
      toast.success("Draft deleted");
      loadPosts();
    } catch {
      toast.error("Failed to delete post");
    } finally {
      setActionLoading(null);
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div>
      <PageHeader
        title="Posts"
        subtitle="Manage your content pipeline"
        action={
          <Button onClick={() => router.push("/dashboard/generate")}>
            ✦ Generate New
          </Button>
        }
      />

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={[
              "px-3 py-1.5 rounded-full border text-xs font-semibold capitalize transition-colors duration-150",
              filter === s
                ? "border-primary bg-primary-muted text-text-active"
                : "border-border bg-surface text-text-muted hover:border-elevated hover:text-text-secondary",
            ].join(" ")}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 items-center">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-5/6 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Card
              key={post.id}
              clickable
              onClick={() => router.push(`/dashboard/posts/${post.id}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 items-center flex-wrap">
                  <BrandBadge brandId={post.brand_id} brandName={getBrandName(post.brand_id)} />
                  <Badge>{post.platform}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={post.status} />
                  <span className="text-text-muted text-xs">
                    {new Date(post.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <p className="m-0 text-sm leading-relaxed text-text-secondary">
                {post.text.length > 180 ? post.text.slice(0, 180) + "..." : post.text}
              </p>
              {post.status === "rejected" && post.rejection_reason && (
                <p className="mt-2 text-xs text-error bg-red-50 dark:bg-red-950/20 rounded px-3 py-2">
                  Rejected: {post.rejection_reason}
                </p>
              )}
              <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                {post.status === "draft" && (
                  <>
                    <Button
                      className="text-xs px-3 py-1.5 h-auto"
                      disabled={actionLoading === post.id}
                      onClick={(e) => handleSubmit(e, post)}
                    >
                      Submit for Approval
                    </Button>
                    {deleteConfirm === post.id ? (
                      <>
                        <Button
                          variant="ghost"
                          className="text-xs px-3 py-1.5 h-auto text-error hover:text-error border border-error/40"
                          disabled={actionLoading === post.id}
                          onClick={(e) => handleDeleteConfirm(e, post)}
                        >
                          Confirm Delete
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-xs px-3 py-1.5 h-auto"
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        className="text-xs px-3 py-1.5 h-auto text-error hover:text-error"
                        disabled={actionLoading === post.id}
                        onClick={(e) => handleDeleteClick(e, post)}
                      >
                        Delete
                      </Button>
                    )}
                  </>
                )}
                {post.status === "rejected" && (
                  <Button
                    className="text-xs px-3 py-1.5 h-auto"
                    onClick={() => router.push(`/dashboard/posts/${post.id}`)}
                  >
                    Edit &amp; Resubmit
                  </Button>
                )}
                {post.status === "pending" && (
                  <Button
                    variant="ghost"
                    className="text-xs px-3 py-1.5 h-auto text-text-muted"
                    disabled={actionLoading === post.id}
                    onClick={(e) => handleUnsubmit(e, post)}
                  >
                    Un-submit
                  </Button>
                )}
                {isAdmin && post.status === "pending" && (
                  <Button
                    variant="ghost"
                    className="text-xs px-3 py-1.5 h-auto"
                    onClick={() => router.push(`/dashboard/posts/${post.id}`)}
                  >
                    Review
                  </Button>
                )}
              </div>
            </Card>
          ))}

          {posts.length === 0 && !loading && (
            <div className="text-center py-16 text-text-muted">
              <FileText size={32} className="mx-auto mb-3 text-text-muted/50" />
              <div className="text-sm">No posts found</div>
              <Button className="mt-4" onClick={() => router.push("/dashboard/generate")}>
                Generate your first post
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
