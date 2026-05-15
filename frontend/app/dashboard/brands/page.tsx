"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands, archiveBrand, restoreBrand, type BrandPublic } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Building2, Plus, Archive, RotateCcw, Settings } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export default function BrandsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<BrandPublic | null>(null);

  useEffect(() => { document.title = "Brands · COP Platform"; }, []);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await getBrands(showArchived);
      setBrands(res.data?.brands || []);
    } catch {
      toast.error("Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, [showArchived]);

  const handleArchive = async () => {
    if (!archiveTarget) return;
    const { id, name } = archiveTarget;
    setArchiving(id);
    setArchiveTarget(null);
    try {
      await archiveBrand(id);
      toast.success(`${name} archived`);
      fetchBrands();
    } catch {
      toast.error("Failed to archive brand");
    } finally {
      setArchiving(null);
    }
  };

  const handleRestore = async (id: string, name: string) => {
    setArchiving(id);
    try {
      await restoreBrand(id);
      toast.success(`${name} restored`);
      fetchBrands();
    } catch {
      toast.error("Failed to restore brand");
    } finally {
      setArchiving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Manage your brand profiles and voice configurations"
        action={
          isAdmin ? (
            <Button onClick={() => router.push("/dashboard/brands/new")}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Brand
            </Button>
          ) : undefined
        }
      />

      {isAdmin && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`text-xs flex items-center gap-1.5 transition-colors ${showArchived ? "text-text-active" : "text-text-muted hover:text-text-secondary"}`}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No brands yet"
          description={isAdmin ? "Create your first brand to start generating content." : "You haven't been assigned to any brands yet."}
          action={isAdmin ? <Button onClick={() => router.push("/dashboard/brands/new")}>Add Brand</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {brands.map((brand) => (
            <Card
              key={brand.id}
              clickable={brand.status === "active"}
              onClick={brand.status === "active" ? () => router.push(`/dashboard/brands/${brand.id}`) : undefined}
              className={brand.status === "archived" ? "opacity-60" : ""}
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
                    {brand.name[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-text-primary text-sm truncate">{brand.name}</div>
                  <div className="text-xs text-text-muted truncate">{brand.industry || "—"}</div>
                </div>
                {brand.status === "archived" && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">Archived</Badge>
                )}
              </div>

              <div className="flex gap-2">
                {brand.status === "active" ? (
                  <>
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/brands/${brand.id}`); }}
                    >
                      <Settings size={14} />
                      Manage
                    </Button>
                    {isAdmin && (
                      <button
                        disabled={archiving === brand.id}
                        onClick={(e) => { e.stopPropagation(); setArchiveTarget(brand); }}
                        aria-label={`Archive ${brand.name}`}
                        title="Archive"
                        className="flex items-center justify-center w-9 self-stretch rounded-md border border-border bg-surface text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                  </>
                ) : (
                  isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1"
                      disabled={archiving === brand.id}
                      onClick={(e) => { e.stopPropagation(); handleRestore(brand.id, brand.name); }}
                    >
                      <RotateCcw size={14} />
                      Restore
                    </Button>
                  )
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!archiveTarget}
        title={archiveTarget ? `Archive ${archiveTarget.name}?` : ""}
        description="Archived brands are hidden from the brand selector and don't appear in dashboards. You can restore them anytime."
        confirmLabel="Archive"
        destructive
        loading={!!archiving && archiving === archiveTarget?.id}
        onConfirm={handleArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
