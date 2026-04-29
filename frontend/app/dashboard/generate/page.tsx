"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getBrands, generatePost } from "@/lib/api";

interface Brand { id: string; name: string; }

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X (Twitter)" },
  { id: "youtube", label: "YouTube" },
];

function GenerateForm() {
  const searchParams = useSearchParams();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState(searchParams.get("brand") || "");
  const [platform, setPlatform] = useState("linkedin");
  const [goal, setGoal] = useState("");
  const [audience, setAudience] = useState("");
  const [format, setFormat] = useState("");
  const [angle, setAngle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ text: string; platform: string; brand_id: string } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getBrands().then((res) => {
      const brandsData = res.data?.brands || res.data || [];
      setBrands(brandsData);
      if (!brandId && brandsData.length > 0) setBrandId(brandsData[0].id);
    });
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await generatePost({
        brand_id: brandId,
        platform,
        campaign_goal: goal,
        audience,
        content_format: format,
        growth_angle: angle,
      });
      setResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const selectedBrand = brands.find((b) => b.id === brandId);
  const brandColor = brandId === "yeon-studios" ? "#6366f1" : "#ec4899";

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Generate Content</h1>
        <p style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
          AI-powered post generation with brand voice
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Form */}
        <div className="card">
          <form onSubmit={handleGenerate}>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Brand</label>
              <select
                className="form-input"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                required
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Platform</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPlatform(p.id)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: platform === p.id ? `2px solid ${brandColor}` : "2px solid #e5e7eb",
                      background: platform === p.id ? `${brandColor}15` : "white",
                      color: platform === p.id ? brandColor : "#374151",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Campaign Goal *</label>
              <input
                className="form-input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Build brand awareness, drive sign-ups"
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Target Audience *</label>
              <input
                className="form-input"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Streaming platform founders in SEA"
                required
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Content Format (optional)</label>
              <input
                className="form-input"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="e.g. thought leadership, case study, tips"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="form-label">Growth Angle (optional)</label>
              <input
                className="form-input"
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                placeholder="e.g. pain point, industry trend, success story"
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? "Generating..." : `✦ Generate for ${selectedBrand?.name || "Brand"}`}
            </button>
          </form>
        </div>

        {/* Result */}
        <div className="card" style={{ position: "relative" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Generated Post</h3>
            {result && (
              <button className="btn-secondary" onClick={handleCopy} style={{ fontSize: 12, padding: "6px 12px" }}>
                {copied ? "✓ Copied" : "Copy"}
              </button>
            )}
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#6b7280" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✦</div>
              <div>Generating with AI...</div>
            </div>
          )}

          {error && (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: 16, borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}

          {result && !loading && (
            <div>
              <div style={{
                display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap"
              }}>
                <span className={result.brand_id === "yeon-studios" ? "badge-yeon" : "badge-belive"}>
                  {brands.find((b) => b.id === result.brand_id)?.name}
                </span>
                <span style={{
                  background: "#f3f4f6", color: "#374151",
                  padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                }}>
                  {result.platform}
                </span>
              </div>
              <div style={{
                background: "#f9fafb", borderRadius: 8, padding: 16,
                fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap",
                minHeight: 200, color: "#1a202c",
              }}>
                {result.text}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
                <button className="btn-primary" style={{ flex: 1, fontSize: 13 }}>
                  ✓ Approve & Save
                </button>
                <button className="btn-secondary" onClick={handleGenerate} style={{ fontSize: 13 }}>
                  Regenerate
                </button>
              </div>
            </div>
          )}

          {!result && !loading && !error && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
              <div style={{ fontSize: 14 }}>Fill in the form and click Generate</div>
            </div>
          )}
        </div>
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
