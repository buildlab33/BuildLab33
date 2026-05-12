"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import {
  analyseSourcesForBrand,
  generateVoiceConfigForBrand,
  getBrand,
  updateBrand,
  type AnalyseSourcesResponse,
  type SourceResult,
  type VoiceConfigResult,
} from "@/lib/api";
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

  const [step, setStep] = useState<WizardStep>("source");

  // Step 1 state
  const [urlInput, setUrlInput] = useState("");
  const [urls, setUrls] = useState<string[]>([]);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedTexts, setPastedTexts] = useState<string[]>([""]);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");

  // Step 2 state
  const [analysisResult, setAnalysisResult] = useState<AnalyseSourcesResponse | null>(null);
  const [editedSources, setEditedSources] = useState<SourceResult[]>([]);

  // Step 3 state
  const [generating, setGenerating] = useState(false);
  const [generatePhase, setGeneratePhase] = useState("");
  const [generateError, setGenerateError] = useState("");

  // Step 4 state
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
      const res = await analyseSourcesForBrand(brandId, urls, showPaste ? validPasted : []);
      setAnalysisResult(res.data);
      setEditedSources(res.data.sources.map((s) => ({ ...s })));
      setStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : undefined;
      setAnalyseError(msg ?? "Could not reach some sources. Check URLs and try again.");
    } finally {
      setAnalysing(false);
    }
  }

  const canAnalyse = urls.length > 0 || (showPaste && pastedTexts.some((t) => t.trim().length > 0));

  // ── Step 3: generation ────────────────────────────────────────────────

  const runGeneration = useCallback(async () => {
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
      setStep("config");
    } catch {
      setGenerateError("Generation failed. Please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }, [editedSources, brandName, brandIndustry]);

  useEffect(() => {
    if (step === "generate" && !voiceConfig && !generating && !generateError) {
      runGeneration();
    }
  }, [step, voiceConfig, generating, generateError, runGeneration]);

  // ── Step 4: save ──────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : undefined;
      setSaveError(msg ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // ── Step indicators ───────────────────────────────────────────────────

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
          <div className="flex items-center gap-1 flex-1 justify-center">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex items-center gap-1">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  i === stepIndex ? "bg-primary text-white"
                  : i < stepIndex ? "bg-primary/20 text-primary"
                  : "bg-elevated text-text-muted"
                }`}>
                  <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                    {i < stepIndex ? "✓" : i + 1}
                  </span>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />}
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
          {step === "review" && analysisResult && (
            <Step2Review
              editedSources={editedSources}
              setEditedSources={setEditedSources}
              hasWarnings={analysisResult.has_warnings}
            />
          )}
          {step === "generate" && (
            <Step3Generating phase={generatePhase} error={generateError} onRetry={runGeneration} />
          )}
          {step === "config" && voiceConfig && (
            <Step4Config
              editTone={editTone} setEditTone={setEditTone}
              editAvoid={editAvoid} setEditAvoid={setEditAvoid}
              editWordBank={editWordBank} setEditWordBank={setEditWordBank}
              editSamplePrompts={editSamplePrompts} setEditSamplePrompts={setEditSamplePrompts}
              editPlatformRules={editPlatformRules} setEditPlatformRules={setEditPlatformRules}
              editPillars={editPillars} setEditPillars={setEditPillars}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-elevated flex-shrink-0 flex items-center justify-between gap-2">
          <div className="text-xs text-error flex-1">
            {step === "source" && analyseError}
            {step === "config" && saveError}
          </div>
          <div className="flex gap-2">
            {step !== "source" && step !== "generate" && (
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
            {step === "review" && (
              <button
                onClick={() => {
                  setVoiceConfig(null);
                  setStep("generate");
                }}
                disabled={editedSources.every((s) => !s.text.trim())}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Generate Voice Config <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === "generate" && (
              <button
                onClick={() => {
                  setGenerating(false);
                  setGenerateError("");
                  setStep("review");
                }}
                disabled={!generateError && generating}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-surface text-text-secondary hover:bg-elevated text-sm font-medium transition-colors disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Cancel
              </button>
            )}
            {step === "generate" && generateError && (
              <button
                onClick={runGeneration}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Retry Generation
              </button>
            )}
            {step === "config" && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Saving…" : "Save Voice Config"}
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
              <div key={url} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elevated border border-border">
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

      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Recent Posts / Captions</h3>
            <p className="text-xs text-text-muted mt-0.5">Optional — paste real posts to show the AI your brand&apos;s voice directly.</p>
          </div>
          <button
            onClick={() => setShowPaste(!showPaste)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showPaste ? "bg-primary/10 border-primary/30 text-primary" : "bg-elevated border-border text-text-muted hover:border-primary/30"
            }`}
          >
            {showPaste ? "Hide" : "Add posts"}
          </button>
        </div>
        {showPaste && (
          <div className="space-y-3 mt-3">
            {pastedTexts.map((text, i) => (
              <div key={i}>
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
              <button onClick={addPasteBox} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add another post
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Content Review ────────────────────────────────────────────────

interface Step2Props {
  editedSources: SourceResult[];
  setEditedSources: (sources: SourceResult[]) => void;
  hasWarnings: boolean;
}

function Step2Review({ editedSources, setEditedSources, hasWarnings }: Step2Props) {
  function updateText(i: number, text: string) {
    const next = [...editedSources];
    next[i] = { ...next[i], text, char_count: text.length };
    setEditedSources(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Review captured content</h3>
        <p className="text-xs text-text-muted">This is what the AI will read. Edit or replace any source that looks empty or wrong.</p>
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
        <div key={source.source_label} className="rounded-lg border border-border bg-elevated p-4 space-y-2">
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
          <button onClick={onRetry} className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors">
            Retry
          </button>
        </>
      )}
    </div>
  );
}

// ── Step 4: Config Review ─────────────────────────────────────────────────

interface Step4Props {
  editTone: string[]; setEditTone: (v: string[]) => void;
  editAvoid: string[]; setEditAvoid: (v: string[]) => void;
  editWordBank: string[]; setEditWordBank: (v: string[]) => void;
  editSamplePrompts: string[]; setEditSamplePrompts: (v: string[]) => void;
  editPlatformRules: Record<string, string>; setEditPlatformRules: (v: Record<string, string>) => void;
  editPillars: Array<{ name: string; description: string }>; setEditPillars: (v: Array<{ name: string; description: string }>) => void;
}

function EditableTagList({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
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
          <span key={item} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-elevated border border-border text-text-secondary">
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
        <button onClick={add} disabled={!input.trim()} className="px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-secondary hover:bg-border disabled:opacity-40 text-xs transition-colors">
          Add
        </button>
      </div>
    </div>
  );
}

function Step4Config({
  editTone, setEditTone, editAvoid, setEditAvoid, editWordBank, setEditWordBank,
  editSamplePrompts, setEditSamplePrompts, editPlatformRules, setEditPlatformRules,
  editPillars, setEditPillars,
}: Step4Props) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Review &amp; edit your voice config</h3>
        <p className="text-xs text-text-muted">All fields are editable before saving.</p>
      </div>

      <EditableTagList label="Tone Descriptors" items={editTone} onChange={setEditTone} />
      <EditableTagList label="Avoid" items={editAvoid} onChange={setEditAvoid} />
      <EditableTagList label="Word Bank" items={editWordBank} onChange={setEditWordBank} />

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

      <div className="space-y-2">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Content Pillars</p>
        {editPillars.map((pillar, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1 space-y-1">
              <input
                value={pillar.name}
                onChange={(e) => { const next = [...editPillars]; next[i] = { ...next[i], name: e.target.value }; setEditPillars(next); }}
                placeholder="Pillar name"
                className="w-full rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-1.5 focus:outline-none focus:border-border-active"
              />
              <input
                value={pillar.description}
                onChange={(e) => { const next = [...editPillars]; next[i] = { ...next[i], description: e.target.value }; setEditPillars(next); }}
                placeholder="Description"
                className="w-full rounded-lg border border-border bg-elevated text-text-primary text-xs px-3 py-1.5 focus:outline-none focus:border-border-active"
              />
            </div>
            <button onClick={() => setEditPillars(editPillars.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-error transition-colors mt-1.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button onClick={() => setEditPillars([...editPillars, { name: "", description: "" }])} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add pillar
        </button>
      </div>
    </div>
  );
}
