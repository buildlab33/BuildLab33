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

export default function BrandsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

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

  const handleArchive = async (id: string, name: string) => {
    setArchiving(id);
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
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt={brand.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base"
                        style={{ backgroundColor: brand.brand_colour }}
                      >
                        {brand.name[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-text-primary text-sm">{brand.name}</div>
                      <div className="text-xs text-text-muted">{brand.industry || "—"}</div>
                    </div>
                  </div>
                  {brand.status === "archived" && (
                    <Badge variant="outline" className="text-xs">Archived</Badge>
                  )}
                </div>

                <div className="text-xs text-text-muted mb-4">{brand.default_timezone}</div>

                <div className="flex gap-2">
                  {brand.status === "active" ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/brands/${brand.id}`); }}
                      >
                        <Settings className="w-3.5 h-3.5 mr-1" />
                        Manage
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          disabled={archiving === brand.id}
                          onClick={(e) => { e.stopPropagation(); handleArchive(brand.id, brand.name); }}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-xs"
                        disabled={archiving === brand.id}
                        onClick={(e) => { e.stopPropagation(); handleRestore(brand.id, brand.name); }}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Restore
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
