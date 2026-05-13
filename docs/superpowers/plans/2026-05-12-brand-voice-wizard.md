# Brand Voice Intake Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-card URL import on the brand settings page with a polished 4-step wizard that scrapes URLs (or accepts pasted text), lets the user review/edit captured content, generates a voice config with live phase progress, and presents all 6 config fields for editing before saving — with a server-read merge so nothing already saved is ever silently overwritten.

**Architecture:** Backend gains a new `/api/brands/{id}/analyse-sources` endpoint that returns a structured `ScrapeResult` (per-source status, warning flags, combined text, char count) without generating — generation stays in `generate-voice-config`. Frontend replaces the "Import Brand Voice from URLs" card with a `BrandVoiceWizard` modal component (`WizardStep` enum drives which panel renders). Save does a `getBrand` read first, merges only wizard keys into existing `voice_config`, then calls `updateBrand`.

**Tech Stack:** FastAPI + httpx (backend scraping), Pydantic v2 (structured response), Next.js 16 App Router, TypeScript, Tailwind CSS v4 custom tokens, existing `api.ts` axios instance.

---

## File Map

**Backend — new/modified:**
- `backend/app/services/url_scraper.py` — modify: add per-URL structured result, warning flags, paste-input support
- `backend/app/schemas/brands.py` — modify: add `AnalyseSourcesRequest`, `SourceResult`, `AnalyseSourcesResponse`
- `backend/app/routers/brands.py` — modify: add `POST /{brand_id}/analyse-sources` endpoint with audit log; remove old `ingest-urls` endpoint (replaced)

**Frontend — new/modified:**
- `frontend/lib/api.ts` — modify: add `analyseSourcesForBrand`, `generateVoiceConfigForBrand` helpers; remove `ingestBrandUrls`
- `frontend/components/domain/BrandVoiceWizard.tsx` — **create**: full 4-step wizard modal
- `frontend/app/dashboard/brands/[id]/page.tsx` — modify: remove old URL import card, add wizard trigger button, wire `onSaved` callback

---

## Task 1: Backend — Structured Scraper Response

**Files:**
- Modify: `backend/app/services/url_scraper.py`
- Modify: `backend/app/schemas/brands.py`

- [ ] **Step 1: Add schemas**

Open `backend/app/schemas/brands.py`. Add these classes after `IngestUrlsRequest` (keep the old class — it gets removed in Task 2):

```python
class SourceResult(BaseModel):
    source_label: str           # URL or "Pasted text"
    char_count: int
    warning: str | None = None  # "empty", "short", "js_rendered"
    text: str                   # extracted/pasted text, capped at MAX_CHARS


class AnalyseSourcesRequest(BaseModel):
    urls: list[AnyHttpUrl] = Field(default=[], max_length=10)
    pasted_texts: list[str] = Field(default=[])

    @field_validator("pasted_texts")
    @classmethod
    def cap_pasted_texts(cls, v: list[str]) -> list[str]:
        MAX = 5000
        return [t[:MAX] for t in v]


class AnalyseSourcesResponse(BaseModel):
    sources: list[SourceResult]
    combined_text: str
    total_chars: int
    has_warnings: bool
```

- [ ] **Step 2: Rewrite `url_scraper.py`**

Replace the full contents of `backend/app/services/url_scraper.py`:

```python
"""Fetch and extract readable text from URLs for brand voice ingestion."""
import asyncio
import logging
import re
import httpx
from app.schemas.brands import SourceResult

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; COPBot/1.0)"}
TIMEOUT = 10.0
MAX_CHARS = 3000  # per source
SHORT_THRESHOLD = 200


def _strip_html(html: str) -> str:
    """Remove tags, scripts, styles, collapse whitespace."""
    html = re.sub(r"<(script|style)[^>]*>.*?</(script|style)>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<[^>]+>", " ", html)
    html = re.sub(r"&#?\w+;", " ", html)
    html = re.sub(r"\s+", " ", html)
    return html.strip()


async def fetch_url_result(url: str) -> SourceResult:
    """Fetch a single URL and return a SourceResult with warning flags."""
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            raw = _strip_html(resp.text)
            text = raw[:MAX_CHARS]
            if not text.strip():
                return SourceResult(source_label=url, char_count=0, warning="empty", text="")
            if len(text.strip()) < SHORT_THRESHOLD:
                return SourceResult(source_label=url, char_count=len(text), warning="js_rendered", text=text)
            return SourceResult(source_label=url, char_count=len(text), text=text)
    except Exception as exc:
        logger.warning("Failed to fetch %s: %s", url, exc)
        return SourceResult(source_label=url, char_count=0, warning="empty", text="")


def make_pasted_result(text: str, index: int) -> SourceResult:
    """Wrap pasted text as a SourceResult."""
    capped = text[:MAX_CHARS]
    label = f"Pasted text {index + 1}"
    if not capped.strip():
        return SourceResult(source_label=label, char_count=0, warning="empty", text="")
    if len(capped.strip()) < SHORT_THRESHOLD:
        return SourceResult(source_label=label, char_count=len(capped), warning="short", text=capped)
    return SourceResult(source_label=label, char_count=len(capped), text=capped)


async def analyse_sources(urls: list[str], pasted_texts: list[str]) -> list[SourceResult]:
    """Fetch all URLs concurrently and wrap pasted texts; return per-source results."""
    url_results = await asyncio.gather(*[fetch_url_result(u) for u in urls])
    paste_results = [make_pasted_result(t, i) for i, t in enumerate(pasted_texts)]
    return list(url_results) + paste_results
```

- [ ] **Step 3: Run scraper tests manually**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\backend
.venv\Scripts\python.exe -c "
import asyncio
from app.services.url_scraper import analyse_sources
results = asyncio.run(analyse_sources(['https://example.com'], ['Hello world']))
for r in results:
    print(r.source_label, r.char_count, r.warning)
"
```

Expected output (two lines):
```
https://example.com 1270 None
Pasted text 1 11 short
```
(exact char count will vary; no crash = pass)

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/url_scraper.py backend/app/schemas/brands.py
git commit -m "feat: structured scraper response with per-source warnings and paste support"
```

---

## Task 2: Backend — New `analyse-sources` Endpoint

**Files:**
- Modify: `backend/app/routers/brands.py`

- [ ] **Step 1: Add import and new endpoint**

In `backend/app/routers/brands.py`, update the imports at the top to add:
```python
from app.schemas.brands import (
    BrandCreate,
    BrandDetail,
    BrandUpdate,
    GenerateVoiceConfigRequest,
    AnalyseSourcesRequest,
    AnalyseSourcesResponse,
)
from app.services.url_scraper import analyse_sources
```

Remove the `IngestUrlsRequest` import and `from app.services.url_scraper import scrape_urls` import.

Then replace the entire `# ── Ingest URLs` section (lines ~92–126) with:

```python
# ── Analyse sources ───────────────────────────────────────────────────────────

@router.post("/{brand_id}/analyse-sources", response_model=AnalyseSourcesResponse)
async def analyse_brand_sources(
    brand_id: str,
    body: AnalyseSourcesRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Scrape URLs and/or accept pasted text; return per-source structured results."""
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    brand = get_brand(brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not body.urls and not body.pasted_texts:
        raise HTTPException(status_code=422, detail="Provide at least one URL or pasted text")

    sources = await analyse_sources(
        [str(u) for u in body.urls],
        body.pasted_texts,
    )

    valid_sources = [s for s in sources if s.text.strip()]
    if not valid_sources:
        raise HTTPException(status_code=422, detail="Could not extract content from any source")

    combined = "\n\n---\n\n".join(
        f"[Source: {s.source_label}]\n{s.text}" for s in valid_sources
    )

    try:
        sb = get_supabase()
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "brand_voice_analyse",
            "detail": f"Analysed {len(sources)} sources for brand {brand_id}",
        }).execute()
    except Exception:
        pass

    return AnalyseSourcesResponse(
        sources=sources,
        combined_text=combined,
        total_chars=sum(s.char_count for s in sources),
        has_warnings=any(s.warning for s in sources),
    )
```

- [ ] **Step 2: Start backend and test endpoint**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\backend
.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

In a second terminal:
```bash
curl -X POST http://localhost:8000/api/brands/TEST_BRAND_ID/analyse-sources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"urls": [], "pasted_texts": ["This is a test brand post about innovation."]}'
```

Expected: `{"sources":[{"source_label":"Pasted text 1","char_count":42,"warning":"short","text":"..."}],"combined_text":"...","total_chars":42,"has_warnings":true}`

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/brands.py
git commit -m "feat: add analyse-sources endpoint replacing ingest-urls"
```

---

## Task 3: Frontend API Helper

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add types and helpers**

Open `frontend/lib/api.ts`. Find the `ingestBrandUrls` export and replace it with:

```typescript
// ── Brand Voice Wizard ────────────────────────────────────────────────────

export interface SourceResult {
  source_label: string;
  char_count: number;
  warning: "empty" | "short" | "js_rendered" | null;
  text: string;
}

export interface AnalyseSourcesResponse {
  sources: SourceResult[];
  combined_text: string;
  total_chars: number;
  has_warnings: boolean;
}

export const analyseSourcesForBrand = (
  brandId: string,
  urls: string[],
  pasted_texts: string[]
) =>
  api.post<AnalyseSourcesResponse>(`/api/brands/${brandId}/analyse-sources`, {
    urls,
    pasted_texts,
  });

export interface VoiceConfigResult {
  tone_descriptors: string[];
  content_pillars: Array<{ name: string; description: string }>;
  platform_rules: Record<string, string>;
  word_bank: string[];
  avoid: string[];
  sample_prompts: string[];
}

export const generateVoiceConfigForBrand = (data: {
  brand_name: string;
  industry: string;
  interview_answers: InterviewAnswer[];
  sample_posts: string[];
}) => api.post<VoiceConfigResult>("/api/brands/generate-voice-config", data);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing errors unrelated to api.ts)

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add analyseSourcesForBrand and VoiceConfigResult types to api.ts"
```

---

## Task 4: BrandVoiceWizard — Step 1 (Source Selection)

**Files:**
- Create: `frontend/components/domain/BrandVoiceWizard.tsx`

This task creates the wizard modal shell plus Step 1 only. Steps 2–4 are added in Tasks 5–7.

- [ ] **Step 1: Create the file with Step 1 implemented**

Create `frontend/components/domain/BrandVoiceWizard.tsx`:

```tsx
"use client";
import { useRef, useState } from "react";
import { analyseSourcesForBrand, AnalyseSourcesResponse, SourceResult, VoiceConfigResult } from "@/lib/api";
import { Plus, X, AlertTriangle, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────

interface Props {
  brandId: string;
  brandName: string;
  brandIndustry: string;
  onClose: () => void;
  onSaved: () => void;
}

type WizardStep = "source" | "review" | "generate" | "config";

const PLATFORM_ORDER = ["linkedin", "instagram", "tiktok", "facebook", "x", "youtube"];
const MAX_PASTE_CHARS = 5000;

// ── Warning badge ─────────────────────────────────────────────────────────

function WarningBadge({ warning }: { warning: SourceResult["warning"] }) {
  if (!warning) return null;
  const msgs: Record<string, string> = {
    empty: "No content extracted",
    short: "Very little text captured",
    js_rendered: "Page may be JavaScript-rendered — little content captured",
  };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" /> {msgs[warning] ?? warning}
    </span>
  );
}

// ── Wizard shell ──────────────────────────────────────────────────────────

export default function BrandVoiceWizard({ brandId, brandName, brandIndustry, onClose, onSaved }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Step navigation
  const [step, setStep] = useState<WizardStep>("source");

  // Step 1 state — source selection
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedTexts, setPastedTexts] = useState<string[]>([""]);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");

  // Step 2 state — content review
  const [analysisResult, setAnalysisResult] = useState<AnalyseSourcesResponse | null>(null);
  const [editedSources, setEditedSources] = useState<SourceResult[]>([]);

  // Step 3 state — generation
  const [generating, setGenerating] = useState(false);
  const [generatePhase, setGeneratePhase] = useState("");
  const [generateError, setGenerateError] = useState("");

  // Step 4 state — config review
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfigResult | null>(null);
  const [editTone, setEditTone] = useState<string[]>([]);
  const [editAvoid, setEditAvoid] = useState<string[]>([]);
  const [editWordBank, setEditWordBank] = useState<string[]>([]);
  const [editSamplePrompts, setEditSamplePrompts] = useState<string[]>([]);
  const [editPlatformRules, setEditPlatformRules] = useState<Record<string, string>>({});
  const [editPillars, setEditPillars] = useState<Array<{ name: string; description: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function handleBackdropMouseDown(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  // ── Step 1 helpers ────────────────────────────────────────────────────

  function addUrl() {
    const trimmed = urlInput.trim();
    if (!trimmed || urls.length >= 10 || urls.includes(trimmed)) return;
    try { new URL(trimmed); } catch { return; }
    setUrls([...urls, trimmed]);
    setUrlInput("");
  }

  function removeUrl(i: number) {
    setUrls(urls.filter((_, idx) => idx !== i));
  }

  function updatePastedText(i: number, value: string) {
    const next = [...pastedTexts];
    next[i] = value.slice(0, MAX_PASTE_CHARS);
    setPastedTexts(next);
  }

  function addPasteBox() {
    if (pastedTexts.length >= 5) return;
    setPastedTexts([...pastedTexts, ""]);
  }

  function removePasteBox(i: number) {
    setPastedTexts(pastedTexts.filter((_, idx) => idx !== i));
  }

  async function handleAnalyse() {
    const validPasted = pastedTexts.filter((t) => t.trim().length > 0);
    if (urls.length === 0 && (!showPaste || validPasted.length === 0)) return;
    setAnalyseError("");
    setAnalysing(true);
    try {
      const res = await analyseSourcesForBrand(
        brandId,
        urls,
        showPaste ? validPasted : []
      );
      setAnalysisResult(res.data);
      setEditedSources(res.data.sources.map((s) => ({ ...s })));
      setStep("review");
    } catch {
      setAnalyseError("Could not reach some sources. Check URLs and try again.");
    } finally {
      setAnalysing(false);
    }
  }

  const canAnalyse = urls.length > 0 || (showPaste && pastedTexts.some((t) => t.trim().length > 0));

  // ── Step labels ────────────────────────────────────────────────────────

  const STEPS: { key: WizardStep; label: string }[] = [
    { key: "source", label: "Sources" },
    { key: "review", label: "Review" },
    { key: "generate", label: "Generate" },
    { key: "config", label: "Config" },
  ];
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onMouseDown={handleBackdropMouseDown}
    >
      <div className="relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-text-primary">Brand Voice Wizard</h2>
            <p className="text-xs text-text-muted mt-0.5">{brandName}</p>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1 flex-1 justify-center">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  i === stepIndex
                    ? "bg-primary text-white"
                    : i < stepIndex
                    ? "bg-primary/20 text-primary"
                    : "bg-elevated text-text-muted"
                }`}>
                  <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                    {i < stepIndex ? "✓" : i + 1}
                  </span>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-elevated hover:bg-border text-text-muted hover:text-text-primary transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {step === "source" && (
            <Step1Sources
              urlInput={urlInput}
              setUrlInput={setUrlInput}
              urls={urls}
              addUrl={addUrl}
              removeUrl={removeUrl}
              showPaste={showPaste}
              setShowPaste={setShowPaste}
              pastedTexts={pastedTexts}
              updatePastedText={updatePastedText}
              addPasteBox={addPasteBox}
              removePasteBox={removePasteBox}
            />
          )}
          {/* Steps 2–4 added in Tasks 5–7 */}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-elevated flex-shrink-0 flex items-center justify-between gap-2">
          <div className="text-xs text-error">{analyseError}</div>
          <div className="flex gap-2 ml-auto">
            {step !== "source" && (
              <button
                onClick={() => setStep(STEPS[stepIndex - 1].key)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-text-secondary hover:bg-elevated text-sm font-medium transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === "source" && (
              <button
                onClick={handleAnalyse}
                disabled={analysing || !canAnalyse}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {analysing && <Loader2 className="w-4 h-4 animate-spin" />}
                {analysing ? "Analysing..." : "Analyse Sources"}
                {!analysing && <ChevronRight className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Source Selection ──────────────────────────────────────────────

interface Step1Props {
  urlInput: string;
  setUrlInput: (v: string) => void;
  urls: string[];
  addUrl: () => void;
  removeUrl: (i: number) => void;
  showPaste: boolean;
  setShowPaste: (v: boolean) => void;
  pastedTexts: string[];
  updatePastedText: (i: number, v: string) => void;
  addPasteBox: () => void;
  removePasteBox: (i: number) => void;
}

function Step1Sources({
  urlInput, setUrlInput, urls, addUrl, removeUrl,
  showPaste, setShowPaste, pastedTexts, updatePastedText, addPasteBox, removePasteBox,
}: Step1Props) {
  return (
    <div className="space-y-5">
      {/* URLs */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Website URLs</h3>
        <p className="text-xs text-text-muted mb-3">
          Add your brand website, about page, or blog URLs (up to 10). The AI will read their text content.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addUrl()}
            placeholder="https://yourbrand.com/about"
            disabled={urls.length >= 10}
            className="flex-1 rounded-lg border border-border bg-elevated text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-border-active placeholder:text-text-muted disabled:opacity-40"
          />
          <button
            onClick={addUrl}
            disabled={urls.length >= 10 || !urlInput.trim()}
            className="flex-shrink-0 w-10 h-9 flex items-center justify-center rounded-lg border border-border bg-elevated text-text-secondary hover:bg-border disabled:opacity-40 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {urls.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elevated border border-border">
                <span className="flex-1 text-xs text-text-secondary font-mono truncate">{url}</span>
                <button onClick={() => removeUrl(i)} className="text-text-muted hover:text-error transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <p className="text-xs text-text-muted">{urls.length}/10 URLs</p>
          </div>
        )}
      </div>

      {/* Paste toggle */}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Recent Posts / Captions</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Optional — paste real posts to show the AI your brand's voice directly.
            </p>
          </div>
          <button
            onClick={() => setShowPaste(!showPaste)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showPaste
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-elevated border-border text-text-muted hover:border-primary/30"
            }`}
          >
            {showPaste ? "Hide" : "Add posts"}
          </button>
        </div>

        {showPaste && (
          <div className="space-y-3 mt-3">
            {pastedTexts.map((text, i) => (
              <div key={i} className="relative">
                <textarea
                  value={text}
                  onChange={(e) => updatePastedText(i, e.target.value)}
                  placeholder={`Paste post #${i + 1} here…`}
                  rows={4}
                  className="w-full rounded-lg border border-border bg-elevated text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-border-active resize-none placeholder:text-text-muted"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs ${text.length >= MAX_PASTE_CHARS ? "text-error" : "text-text-muted"}`}>
                    {text.length}/{MAX_PASTE_CHARS} chars
                  </span>
                  {pastedTexts.length > 1 && (
                    <button onClick={() => removePasteBox(i)} className="text-xs text-text-muted hover:text-error transition-colors">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
            {pastedTexts.length < 5 && (
              <button
                onClick={addPasteBox}
                className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add another post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `BrandVoiceWizard.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/BrandVoiceWizard.tsx
git commit -m "feat: BrandVoiceWizard Step 1 — source selection with URL list and optional paste"
```

---

## Task 5: BrandVoiceWizard — Step 2 (Content Review)

**Files:**
- Modify: `frontend/components/domain/BrandVoiceWizard.tsx`

Step 2 shows each source card with its captured text, a warning badge if applicable, and an editable textarea so the user can fix thin/empty content before generation.

- [ ] **Step 1: Add Step2Review component and wire it**

At the bottom of `frontend/components/domain/BrandVoiceWizard.tsx`, add:

```tsx
// ── Step 2: Content Review ────────────────────────────────────────────────

interface Step2Props {
  sources: SourceResult[];
  editedSources: SourceResult[];
  setEditedSources: (sources: SourceResult[]) => void;
  hasWarnings: boolean;
}

function Step2Review({ sources: _sources, editedSources, setEditedSources, hasWarnings }: Step2Props) {
  function updateText(i: number, text: string) {
    const next = [...editedSources];
    next[i] = { ...next[i], text, char_count: text.length };
    setEditedSources(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Review captured content</h3>
        <p className="text-xs text-text-muted">
          This is what the AI will read. Edit or replace any source that looks empty or wrong.
        </p>
      </div>

      {hasWarnings && (
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-lg px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-warning">
            Some sources returned little or no content — usually because the page is JavaScript-rendered or blocked. You can paste the content manually below.
          </p>
        </div>
      )}

      {editedSources.map((source, i) => (
        <div key={i} className="rounded-lg border border-border bg-elevated p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-text-secondary truncate">{source.source_label}</span>
            <WarningBadge warning={source.warning} />
          </div>
          <textarea
            value={source.text}
            onChange={(e) => updateText(i, e.target.value.slice(0, 3000))}
            rows={source.warning ? 5 : 3}
            placeholder="Paste content here if the source returned nothing useful…"
            className="w-full rounded-lg border border-border bg-surface text-text-primary text-xs px-3 py-2 focus:outline-none focus:border-border-active resize-none placeholder:text-text-muted"
          />
          <p className={`text-xs ${source.char_count >= 3000 ? "text-error" : "text-text-muted"}`}>
            {source.char_count}/3000 chars
          </p>
        </div>
      ))}
    </div>
  );
}
```

In the wizard's body section, replace the comment `{/* Steps 2–4 added in Tasks 5–7 */}` with:

```tsx
          {step === "review" && analysisResult && (
            <Step2Review
              sources={analysisResult.sources}
              editedSources={editedSources}
              setEditedSources={setEditedSources}
              hasWarnings={analysisResult.has_warnings}
            />
          )}
          {/* Steps 3–4 added in Tasks 6–7 */}
```

In the footer section, add the Review step's Next button after the existing Step 1 button block. Replace the footer's button section with:

```tsx
          {step === "source" && (
              <button
                onClick={handleAnalyse}
                disabled={analysing || !canAnalyse}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {analysing && <Loader2 className="w-4 h-4 animate-spin" />}
                {analysing ? "Analysing..." : "Analyse Sources"}
                {!analysing && <ChevronRight className="w-4 h-4" />}
              </button>
            )}
            {step === "review" && (
              <button
                onClick={() => setStep("generate")}
                disabled={editedSources.every((s) => !s.text.trim())}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Generate Voice Config <ChevronRight className="w-4 h-4" />
              </button>
            )}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/BrandVoiceWizard.tsx
git commit -m "feat: BrandVoiceWizard Step 2 — editable content review with warning badges"
```

---

## Task 6: BrandVoiceWizard — Step 3 (Generation with Phase Progress)

**Files:**
- Modify: `frontend/components/domain/BrandVoiceWizard.tsx`

Step 3 auto-triggers generation on mount, shows phase progress messages, then transitions to Step 4 on success.

- [ ] **Step 1: Add generation logic and Step3Generating component**

At the bottom of `BrandVoiceWizard.tsx` add:

```tsx
// ── Step 3: Generating ────────────────────────────────────────────────────

interface Step3Props {
  phase: string;
  error: string;
  onRetry: () => void;
}

function Step3Generating({ phase, error, onRetry }: Step3Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      {!error ? (
        <>
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-text-primary font-medium">{phase || "Starting…"}</p>
          <p className="text-xs text-text-muted">This takes 10–30 seconds.</p>
        </>
      ) : (
        <>
          <AlertTriangle className="w-10 h-10 text-error" />
          <p className="text-sm text-error font-medium">Generation failed</p>
          <p className="text-xs text-text-muted">{error}</p>
          <button
            onClick={onRetry}
            className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
}
```

Add the `useEffect` + generation function inside the `BrandVoiceWizard` function body, before the `return` statement. Insert after the `canAnalyse` line:

```tsx
  // ── Step 3: trigger generation when step changes to "generate" ──────────

  const { generateVoiceConfigForBrand } = require("@/lib/api");

  async function runGeneration() {
    setGenerating(true);
    setGenerateError("");
    try {
      setGeneratePhase("Combining source content…");
      const combinedText = editedSources
        .filter((s) => s.text.trim())
        .map((s) => `[Source: ${s.source_label}]\n${s.text}`)
        .join("\n\n---\n\n");

      setGeneratePhase("Sending to Claude for brand voice analysis…");
      const res = await generateVoiceConfigForBrand({
        brand_name: brandName,
        industry: brandIndustry,
        interview_answers: [],
        sample_posts: [combinedText],
      });

      setGeneratePhase("Processing results…");
      const config: VoiceConfigResult = res.data;
      setVoiceConfig(config);
      setEditTone(config.tone_descriptors);
      setEditAvoid(config.avoid);
      setEditWordBank(config.word_bank);
      setEditSamplePrompts(config.sample_prompts);
      setEditPlatformRules({ ...config.platform_rules });
      setEditPillars(config.content_pillars.map((p) => ({ ...p })));
      setGeneratePhase("Done!");
      setStep("config");
    } catch {
      setGenerateError("Generation failed. Please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Use useEffect from React — import it at the top of the file
```

**Important:** Update the import at the top of the file to include `useEffect`:

```tsx
import { useRef, useState, useEffect } from "react";
```

And add this `useEffect` inside the component body:

```tsx
  useEffect(() => {
    if (step === "generate" && !voiceConfig && !generating && !generateError) {
      runGeneration();
    }
  }, [step]);
```

Also replace `const { generateVoiceConfigForBrand } = require("@/lib/api");` with a proper import at the top:

```tsx
import { analyseSourcesForBrand, generateVoiceConfigForBrand, AnalyseSourcesResponse, SourceResult, VoiceConfigResult } from "@/lib/api";
```

In the wizard body, replace `{/* Steps 3–4 added in Tasks 6–7 */}` with:

```tsx
          {step === "generate" && (
            <Step3Generating
              phase={generatePhase}
              error={generateError}
              onRetry={runGeneration}
            />
          )}
          {/* Step 4 added in Task 7 */}
```

In the footer, after the review step button, add:

```tsx
            {step === "generate" && generateError && (
              <button
                onClick={runGeneration}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Retry Generation
              </button>
            )}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/domain/BrandVoiceWizard.tsx
git commit -m "feat: BrandVoiceWizard Step 3 — generation with phase progress and retry"
```

---

## Task 7: BrandVoiceWizard — Step 4 (Config Review & Save)

**Files:**
- Modify: `frontend/components/domain/BrandVoiceWizard.tsx`

Step 4 renders all 6 voice config fields as editable. Save reads server state first, merges wizard keys, then writes back.

- [ ] **Step 1: Add getBrand and updateBrand imports**

At the top of `BrandVoiceWizard.tsx`, update the api import:

```tsx
import { analyseSourcesForBrand, generateVoiceConfigForBrand, getBrand, updateBrand, AnalyseSourcesResponse, SourceResult, VoiceConfigResult } from "@/lib/api";
```

- [ ] **Step 2: Add save handler inside the wizard component**

Inside `BrandVoiceWizard`, add after the `generateError` state line:

```tsx
  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      // Server-read merge: read current voice_config first so we don't lose existing keys
      const brandRes = await getBrand(brandId);
      const existingVc = (brandRes.data.voice_config as Record<string, unknown>) || {};

      const mergedVoiceConfig = {
        ...existingVc,
        tone_descriptors: editTone,
        content_pillars: editPillars,
        platform_rules: editPlatformRules,
        word_bank: editWordBank,
        avoid: editAvoid,
        sample_prompts: editSamplePrompts,
      };

      await updateBrand(brandId, { voice_config: mergedVoiceConfig });
      onSaved();
      onClose();
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }
```

- [ ] **Step 3: Add Step4Config component**

At the bottom of `BrandVoiceWizard.tsx`, add:

```tsx
// ── Step 4: Config Review ─────────────────────────────────────────────────

interface Step4Props {
  editTone: string[];
  setEditTone: (v: string[]) => void;
  editAvoid: string[];
  setEditAvoid: (v: string[]) => void;
  editWordBank: string[];
  setEditWordBank: (v: string[]) => void;
  editSamplePrompts: string[];
  setEditSamplePrompts: (v: string[]) => void;
  editPlatformRules: Record<string, string>;
  setEditPlatformRules: (v: Record<string, string>) => void;
  editPillars: Array<{ name: string; description: string }>;
  setEditPillars: (v: Array<{ name: string; description: string }>) => void;
}

function EditableTagList({
  label, items, onChange,
}: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const t = input.trim();
    if (!t || items.includes(t)) return;
    onChange([...items, t]);
    setInput("");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-elevated border border-border text-text-secondary">
            {item}
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-error transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={`Add ${label.toLowerCase()}…`}
          className="flex-1 rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-1.5 focus:outline-none focus:border-border-active placeholder:text-text-muted"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-secondary hover:bg-border disabled:opacity-40 text-xs transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function Step4Config({
  editTone, setEditTone,
  editAvoid, setEditAvoid,
  editWordBank, setEditWordBank,
  editSamplePrompts, setEditSamplePrompts,
  editPlatformRules, setEditPlatformRules,
  editPillars, setEditPillars,
}: Step4Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Review & edit your voice config</h3>
        <p className="text-xs text-text-muted">All fields are editable before saving.</p>
      </div>

      <EditableTagList label="Tone Descriptors" items={editTone} onChange={setEditTone} />
      <EditableTagList label="Avoid" items={editAvoid} onChange={setEditAvoid} />
      <EditableTagList label="Word Bank" items={editWordBank} onChange={setEditWordBank} />

      {/* Sample Prompts */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Sample Prompts</p>
        {editSamplePrompts.map((prompt, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={prompt}
              onChange={(e) => {
                const next = [...editSamplePrompts];
                next[i] = e.target.value;
                setEditSamplePrompts(next);
              }}
              className="flex-1 rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-1.5 focus:outline-none focus:border-border-active"
            />
            <button onClick={() => setEditSamplePrompts(editSamplePrompts.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-error transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Platform Rules */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Platform Rules</p>
        {PLATFORM_ORDER.map((platform) => (
          <div key={platform} className="space-y-1">
            <label className="text-xs text-text-secondary capitalize">{platform}</label>
            <textarea
              value={editPlatformRules[platform] ?? ""}
              onChange={(e) => setEditPlatformRules({ ...editPlatformRules, [platform]: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-2 focus:outline-none focus:border-border-active resize-none"
            />
          </div>
        ))}
      </div>

      {/* Content Pillars */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Content Pillars</p>
        {editPillars.map((pillar, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <input
                value={pillar.name}
                onChange={(e) => {
                  const next = [...editPillars];
                  next[i] = { ...next[i], name: e.target.value };
                  setEditPillars(next);
                }}
                placeholder="Pillar name"
                className="w-full rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-1.5 focus:outline-none focus:border-border-active"
              />
              <input
                value={pillar.description}
                onChange={(e) => {
                  const next = [...editPillars];
                  next[i] = { ...next[i], description: e.target.value };
                  setEditPillars(next);
                }}
                placeholder="Description"
                className="w-full rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-1.5 focus:outline-none focus:border-border-active"
              />
            </div>
            <button onClick={() => setEditPillars(editPillars.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-error transition-colors mt-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => setEditPillars([...editPillars, { name: "", description: "" }])}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add pillar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire Step4Config into the wizard body**

Replace `{/* Step 4 added in Task 7 */}` with:

```tsx
          {step === "config" && voiceConfig && (
            <Step4Config
              editTone={editTone}
              setEditTone={setEditTone}
              editAvoid={editAvoid}
              setEditAvoid={setEditAvoid}
              editWordBank={editWordBank}
              setEditWordBank={setEditWordBank}
              editSamplePrompts={editSamplePrompts}
              setEditSamplePrompts={setEditSamplePrompts}
              editPlatformRules={editPlatformRules}
              setEditPlatformRules={setEditPlatformRules}
              editPillars={editPillars}
              setEditPillars={setEditPillars}
            />
          )}
```

In the footer, after the generate retry button block, add:

```tsx
            {step === "config" && (
              <>
                {saveError && <span className="text-xs text-error mr-auto">{saveError}</span>}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? "Saving…" : "Save Voice Config"}
                </button>
              </>
            )}
```

Also update the footer error div so `saveError` shows for step "config":

```tsx
          <div className="text-xs text-error">{step === "source" ? analyseError : ""}</div>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 6: Commit**

```bash
git add frontend/components/domain/BrandVoiceWizard.tsx
git commit -m "feat: BrandVoiceWizard Step 4 — config review, all 6 fields editable, server-merge save"
```

---

## Task 8: Wire Wizard into Brand Settings Page

**Files:**
- Modify: `frontend/app/dashboard/brands/[id]/page.tsx`

Remove the old "Import Brand Voice from URLs" card and the `ingestUrls`, `ingesting`, `ingestPreview`, `savingVoice`, `newIngestUrl` state variables. Add a wizard trigger button and import `BrandVoiceWizard`.

- [ ] **Step 1: Update imports and state**

At the top of `page.tsx`, add the wizard import:

```tsx
import BrandVoiceWizard from "@/components/domain/BrandVoiceWizard";
```

Remove these state variables (they're no longer needed):
- `ingestUrls`, `newIngestUrl`, `ingesting`, `ingestPreview`, `savingVoice`

Remove `ingestBrandUrls` from the `@/lib/api` import line.

Add instead:
```tsx
const [showVoiceWizard, setShowVoiceWizard] = useState(false);
```

Remove `addIngestUrl`, `removeIngestUrl`, `handleAnalyseUrls`, `handleSaveVoiceConfig` functions entirely.

- [ ] **Step 2: Replace old URL import card with wizard trigger**

Find the card:
```tsx
        {/* Import Brand Voice from URLs */}
        <Card>
          ...
        </Card>
```

Replace the entire card with:

```tsx
        {/* Brand Voice Wizard */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Brand Voice Config</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {brand.voice_config && Object.keys(brand.voice_config).length > 0 ? (
                <>
                  {Array.isArray((brand.voice_config as Record<string, unknown>).tone_descriptors) && (
                    <div>
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
                  <p className="text-xs text-text-muted mt-2">
                    Voice config is active and used in content generation.
                  </p>
                </>
              ) : (
                <p className="text-xs text-text-muted">No voice config yet. Use the wizard to generate one.</p>
              )}
              <button
                onClick={() => setShowVoiceWizard(true)}
                className="w-full mt-2 px-4 py-2.5 rounded-lg border border-primary/40 bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
              >
                {brand.voice_config && Object.keys(brand.voice_config).length > 0
                  ? "Re-run Voice Wizard"
                  : "Run Voice Wizard"}
              </button>
            </CardContent>
          </Card>
        )}
```

Also remove the separate "Brand Voice Config" read-only card below (the one that starts with `{brand.voice_config && Object.keys(brand.voice_config).length > 0 && (`).

- [ ] **Step 3: Add wizard modal and onSaved callback**

At the bottom of the JSX return, just before the final closing `</div>`, add:

```tsx
      {showVoiceWizard && (
        <BrandVoiceWizard
          brandId={id}
          brandName={brand.name}
          brandIndustry={brand.industry || ""}
          onClose={() => setShowVoiceWizard(false)}
          onSaved={async () => {
            const res = await getBrand(id);
            setBrand(res.data);
            toast.success("Voice config saved");
          }}
        />
      )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/dashboard/brands/[id]/page.tsx
git commit -m "feat: wire BrandVoiceWizard into brand settings, remove old URL import card"
```

---

## Task 9: End-to-End Smoke Test

- [ ] **Step 1: Start backend**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\backend
.venv\Scripts\uvicorn.exe app.main:app --reload --port 8000
```

- [ ] **Step 2: Start frontend**

```bash
cd c:\Users\Kevin Chng\Documents\BuildLab33\frontend
npm run dev
```

- [ ] **Step 3: Run through the full wizard**

1. Navigate to `http://localhost:3000/dashboard/brands/{any-brand-id}`
2. Click **Run Voice Wizard**
3. **Step 1**: Add `https://example.com` as a URL. Toggle "Add posts" and paste: `We help brands grow through authentic storytelling and data-driven strategy.`
4. Click **Analyse Sources**
5. **Step 2**: Verify two source cards appear. The URL should have content; the pasted text should show as-entered. Optionally edit one.
6. Click **Generate Voice Config**
7. **Step 3**: Verify the spinning loader appears with phase text, then auto-advances to Step 4
8. **Step 4**: Verify all 6 sections (tone, avoid, word bank, sample prompts, platform rules, content pillars) are populated and editable
9. Edit one tone descriptor — remove one tag, add a new one
10. Click **Save Voice Config**
11. Verify the wizard closes, the brand settings page reloads the voice config preview, and it shows the edited tone descriptors
12. Check the `audit_log` table in Supabase — confirm a `brand_voice_analyse` entry was created

- [ ] **Step 4: Test warning path**

1. Open the wizard again
2. Add a URL that returns little content (e.g., `https://twitter.com/yourhandle` — blocked)
3. Click **Analyse Sources**
4. Verify Step 2 shows the warning banner and the JS-rendered badge on the blocked source
5. Replace the empty textarea with manually pasted content
6. Continue to generation — verify it succeeds

- [ ] **Step 5: Test paste-only path**

1. Open the wizard again
2. Add no URLs. Toggle "Add posts". Paste a few sentences.
3. Click **Analyse Sources** — verify it proceeds to Step 2 with only the pasted source
4. Continue through to save

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Brand Voice Intake Wizard — end-to-end smoke test complete"
```

---

## Loophole Coverage Map

All 20 loopholes from the review are addressed:

| # | Loophole | Fix |
|---|----------|-----|
| 1 | voice_config save overwrites existing keys | Task 7 `handleSave` — server-read merge before update |
| 2 | No per-source feedback | Task 1 `SourceResult.warning` + Task 5 `WarningBadge` |
| 3 | JS-rendered sites return empty | Task 1 `js_rendered` warning flag; Task 5 editable fallback |
| 4 | Social media URLs silently empty | Same as #3; optional paste in Step 1 |
| 5 | No audit log for wizard | Task 2 `analyse-sources` writes `brand_voice_analyse` audit entry |
| 6 | Paste input uncapped | Task 1 `cap_pasted_texts` validator (5000 chars) + frontend `slice(0, MAX_PASTE_CHARS)` |
| 7 | Pasted text not supported at all | Task 1 `pasted_texts` field + Task 4 Step 1 paste boxes |
| 8 | All sources must succeed or whole call fails | Task 1 per-source results with `warning="empty"` for failed URLs |
| 9 | User can't see what was captured | Task 5 Step 2 — full editable content per source |
| 10 | No way to fix bad captures | Task 5 Step 2 — editableTextareas per source |
| 11 | Generation triggers before user approves content | Step 2 → Step 3 is user-gated (click "Generate Voice Config") |
| 12 | No progress indicator during generation | Task 6 Step 3 — phase text + spinner |
| 13 | Generation failure loses everything | Task 6 — retry button, state preserved |
| 14 | Only tone and avoid shown in preview | Task 7 Step 4 — all 6 fields rendered |
| 15 | Config fields not editable before save | Task 7 Step 4 — all fields editable |
| 16 | platform_rules not shown | Task 7 `editPlatformRules` — all 6 platforms shown |
| 17 | content_pillars from wizard not visible | Task 7 `editPillars` — editable pillar list |
| 18 | SSRF — no URL validation on frontend | Task 4 Step 1 — `new URL(trimmed)` guard before adding |
| 19 | No char counter on paste boxes | Task 4 — char counter below each paste textarea |
| 20 | recent_posts toggle always visible | Task 4 — "Add posts" toggle, hidden by default |
