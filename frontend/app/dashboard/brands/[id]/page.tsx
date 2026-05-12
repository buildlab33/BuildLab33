"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBrand, updateBrand, archiveBrand, restoreBrand, ingestBrandUrls, type BrandDetail } from "@/lib/api";
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
  { value: "UTC", label: "(UTC+00:00) UTC" },
  { value: "Europe/London", label: "(UTC+00:00) London" },
  { value: "Europe/Paris", label: "(UTC+01:00) Paris, Berlin, Rome" },
  { value: "Europe/Istanbul", label: "(UTC+03:00) Istanbul" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Dubai, Abu Dhabi" },
  { value: "Asia/Karachi", label: "(UTC+05:00) Karachi, Islamabad" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) Mumbai, New Delhi" },
  { value: "Asia/Dhaka", label: "(UTC+06:00) Dhaka" },
  { value: "Asia/Bangkok", label: "(UTC+07:00) Bangkok, Jakarta, Hanoi" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Kuala Lumpur, Singapore" },
  { value: "Asia/Kuala_Lumpur", label: "(UTC+08:00) Kuala Lumpur" },
  { value: "Asia/Hong_Kong", label: "(UTC+08:00) Hong Kong, Beijing" },
  { value: "Asia/Taipei", label: "(UTC+08:00) Taipei" },
  { value: "Asia/Jakarta", label: "(UTC+07:00) Jakarta, Surabaya" },
  { value: "Asia/Seoul", label: "(UTC+09:00) Seoul" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Osaka, Sapporo, Tokyo" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Sydney, Melbourne" },
  { value: "Pacific/Auckland", label: "(UTC+12:00) Auckland, Wellington" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Los Angeles, Seattle" },
  { value: "America/New_York", label: "(UTC-05:00) New York, Washington DC" },
  { value: "America/Chicago", label: "(UTC-06:00) Chicago, Dallas" },
  { value: "America/Sao_Paulo", label: "(UTC-03:00) São Paulo, Rio de Janeiro" },
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
  const [samplePosts, setSamplePosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState("");
  const [savingPosts, setSavingPosts] = useState(false);
  const [expandedPost, setExpandedPost] = useState<number | null>(null);
  const [ingestUrls, setIngestUrls] = useState<string[]>([]);
  const [newIngestUrl, setNewIngestUrl] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestPreview, setIngestPreview] = useState<Record<string, unknown> | null>(null);
  const [savingVoice, setSavingVoice] = useState(false);
  const [postsPerWeek, setPostsPerWeek] = useState(3);
  const [cadencePlatforms, setCadencePlatforms] = useState<string[]>([]);
  const [preferredDays, setPreferredDays] = useState<string[]>([]);
  const [savingCadence, setSavingCadence] = useState(false);

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
        const vc = b.voice_config as Record<string, unknown>;
        setSamplePosts((vc?.sample_posts as string[]) || []);
        const cadence = vc?.posting_cadence as Record<string, unknown> | undefined;
        if (cadence) {
          setPostsPerWeek((cadence.posts_per_week as number) || 3);
          setCadencePlatforms((cadence.platforms as string[]) || []);
          setPreferredDays((cadence.preferred_days as string[]) || []);
        }
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

  const handleSaveCadence = async () => {
    if (!id || !brand) return;
    setSavingCadence(true);
    try {
      const existingVc = (brand.voice_config as Record<string, unknown>) || {};
      await updateBrand(id, {
        voice_config: {
          ...existingVc,
          posting_cadence: {
            posts_per_week: postsPerWeek,
            platforms: cadencePlatforms,
            preferred_days: preferredDays,
          },
        },
      });
      toast.success("Posting cadence saved");
    } catch {
      toast.error("Failed to save cadence");
    } finally {
      setSavingCadence(false);
    }
  };

  const handleSavePosts = async () => {
    if (!id || !brand) return;
    setSavingPosts(true);
    try {
      const existingVc = (brand.voice_config as Record<string, unknown>) || {};
      await updateBrand(id, { voice_config: { ...existingVc, sample_posts: samplePosts } });
      toast.success("Sample posts saved");
    } catch {
      toast.error("Failed to save sample posts");
    } finally {
      setSavingPosts(false);
    }
  };

  const addPost = () => {
    const trimmed = newPost.trim();
    if (!trimmed || samplePosts.length >= 10) return;
    setSamplePosts([...samplePosts, trimmed]);
    setNewPost("");
  };

  const removePost = (index: number) => {
    setSamplePosts(samplePosts.filter((_, i) => i !== index));
  };

  const addPillar = () => {
    if (!newPillarName.trim()) return;
    setPillars([...pillars, { name: newPillarName.trim(), description: "" }]);
    setNewPillarName("");
  };

  const removePillar = (index: number) => {
    setPillars(pillars.filter((_, i) => i !== index));
  };

  const addIngestUrl = () => {
    const trimmed = newIngestUrl.trim();
    if (!trimmed || ingestUrls.length >= 10 || ingestUrls.includes(trimmed)) return;
    setIngestUrls([...ingestUrls, trimmed]);
    setNewIngestUrl("");
  };

  const removeIngestUrl = (index: number) => {
    setIngestUrls(ingestUrls.filter((_, i) => i !== index));
  };

  const handleAnalyseUrls = async () => {
    if (!id || ingestUrls.length === 0) return;
    setIngesting(true);
    try {
      const res = await ingestBrandUrls(id, ingestUrls, false);
      setIngestPreview(res.data as Record<string, unknown>);
    } catch {
      toast.error("Could not extract content from those URLs");
    } finally {
      setIngesting(false);
    }
  };

  const handleSaveVoiceConfig = async () => {
    if (!id || !ingestPreview) return;
    setSavingVoice(true);
    try {
      await updateBrand(id, { voice_config: ingestPreview });
      toast.success("Voice config updated");
      const res = await getBrand(id);
      setBrand(res.data);
      setIngestPreview(null);
    } catch {
      toast.error("Failed to save voice config");
    } finally {
      setSavingVoice(false);
    }
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
              <div className="flex gap-3">
                <div
                  className={`w-10 self-stretch rounded-md flex-shrink-0 ${isAdmin ? "cursor-pointer" : "opacity-50"}`}
                  style={{ backgroundColor: brandColour }}
                  onClick={() => isAdmin && document.getElementById("colour-picker")?.click()}
                />
                <input
                  type="color"
                  id="colour-picker"
                  value={brandColour}
                  onChange={(e) => setBrandColour(e.target.value)}
                  disabled={!isAdmin}
                  className="sr-only"
                />
                <Input value={brandColour} onChange={(e) => setBrandColour(e.target.value)} disabled={!isAdmin} className="font-mono w-32" />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Default timezone</Label>
              {isAdmin ? (
                <select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface text-text-primary text-sm px-3 py-2 pr-8 focus:outline-none focus:border-border-active appearance-none"
                  style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
                >
                  {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                </select>
              ) : (
                <Input id="timezone" value={TIMEZONES.find(t => t.value === timezone)?.label ?? timezone} disabled />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Posting Cadence */}
        <Card>
          <CardHeader>
            <CardTitle>Posting Cadence</CardTitle>
            <p className="text-xs text-text-muted mt-0.5">Set the default posting schedule used when generating a content plan for this brand.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            {isAdmin ? (
              <>
                {/* Posts per week */}
                <div>
                  <Label className="mb-2 block">Posts per week</Label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <button
                        key={n}
                        onClick={() => setPostsPerWeek(n)}
                        className={`w-9 h-9 rounded-md text-sm font-medium transition-colors ${
                          postsPerWeek === n
                            ? "bg-primary text-white"
                            : "bg-elevated border border-border text-text-muted hover:border-primary"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platforms */}
                <div>
                  <Label className="mb-2 block">Platforms</Label>
                  <div className="flex flex-wrap gap-2">
                    {["linkedin", "instagram", "tiktok", "facebook", "x", "youtube"].map((p) => {
                      const active = cadencePlatforms.includes(p);
                      const label = p.charAt(0).toUpperCase() + p.slice(1);
                      return (
                        <button
                          key={p}
                          onClick={() =>
                            setCadencePlatforms(
                              active ? cadencePlatforms.filter((x) => x !== p) : [...cadencePlatforms, p]
                            )
                          }
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary text-white"
                              : "bg-elevated border border-border text-text-muted hover:border-primary"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preferred days */}
                <div>
                  <Label className="mb-2 block">Preferred posting days</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
                      const active = preferredDays.includes(d);
                      return (
                        <button
                          key={d}
                          onClick={() =>
                            setPreferredDays(
                              active ? preferredDays.filter((x) => x !== d) : [...preferredDays, d]
                            )
                          }
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            active
                              ? "bg-primary text-white"
                              : "bg-elevated border border-border text-text-muted hover:border-primary"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button className="w-full" variant="ghost" disabled={savingCadence} onClick={handleSaveCadence}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingCadence ? "Saving..." : "Save Posting Cadence"}
                </Button>
              </>
            ) : (
              <p className="text-xs text-text-muted">Contact your admin to update this.</p>
            )}
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
                <button
                  onClick={addPillar}
                  className="flex-shrink-0 flex items-center justify-center w-10 rounded-md border border-border bg-surface text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors py-2"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sample Posts */}
        <Card>
          <CardHeader>
            <CardTitle>Sample Posts</CardTitle>
            <p className="text-xs text-text-muted mt-0.5">Paste real posts published for this brand. The AI uses these as style references when generating content.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {samplePosts.length === 0 && (
              <p className="text-xs text-text-muted">No sample posts added yet.</p>
            )}
            {samplePosts.map((post, i) => {
              const isExpanded = expandedPost === i;
              const isLong = post.length > 180;
              return (
                <div key={i} className="relative group rounded-lg border border-border bg-elevated p-3 pr-8">
                  <p className={`text-xs text-text-secondary whitespace-pre-wrap leading-relaxed ${!isExpanded && isLong ? "line-clamp-3" : ""}`}>
                    {post}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => setExpandedPost(isExpanded ? null : i)}
                      className="text-xs text-primary hover:underline mt-1 block"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => removePost(i)}
                      className="absolute top-2 right-2 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            {isAdmin && (
              <div className="space-y-2 mt-2">
                {samplePosts.length < 10 ? (
                  <>
                    <textarea
                      value={newPost}
                      onChange={(e) => setNewPost(e.target.value)}
                      placeholder="Paste a published post here…"
                      rows={4}
                      className="w-full rounded-md border border-border bg-surface text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-border-active resize-none placeholder:text-text-muted"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={addPost}
                        disabled={!newPost.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-surface text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors text-xs disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add post
                      </button>
                      <span className="text-xs text-text-muted self-center">{samplePosts.length}/10 posts</span>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-text-muted bg-elevated border border-border rounded-lg px-3 py-2">
                    Maximum 10 sample posts reached. The AI uses the 5 most recent as style references. Remove a post to add a new one.
                  </p>
                )}
              </div>
            )}
            {isAdmin && (
              <Button className="w-full mt-1" variant="ghost" disabled={savingPosts} onClick={handleSavePosts}>
                <Save className="w-4 h-4 mr-2" />
                {savingPosts ? "Saving..." : "Save Sample Posts"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Import Brand Voice from URLs */}
        <Card>
          <CardHeader>
            <CardTitle>Import Brand Voice from URLs</CardTitle>
            <p className="text-xs text-text-muted mt-0.5">Paste your website and social media URLs. The AI will read them and generate a brand voice config automatically.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {ingestUrls.length === 0 && (
              <p className="text-xs text-text-muted">No URLs added yet.</p>
            )}
            {ingestUrls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant="outline" className="flex-1 justify-start text-xs font-normal py-1.5 px-3 font-mono truncate">
                  {url}
                </Badge>
                {isAdmin && (
                  <button onClick={() => removeIngestUrl(i)} className="text-text-muted hover:text-error transition-colors flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              <>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={newIngestUrl}
                    onChange={(e) => setNewIngestUrl(e.target.value)}
                    placeholder="https://..."
                    onKeyDown={(e) => e.key === "Enter" && addIngestUrl()}
                    disabled={ingestUrls.length >= 10}
                  />
                  <button
                    onClick={addIngestUrl}
                    disabled={ingestUrls.length >= 10}
                    className="flex-shrink-0 flex items-center justify-center w-10 rounded-md border border-border bg-surface text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors py-2 disabled:opacity-40"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  className="w-full mt-1"
                  variant="ghost"
                  disabled={ingesting || ingestUrls.length === 0}
                  onClick={handleAnalyseUrls}
                >
                  {ingesting ? "Analysing..." : `Analyse URLs`}
                  {!ingesting && (
                    <span className="ml-2 text-xs text-text-muted">({ingestUrls.length}/10 URLs)</span>
                  )}
                </Button>
              </>
            )}
            {ingestPreview && (
              <div className="mt-3 border-t border-border pt-3 space-y-3">
                {Array.isArray(ingestPreview.tone_descriptors) && (
                  <div>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1.5">Tone</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(ingestPreview.tone_descriptors as string[]).map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-elevated border border-border text-text-secondary">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(ingestPreview.avoid) && (
                  <div>
                    <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-1.5">Avoid</p>
                    <p className="text-xs text-error">
                      {(ingestPreview.avoid as string[]).join(", ")}
                    </p>
                  </div>
                )}
                {isAdmin && (
                  <Button
                    className="w-full"
                    variant="ghost"
                    disabled={savingVoice}
                    onClick={handleSaveVoiceConfig}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingVoice ? "Saving..." : "Save as Voice Config"}
                  </Button>
                )}
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
