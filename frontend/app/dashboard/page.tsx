"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

interface Brand { id: string; name: string; industry: string; }

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    getBrands().then((res) => setBrands(res.data)).catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0 }}>
          {greeting()}, {user?.name?.split(" ")[0] || "there"} 👋
        </h1>
        <p style={{ color: "#6b7280", marginTop: 4 }}>
          Here&apos;s what&apos;s happening across your brands today.
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        <button
          className="card"
          onClick={() => router.push("/dashboard/generate")}
          style={{ textAlign: "left", cursor: "pointer", border: "2px dashed #e5e7eb", background: "white" }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>✦</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Generate Content</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>AI-powered post creation</div>
        </button>
        <button
          className="card"
          onClick={() => router.push("/dashboard/posts")}
          style={{ textAlign: "left", cursor: "pointer", border: "2px dashed #e5e7eb", background: "white" }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>☰</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>View Posts</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Manage content pipeline</div>
        </button>
        <button
          className="card"
          onClick={() => router.push("/dashboard/leads")}
          style={{ textAlign: "left", cursor: "pointer", border: "2px dashed #e5e7eb", background: "white" }}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>◈</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Leads</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Track outreach targets</div>
        </button>
      </div>

      {/* Brands */}
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Your Brands</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {brands.map((brand) => (
          <div key={brand.id} className="card" style={{ cursor: "pointer" }}
            onClick={() => router.push(`/dashboard/generate?brand=${brand.id}`)}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: brand.id === "yeon-studios" ? "#6366f1" : "#ec4899",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 700, fontSize: 16,
              }}>
                {brand.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{brand.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{brand.industry}</div>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ width: "100%", fontSize: 13 }}
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/generate?brand=${brand.id}`); }}
            >
              Generate Post →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
