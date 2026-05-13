"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";

interface Brand {
  id: string;
  name: string;
  industry: string;
  brand_colour?: string;
  logo_url?: string | null;
  status?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBrands()
      .then((res) => setBrands(res.data?.brands || []))
      .catch(() => {})
      .finally(() => setLoading(false));
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
          className="text-left border-2 border-dashed border-primary/40 bg-primary-muted/30"
        >
          <Sparkles size={20} className="mb-2 text-primary" />
          <div className="font-bold mb-1 text-text-primary">Generate Content</div>
          <div className="text-xs text-text-muted">AI-powered post creation</div>
        </Card>
        <Card
          clickable
          onClick={() => router.push("/dashboard/posts")}
          className="text-left border-2 border-dashed border-border"
        >
          <FileText size={20} className="mb-2 text-text-muted" />
          <div className="font-bold mb-1 text-text-primary">View Posts</div>
          <div className="text-xs text-text-muted">Manage content pipeline</div>
        </Card>
      </div>

      {/* Brands */}
      <h2 className="text-sm font-bold text-text-primary mb-4">Your Brands</h2>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3 mb-4">
                <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-8 w-full rounded-md" />
            </Card>
          ))
        ) : brands.map((brand) => (
          <Card
            key={brand.id}
            clickable
            onClick={() => router.push(`/dashboard/generate?brand=${brand.id}`)}
          >
            <div className="flex items-center gap-3 mb-4">
              {brand.logo_url ? (
                <img src={brand.logo_url} alt={brand.name} className="w-10 h-10 rounded-md object-cover flex-shrink-0" />
              ) : (
                <div
                  className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center text-white font-bold text-sm leading-none"
                  style={{ backgroundColor: brand.brand_colour || "#6366f1" }}
                >
                  {brand.name[0]?.toUpperCase() || "B"}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-bold text-text-primary text-sm truncate">{brand.name}</div>
                <div className="text-xs text-text-muted truncate">{brand.industry}</div>
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

