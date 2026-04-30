"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BrandBadge } from "@/components/domain/BrandBadge";
import { PageHeader } from "@/components/layout/PageHeader";

interface Brand { id: string; name: string; industry: string; }

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    getBrands().then((res) => setBrands(res.data?.brands || res.data || [])).catch(() => {});
  }, []);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(" ")[0] || "there"} 👋`}
        subtitle="Here's what's happening across your brands today."
      />

      {/* Quick actions */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        <Card
          clickable
          onClick={() => router.push("/dashboard/generate")}
          className="text-left border-2 border-dashed border-border"
        >
          <div className="text-2xl mb-2">✦</div>
          <div className="font-bold mb-1 text-text-primary">Generate Content</div>
          <div className="text-xs text-text-muted">AI-powered post creation</div>
        </Card>
        <Card
          clickable
          onClick={() => router.push("/dashboard/posts")}
          className="text-left border-2 border-dashed border-border"
        >
          <div className="text-2xl mb-2">☰</div>
          <div className="font-bold mb-1 text-text-primary">View Posts</div>
          <div className="text-xs text-text-muted">Manage content pipeline</div>
        </Card>
      </div>

      {/* Brands */}
      <h2 className="text-sm font-bold text-text-primary mb-4">Your Brands</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {brands.map((brand) => (
          <Card
            key={brand.id}
            clickable
            onClick={() => router.push(`/dashboard/generate?brand=${brand.id}`)}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base bg-primary">
                {brand.name[0]}
              </div>
              <div>
                <div className="font-bold text-text-primary">{brand.name}</div>
                <div className="text-xs text-text-muted">{brand.industry}</div>
              </div>
            </div>
            <Button
              className="w-full text-xs"
              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/generate?brand=${brand.id}`); }}
            >
              Generate Post →
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
