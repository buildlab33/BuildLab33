"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  draft: "#6b7280",
  pending: "#f59e0b",
  approved: "#10b981",
  scheduled: "#6366f1",
  published: "#059669",
  removed: "#dc2626",
};

const MOCK_POSTS = [
  { id: "1", brand_id: "yeon-studios", platform: "linkedin", text: "The future of OTT infrastructure is not about more content—it's about smarter delivery. At Yeon Studios, we're building the rails that let streaming platforms scale without the overhead.", status: "approved", created_at: "2026-04-28" },
  { id: "2", brand_id: "belive-studios", platform: "instagram", text: "Every frame tells a story. Our latest microdrama production wrapped this week and we can't wait to share what we've been working on. Stay tuned. 🎬 #BeLiveStudios #Microdrama", status: "draft", created_at: "2026-04-28" },
  { id: "3", brand_id: "yeon-studios", platform: "linkedin", text: "Why are mid-size streaming platforms still losing 30% of their revenue to infrastructure inefficiency? We break down the 3 biggest cost centres and how to fix them.", status: "pending", created_at: "2026-04-27" },
];

export default function PostsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all" ? MOCK_POSTS : MOCK_POSTS.filter((p) => p.status === filter);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Posts</h1>
          <p style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>Manage your content pipeline</p>
        </div>
        <button className="btn-primary" onClick={() => router.push("/dashboard/generate")}>
          ✦ Generate New
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {["all", "draft", "pending", "approved", "scheduled", "published"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: filter === s ? "2px solid #6366f1" : "2px solid #e5e7eb",
              background: filter === s ? "#6366f115" : "white",
              color: filter === s ? "#6366f1" : "#374151",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Posts list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((post) => (
          <div key={post.id} className="card" style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className={post.brand_id === "yeon-studios" ? "badge-yeon" : "badge-belive"}>
                  {post.brand_id === "yeon-studios" ? "Yeon Studios" : "BeLive Studios"}
                </span>
                <span style={{
                  background: "#f3f4f6", color: "#374151",
                  padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>
                  {post.platform}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  color: STATUS_COLORS[post.status],
                  fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                }}>
                  ● {post.status}
                </span>
                <span style={{ color: "#9ca3af", fontSize: 12 }}>{post.created_at}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#374151" }}>
              {post.text.length > 180 ? post.text.slice(0, 180) + "..." : post.text}
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              {post.status === "draft" && (
                <button className="btn-primary" style={{ fontSize: 12, padding: "6px 14px" }}>Submit for Approval</button>
              )}
              {post.status === "approved" && (
                <button className="btn-primary" style={{ fontSize: 12, padding: "6px 14px" }}>Schedule</button>
              )}
              <button className="btn-secondary" style={{ fontSize: 12, padding: "6px 14px" }}>Edit</button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>☰</div>
            <div>No posts found</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => router.push("/dashboard/generate")}>
              Generate your first post
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
