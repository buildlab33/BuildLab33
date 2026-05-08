"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getInterviewQuestions,
  generateVoiceConfig,
  createBrand,
  type InterviewAnswer,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "@/components/ui/toast";
import { ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";

type Step = "basic" | "interview" | "samples" | "preview";
interface Question { index: number; question: string; }

const TIMEZONES = [
  { value: "UTC", label: "(UTC+00:00) UTC" },
  { value: "Europe/London", label: "(UTC+00:00) London" },
  { value: "Europe/Paris", label: "(UTC+01:00) Paris, Berlin, Rome" },
  { value: "Asia/Dubai", label: "(UTC+04:00) Dubai, Abu Dhabi" },
  { value: "Asia/Kolkata", label: "(UTC+05:30) Mumbai, New Delhi" },
  { value: "Asia/Bangkok", label: "(UTC+07:00) Bangkok, Jakarta, Hanoi" },
  { value: "Asia/Singapore", label: "(UTC+08:00) Kuala Lumpur, Singapore" },
  { value: "Asia/Kuala_Lumpur", label: "(UTC+08:00) Kuala Lumpur" },
  { value: "Asia/Hong_Kong", label: "(UTC+08:00) Hong Kong, Beijing" },
  { value: "Asia/Seoul", label: "(UTC+09:00) Seoul" },
  { value: "Asia/Tokyo", label: "(UTC+09:00) Osaka, Sapporo, Tokyo" },
  { value: "Australia/Sydney", label: "(UTC+10:00) Sydney, Melbourne" },
  { value: "Pacific/Auckland", label: "(UTC+12:00) Auckland, Wellington" },
  { value: "America/Los_Angeles", label: "(UTC-08:00) Los Angeles, Seattle" },
  { value: "America/New_York", label: "(UTC-05:00) New York, Washington DC" },
];

export default function NewBrandPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("basic");

  // Basic info
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandColour, setBrandColour] = useState("#6366f1");
  const [timezone, setTimezone] = useState("Asia/Singapore");

  // Interview
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Sample posts
  const [samplePosts, setSamplePosts] = useState<string[]>(["", "", ""]);

  // AI config generation
  const [generatingConfig, setGeneratingConfig] = useState(false);
  const [voiceConfig, setVoiceConfig] = useState<Record<string, unknown> | null>(null);

  // Saving
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (step === "interview" && questions.length === 0) {
      setLoadingQuestions(true);
      getInterviewQuestions()
        .then((res) => setQuestions(res.data.questions || []))
        .catch(() => toast.error("Failed to load interview questions"))
        .finally(() => setLoadingQuestions(false));
    }
  }, [step]);

  const canProceedBasic = name.trim().length >= 1 && industry.trim().length >= 1;
  const answeredCount = questions.filter((q) => (answers[q.index] || "").trim().length > 0).length;
  const canProceedInterview = answeredCount >= Math.min(10, questions.length);

  const handleGenerateConfig = async () => {
    setGeneratingConfig(true);
    const interviewAnswers: InterviewAnswer[] = questions
      .filter((q) => (answers[q.index] || "").trim())
      .map((q) => ({ question_index: q.index, question: q.question, answer: answers[q.index] }));
    const validSamples = samplePosts.filter((p) => p.trim().length > 0);
    try {
      const res = await generateVoiceConfig({
        brand_name: name,
        industry,
        interview_answers: interviewAnswers,
        sample_posts: validSamples,
      });
      setVoiceConfig(res.data);
      setStep("preview");
    } catch {
      toast.error("Failed to generate voice config — check your answers and try again");
    } finally {
      setGeneratingConfig(false);
    }
  };

  const handleSave = async () => {
    if (!voiceConfig) return;
    setSaving(true);
    try {
      const pillars = (voiceConfig.content_pillars as Array<{ name: string; description: string }>) || [];
      await createBrand({
        name,
        industry,
        brand_colour: brandColour,
        default_timezone: timezone,
        content_pillars: pillars,
        hashtag_sets: [],
        voice_config: voiceConfig,
      });
      toast.success(`${name} created successfully`);
      router.push("/dashboard/brands");
    } catch {
      toast.error("Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  // ── Step: Basic Info ───────────────────────────────────────────────────────
  if (step === "basic") {
    return (
      <div>
        <PageHeader title="New Brand" subtitle="Step 1 of 4 — Basic information" />
        <Card className="max-w-lg">
          <CardContent className="p-6 space-y-4">
            <div>
              <Label htmlFor="name">Brand name *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Yeon Studios" required />
            </div>
            <div>
              <Label htmlFor="industry">Industry *</Label>
              <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Digital Marketing, SaaS, Consulting" required />
            </div>
            <div>
              <Label htmlFor="colour">Brand colour</Label>
              <div className="flex gap-3">
                <div
                  className="w-10 self-stretch rounded-md flex-shrink-0 cursor-pointer"
                  style={{ backgroundColor: brandColour }}
                  onClick={() => document.getElementById("colour-picker")?.click()}
                />
                <input
                  type="color"
                  id="colour-picker"
                  value={brandColour}
                  onChange={(e) => setBrandColour(e.target.value)}
                  className="sr-only"
                />
                <Input value={brandColour} onChange={(e) => setBrandColour(e.target.value)} placeholder="#6366f1" className="font-mono w-32" />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Default timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-md border border-border bg-surface text-text-primary text-sm px-3 py-2 pr-8 focus:outline-none focus:border-border-active appearance-none"
                style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
              >
                {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>
            <Button className="w-full" disabled={!canProceedBasic} onClick={() => setStep("interview")}>
              Next: Brand Voice Interview <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Step: Interview ────────────────────────────────────────────────────────
  if (step === "interview") {
    const q = questions[currentQ];
    return (
      <div>
        <PageHeader
          title="Brand Voice Interview"
          subtitle={`Step 2 of 4 — Question ${currentQ + 1} of ${questions.length} (answer at least 10)`}
        />
        {loadingQuestions ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading questions...
          </div>
        ) : q ? (
          <div className="max-w-lg space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-text-muted font-mono">{currentQ + 1} / {questions.length}</span>
                  <span className="text-xs text-text-muted">{answeredCount} answered</span>
                </div>
                <p className="text-sm text-text-primary font-medium mb-4">{q.question}</p>
                <Textarea
                  value={answers[q.index] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.index]: e.target.value })}
                  placeholder="Type your answer here..."
                  rows={4}
                />
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={currentQ === 0} onClick={() => setCurrentQ(currentQ - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {currentQ < questions.length - 1 ? (
                <Button className="flex-1" onClick={() => setCurrentQ(currentQ + 1)}>
                  Next question <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button className="flex-1" disabled={!canProceedInterview} onClick={() => setStep("samples")}>
                  Next: Sample Posts <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <button onClick={() => setStep("basic")} className="hover:text-text-secondary transition-colors">← Back to basic info</button>
              <button
                onClick={() => setStep("samples")}
                disabled={!canProceedInterview}
                className="hover:text-text-secondary transition-colors disabled:opacity-40"
              >
                Skip to sample posts →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ── Step: Sample Posts ─────────────────────────────────────────────────────
  if (step === "samples") {
    return (
      <div>
        <PageHeader title="Sample Posts" subtitle="Step 3 of 4 — Paste 3–10 existing posts to improve voice accuracy (optional)" />
        <div className="max-w-lg space-y-4">
          {samplePosts.map((post, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Label className="mb-2 block">Sample post {i + 1}</Label>
                <Textarea
                  value={post}
                  onChange={(e) => {
                    const next = [...samplePosts];
                    next[i] = e.target.value;
                    setSamplePosts(next);
                  }}
                  placeholder="Paste an existing social media post here..."
                  rows={4}
                />
              </CardContent>
            </Card>
          ))}
          {samplePosts.length < 10 && (
            <button
              onClick={() => setSamplePosts([...samplePosts, ""])}
              className="text-xs text-text-muted hover:text-text-active transition-colors"
            >
              + Add another sample
            </button>
          )}
          <Button className="w-full" disabled={generatingConfig} onClick={handleGenerateConfig}>
            {generatingConfig ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating voice config...</>
            ) : (
              <>Generate Brand Voice Config <ChevronRight className="w-4 h-4 ml-1" /></>
            )}
          </Button>
          <button onClick={() => setStep("interview")} className="text-xs text-text-muted hover:text-text-secondary transition-colors block">
            ← Back to interview
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Preview ──────────────────────────────────────────────────────────
  if (step === "preview" && voiceConfig) {
    const toneDescriptors = (voiceConfig.tone_descriptors as string[]) || [];
    const pillars = (voiceConfig.content_pillars as Array<{ name: string; description: string }>) || [];
    const wordBank = (voiceConfig.word_bank as string[]) || [];
    const avoid = (voiceConfig.avoid as string[]) || [];

    return (
      <div>
        <PageHeader title="Voice Config Preview" subtitle="Step 4 of 4 — Review the generated brand voice config" />
        <div className="max-w-lg space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2">Tone</p>
                <div className="flex flex-wrap gap-2">
                  {toneDescriptors.map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-elevated border border-border text-text-secondary">{t}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2">Content Pillars</p>
                <ul className="space-y-1">
                  {pillars.map((p) => (
                    <li key={p.name} className="text-xs text-text-secondary">
                      <span className="font-medium text-text-primary">{p.name}</span> — {p.description}
                    </li>
                  ))}
                </ul>
              </div>
              {wordBank.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2">Word Bank</p>
                  <p className="text-xs text-text-secondary">{wordBank.join(", ")}</p>
                </div>
              )}
              {avoid.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wide mb-2">Avoid</p>
                  <p className="text-xs text-error">{avoid.join(", ")}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep("samples")} className="flex-1">
              <ChevronLeft className="w-4 h-4 mr-1" /> Regenerate
            </Button>
            <Button className="flex-1" disabled={saving} onClick={handleSave}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-1" /> Save Brand</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
