"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands, getPosts } from "@/lib/api";
import { getContacts } from "@/lib/contacts-api";
import { useAuthStore } from "@/store/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { Sparkles, FileText, ArrowRight, Inbox, CalendarClock, Users, Briefcase } from "lucide-react";

interface Brand {
  id: string;
  name: string;
  industry: string;
  brand_colour?: string;
  logo_url?: string | null;
  status?: string;
}

interface Stats {
  pendingApproval: number;
  scheduledToday: number;
  activeLeads: number;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const t = new Date();
  return d.getFullYear() === t.getFullYear()
    && d.getMonth() === t.getMonth()
    && d.getDate() === t.getDate();
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [stats, setStats] = useState<Stats>({ pendingApproval: 0, scheduledToday: 0, activeLeads: 0 });
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    getBrands()
      .then((res) => setBrands(res.data?.brands || []))
      .catch(() => toast.error("Failed to load brands"))
      .finally(() => setLoadingBrands(false));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [pending, scheduled, contacts] = await Promise.all([
          getPosts({ status: "submitted" }).catch(() => ({ data: [] })),
          getPosts({ status: "scheduled" }).catch(() => ({ data: [] })),
          getContacts().catch(() => ({ data: [] })),
        ]);
        const scheduledToday = scheduled.data.filter((p) => p.scheduled_at && isToday(p.scheduled_at)).length;
        const activeLeads = contacts.data.filter((c) =>
          ["lead", "contacted", "replied", "meeting"].includes(c.status)
        ).length;
        setStats({ pendingApproval: pending.data.length, scheduledToday, activeLeads });
      } finally {
        setLoadingStats(false);
      }
    })();
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
        title={`${greeting()}, ${user?.name?.split(" ")[0] || "there"}`}
        subtitle="Here's what's happening across your brands today."
      />

      {/* Stat tiles */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
        <StatTile
          label="Pending approval"
          value={loadingStats ? null : stats.pendingApproval}
          icon={<Inbox size={18} />}
          tone={stats.pendingApproval > 0 ? "warning" : "muted"}
          onClick={() => router.push("/dashboard/posts?status=submitted")}
        />
        <StatTile
          label="Scheduled today"
          value={loadingStats ? null : stats.scheduledToday}
          icon={<CalendarClock size={18} />}
          tone="info"
          onClick={() => router.push("/dashboard/calendar")}
        />
        <StatTile
          label="Active leads"
          value={loadingStats ? null : stats.activeLeads}
          icon={<Users size={18} />}
          tone="primary"
          onClick={() => router.push("/dashboard/leads")}
        />
      </div>

      {/* Quick actions */}
      <h2 className="text-base font-bold text-text-primary mb-4">Quick actions</h2>
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        <Card
          clickable
          onClick={() => router.push("/dashboard/generate")}
          className="border-primary/30 bg-primary-muted/30"
        >
          <Sparkles size={20} className="mb-3 text-primary" />
          <div className="font-bold mb-1 text-text-primary">Generate Content</div>
          <div className="text-sm text-text-secondary">AI-powered post creation</div>
        </Card>
        <Card
          clickable
          onClick={() => router.push("/dashboard/posts")}
        >
          <FileText size={20} className="mb-3 text-text-secondary" />
          <div className="font-bold mb-1 text-text-primary">View Posts</div>
          <div className="text-sm text-text-secondary">Manage content pipeline</div>
        </Card>
      </div>

      {/* Brands */}
      <h2 className="text-base font-bold text-text-primary mb-4">Your Brands</h2>
      {loadingBrands ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {Array.from({ length: 3 }).map((_, i) => (
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
          ))}
        </div>
      ) : brands.length === 0 ? (
        <Card className="text-center py-10">
          <Briefcase size={32} className="mx-auto mb-3 text-text-muted opacity-50" />
          <div className="font-bold text-text-primary mb-1">No brands yet</div>
          <p className="text-sm text-text-secondary mb-4 max-w-sm mx-auto">
            Create your first brand to start generating content tailored to its voice.
          </p>
          <Button onClick={() => router.push("/dashboard/brands/new")}>
            Create a brand
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {brands.map((brand) => (
            <Card
              key={brand.id}
              clickable
              onClick={() => router.push(`/dashboard/generate?brand=${brand.id}`)}
            >
              <div className="flex items-center gap-3 mb-4">
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logo_url}
                    alt={brand.name}
                    width={40}
                    height={40}
                    loading="lazy"
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-md flex-shrink-0 flex items-center justify-center text-white font-bold text-sm leading-none"
                    style={{ backgroundColor: brand.brand_colour || "var(--color-primary)" }}
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
                className="w-full"
                size="sm"
                onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/generate?brand=${brand.id}`); }}
              >
                Generate Post <ArrowRight size={14} />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({
  label, value, icon, tone, onClick,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  tone: "primary" | "warning" | "info" | "muted";
  onClick: () => void;
}) {
  const toneClass = {
    primary: "text-primary bg-primary/10",
    warning: "text-warning bg-warning/10",
    info: "text-info bg-blue-500/10",
    muted: "text-text-muted bg-elevated",
  }[tone];

  return (
    <Card clickable onClick={onClick}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
        <span className={`w-7 h-7 rounded-md flex items-center justify-center ${toneClass}`}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-text-primary tabular-nums">
        {value === null ? <Skeleton className="h-7 w-10" /> : value}
      </div>
    </Card>
  );
}
