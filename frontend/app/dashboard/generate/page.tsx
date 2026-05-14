"use client";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrands, generatePost, createPost, TrendHeadline } from "@/lib/api";
import { TrendAnchorPicker } from "@/components/domain/TrendAnchorPicker";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BrandBadge } from "@/components/domain/BrandBadge";
import { PlatformPill } from "@/components/domain/PlatformPill";
import { CharacterCounter } from "@/components/domain/CharacterCounter";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";

interface Brand { id: string; name: string; }

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
];

const PLATFORM_LIMITS: Record<string, number> = {
  linkedin: 3000, instagram: 2200, tiktok: 2200,
  facebook: 63206, x: 280, youtube: 5000,
};

function GenerateForm() {
  const searchParams = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState(searchParams.get("brand") || "");
  const [platform, setPlatform] = useState("linkedin");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState("");
  const [angle, setAngle] = useState("");
  const [trendAnchor, setTrendAnchor] = useState<TrendHeadline | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; platform: string; brand_id: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getBrands().then((res) => {
      const brandsData = res.data?.brands || res.data || [];
      setBrands(brandsData);
      if (!brandId && brandsData.length > 0) setBrandId(brandsData[0].id);
    });
  }, []);

  function collectParams() {
    return {
      brand_id: brandId,
      platform,
      campaign_goal: goal,
      audience,
      content_format: format,
      growth_angle: angle,
      trend_context: trendAnchor
        ? { title: trendAnchor.title, summary: trendAnchor.summary }
        : undefined,
    };
  }

  async function runGeneration(params: ReturnType<typeof collectParams>) {
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await generatePost(params);
      setResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    runGeneration(collectParams());
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = async (submitImmediately: boolean) => {
    if (!result) return;
    setSaving(true);
    try {
      await createPost({
        brand_id: result.brand_id,
        platform: result.platform,
        text: result.text,
        status: submitImmediately ? "pending" : "draft",
        campaign_goal: goal || undefined,
        audience: audience || undefined,
        content_format: format || undefined,
        growth_angle: angle || undefined,
      });
      toast.success(submitImmediately ? "Post submitted for approval" : "Post saved as draft");
      router.push("/dashboard/posts");
    } catch {
      toast.error("Failed to save post. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedBrand = brands.find((b) => b.id === brandId);
  const resultCharCount = result?.text.length ?? 0;
  const platformLimit = PLATFORM_LIMITS[platform] ?? 3000;

  return (
    <div>
      <PageHeader
        title="Generate Content"
        subtitle="AI-powered post generation with brand voice"
      />

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <form onSubmit={handleGenerate}>
            <div className="mb-4">
              <Label htmlFor="brand-select">Brand</Label>
              <select
                id="brand-select"
                className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-primary focus:ring-1 focus:ring-primary appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
                value={brandId}
                onChange={(e) => { setBrandId(e.target.value); setTrendAnchor(null); }}
                required
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <Label>Platform</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <PlatformPill
                    key={p.id}
                    platform={p.id}
                    active={platform === p.id}
                    onToggle={(id) => setPlatform(id)}
                  />
                ))}
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="goal-input">Campaign Goal *</Label>
              <Input
                id="goal-input"
                className="mt-1"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Build brand awareness, drive sign-ups"
                required
              />
            </div>

            <div className="mb-4">
              <Label htmlFor="audience-input">Target Audience *</Label>
              <Input
                id="audience-input"
                className="mt-1"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Streaming platform founders in SEA"
                required
              />
            </div>

            <div className="mb-4">
              <Label htmlFor="format-input">Content Format (optional)</Label>
              <Input
                id="format-input"
                className="mt-1"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="e.g. thought leadership, case study, tips"
              />
            </div>

            <div className="mb-4">
              <Label htmlFor="angle-input">Growth Angle (optional)</Label>
              <Input
                id="angle-input"
                className="mt-1"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="e.g. pain point, industry trend, success story"
              />
            </div>

            <TrendAnchorPicker
              brandId={brandId}
              goal={goal}
              audience={audience}
              platform={platform}
              value={trendAnchor}
              onChange={setTrendAnchor}
            />

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Generating..." : `✦ Generate for ${selectedBrand?.name || "Brand"}`}
            </Button>
          </form>
        </Card>

        <Card className="relative">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-text-primary">Generated Post</h3>
            {result && (
              <Button variant="ghost" onClick={handleCopy} className="text-xs px-3 py-1.5 h-auto">
                {copied ? "✓ Copied" : "Copy"}
              </Button>
            )}
          </div>

          {loading && (
            <div className="text-center py-16 text-text-muted">
              <div className="text-3xl mb-3">✦</div>
              <div className="text-sm">Generating with AI...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-error p-4 rounded-lg text-xs">{error}</div>
          )}

          {result && !loading && (
            <div>
              <div className="flex gap-2 mb-4 flex-wrap items-center">
                <BrandBadge brandId={result.brand_id} brandName={brands.find((b) => b.id === result.brand_id)?.name ?? result.brand_id} />
                <Badge>{result.platform}</Badge>
                <CharacterCounter current={resultCharCount} max={platformLimit} className="ml-auto" />
              </div>
              <div className="bg-elevated rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap min-h-[200px] text-text-primary">
                {result.text}
              </div>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Button className="text-xs" onClick={() => handleSave(true)} disabled={saving}>
                  {saving ? "Saving..." : "Submit for Approval"}
                </Button>
                <Button variant="ghost" className="text-xs border border-border" onClick={() => handleSave(false)} disabled={saving}>
                  {saving ? "Saving..." : "Save as Draft"}
                </Button>
                <Button variant="ghost" onClick={handleCopy} className="text-xs">
                  {copied ? "✓ Copied" : "Copy"}
                </Button>
                <Button variant="ghost" className="text-xs border border-border" onClick={() => runGeneration(collectParams())}>
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          {!result && !loading && !error && (
            <div className="text-center py-16 text-text-muted">
              <div className="text-4xl mb-3">✦</div>
              <div className="text-sm">Fill in the form and click Generate</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense>
      <GenerateForm />
    </Suspense>
  );
}
