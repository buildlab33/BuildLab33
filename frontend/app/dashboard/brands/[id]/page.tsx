"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBrand, updateBrand, archiveBrand, restoreBrand, type BrandDetail } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Save, Archive, RotateCcw, ChevronLeft, Plus, X } from "lucide-react";

const TIMEZONES = [
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export default function BrandDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandColour, setBrandColour] = useState("#6366f1");
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [pillars, setPillars] = useState<Array<{ name: string; description: string }>>([]);
  const [newPillarName, setNewPillarName] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getBrand(id)
      .then((res) => {
        const b = res.data;
        setBrand(b);
        setName(b.name);
        setIndustry(b.industry || "");
        setBrandColour(b.brand_colour || "#6366f1");
        setTimezone(b.default_timezone || "Asia/Singapore");
        setPillars(b.content_pillars || []);
      })
      .catch(() => {
        toast.error("Failed to load brand");
        router.push("/dashboard/brands");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateBrand(id, {
        name,
        industry,
        brand_colour: brandColour,
        default_timezone: timezone,
        content_pillars: pillars,
      });
      toast.success("Brand saved");
    } catch {
      toast.error("Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!id || !brand) return;
    setArchiving(true);
    try {
      await archiveBrand(id);
      toast.success(`${brand.name} archived`);
      router.push("/dashboard/brands");
    } catch {
      toast.error("Failed to archive brand");
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (!id || !brand) return;
    setArchiving(true);
    try {
      await restoreBrand(id);
      toast.success(`${brand.name} restored`);
      router.push("/dashboard/brands");
    } catch {
      toast.error("Failed to restore brand");
    } finally {
      setArchiving(false);
    }
  };

  const addPillar = () => {
    if (!newPillarName.trim()) return;
    setPillars([...pillars, { name: newPillarName.trim(), description: "" }]);
    setNewPillarName("");
  };

  const removePillar = (index: number) => {
    setPillars(pillars.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!brand) return null;

  return (
    <div>
      <PageHeader
        title={brand.name}
        subtitle={brand.industry || "Brand settings"}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/brands")}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            {isAdmin && (
              brand.status === "active" ? (
                <Button variant="danger" size="sm" disabled={archiving} onClick={handleArchive}>
                  <Archive className="w-4 h-4 mr-1" />
                  Archive
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={archiving} onClick={handleRestore}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restore
                </Button>
              )
            )}
          </div>
        }
      />

      {brand.status === "archived" && (
        <div className="mb-4 px-4 py-2 bg-elevated border border-warning/30 rounded-lg text-xs text-warning">
          This brand is archived. Restore it to use it in content generation.
        </div>
      )}

      <div className="space-y-4 max-w-lg">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Brand name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={!isAdmin} />
            </div>
            <div>
              <Label htmlFor="colour">Brand colour</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="colour"
                  value={brandColour}
                  onChange={(e) => setBrandColour(e.target.value)}
                  disabled={!isAdmin}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Input value={brandColour} onChange={(e) => setBrandColour(e.target.value)} disabled={!isAdmin} className="font-mono w-32" />
                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: brandColour }} />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Default timezone</Label>
              {isAdmin ? (
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-border-active"
                >
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              ) : (
                <Input id="timezone" value={timezone} disabled />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content Pillars */}
        <Card>
          <CardHeader><CardTitle>Content Pillars</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pillars.length === 0 && (
              <p className="text-xs text-text-muted">No content pillars defined.</p>
            )}
            {pillars.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant="outline" className="flex-1 justify-start text-xs font-normal py-1.5 px-3">
                  {p.name}
                </Badge>
                {isAdmin && (
                  <button onClick={() => removePillar(i)} className="text-text-muted hover:text-error transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newPillarName}
                  onChange={(e) => setNewPillarName(e.target.value)}
                  placeholder="Add a content pillar..."
                  onKeyDown={(e) => e.key === "Enter" && addPillar()}
                />
                <Button size="sm" variant="ghost" onClick={addPillar}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Config (read-only preview) */}
        {brand.voice_config && Object.keys(brand.voice_config).length > 0 && (
          <Card>
            <CardHeader><CardTitle>Brand Voice Config</CardTitle></CardHeader>
            <CardContent>
              {Array.isArray((brand.voice_config as Record<string, unknown>).tone_descriptors) && (
                <div className="mb-3">
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1.5">Tone</p>
                  <div className="flex flex-wrap gap-1.5">
                    {((brand.voice_config as Record<string, unknown>).tone_descriptors as string[]).map((t) => (
                      <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-elevated border border-border text-text-secondary">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray((brand.voice_config as Record<string, unknown>).avoid) && (
                <div>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1.5">Avoid</p>
                  <p className="text-xs text-error">
                    {((brand.voice_config as Record<string, unknown>).avoid as string[]).join(", ")}
                  </p>
                </div>
              )}
              <p className="text-xs text-text-muted mt-3">
                Voice config is generated during brand creation and used automatically in content generation.
              </p>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Button className="w-full" disabled={saving} onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
    </div>
  );
}
