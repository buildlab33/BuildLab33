"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/domain/BrandBadge";
import { StatusBadge } from "@/components/domain/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";

type PostStatus = "draft" | "pending" | "approved" | "scheduled" | "published" | "rejected";

const MOCK_POSTS = [
  { id: "1", brand_id: "yeon-studios", brand_name: "Yeon Studios", platform: "linkedin", text: "The future of OTT infrastructure is not about more content—it's about smarter delivery. At Yeon Studios, we're building the rails that let streaming platforms scale without the overhead.", status: "approved" as PostStatus, created_at: "2026-04-28" },
  { id: "2", brand_id: "belive-studios", brand_name: "BeLive Studios", platform: "instagram", text: "Every frame tells a story. Our latest microdrama production wrapped this week and we can't wait to share what we've been working on. Stay tuned. 🎬 #BeLiveStudios #Microdrama", status: "draft" as PostStatus, created_at: "2026-04-28" },
  { id: "3", brand_id: "yeon-studios", brand_name: "Yeon Studios", platform: "linkedin", text: "Why are mid-size streaming platforms still losing 30% of their revenue to infrastructure inefficiency? We break down the 3 biggest cost centres and how to fix them.", status: "pending" as PostStatus, created_at: "2026-04-27" },
];

const FILTER_OPTIONS = ["all", "draft", "pending", "approved", "scheduled", "published"];

export default function PostsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? MOCK_POSTS : MOCK_POSTS.filter((p) => p.status === filter);

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

      {/* Filters */}
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
      <div className="flex flex-col gap-3">
        {filtered.map((post) => (
          <Card key={post.id} clickable>
            <div className="flex justify-between items-start mb-3">
              <div className="flex gap-2 items-center">
                <BrandBadge brandId={post.brand_id} brandName={post.brand_name} />
                <Badge>{post.platform}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={post.status} />
                <span className="text-text-muted text-xs">{post.created_at}</span>
              </div>
            </div>
            <p className="m-0 text-sm leading-relaxed text-text-secondary">
              {post.text.length > 180 ? post.text.slice(0, 180) + "..." : post.text}
            </p>
            <div className="mt-3 flex gap-2">
              {post.status === "draft" && (
                <Button className="text-xs px-3 py-1.5 h-auto">Submit for Approval</Button>
              )}
              {post.status === "approved" && (
                <Button className="text-xs px-3 py-1.5 h-auto">Schedule</Button>
              )}
              <Button variant="ghost" className="text-xs px-3 py-1.5 h-auto">Edit</Button>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-text-muted">
            <div className="text-3xl mb-3">☰</div>
            <div className="text-sm">No posts found</div>
            <Button className="mt-4" onClick={() => router.push("/dashboard/generate")}>
              Generate your first post
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
