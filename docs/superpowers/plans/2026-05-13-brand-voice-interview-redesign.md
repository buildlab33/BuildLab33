# Brand Voice Interview Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 22-question open-text brand voice interview with a friendly 3-stage progressive interview (4 chip-assisted questions in Stage 1, 4 optional deeper questions in Stage 2, unchanged sample posts in Stage 3).

**Architecture:** The backend replaces the flat `INTERVIEW_QUESTIONS` string list with a structured list of question objects carrying `stage`, `input_type`, `chips`, and `max_select` fields. The `generate_voice_config` prompt is updated to handle chip-selection answers differently from open-text answers. The frontend `BrandVoiceWizard.tsx` gains a new `"interview"` step inserted before the existing `"source"` step — it renders chip-select and text inputs per question, then passes the structured answers into the existing `generateVoiceConfigForBrand` API call.

**Tech Stack:** FastAPI + Pydantic v2 (backend), Next.js 16 + TypeScript + Tailwind CSS v4 (frontend), existing Anthropic Claude integration unchanged.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/app/routers/brands.py` | Modify | Replace `INTERVIEW_QUESTIONS` with structured `INTERVIEW_QUESTIONS` list; update `/interview-questions` endpoint to return full objects |
| `backend/app/schemas/brands.py` | Modify | Add `InterviewQuestion` schema; update `GenerateVoiceConfigRequest` to accept `stage` field on answers |
| `backend/app/services/anthropic_service.py` | Modify | Update `generate_voice_config` prompt to render chip answers vs text answers differently |
| `backend/tests/test_interview.py` | Create | Tests for interview question structure and voice config prompt building |
| `frontend/components/domain/BrandVoiceWizard.tsx` | Modify | Add `"interview"` wizard step with Stage 1 / Stage 2 chip+text question UI |
| `frontend/lib/api.ts` | Modify | Update `InterviewAnswer` type to include `stage` field |

---

## Task 1: Update backend schemas

**Files:**
- Modify: `backend/app/schemas/brands.py`

- [ ] **Step 1: Write failing test**

Create `backend/tests/test_interview.py`:

```python
import pytest
from app.schemas.brands import InterviewAnswer, GenerateVoiceConfigRequest


def test_interview_answer_has_stage():
    a = InterviewAnswer(question_index=0, question="Q", answer="A", stage=1)
    assert a.stage == 1


def test_interview_answer_stage_defaults_to_1():
    a = InterviewAnswer(question_index=0, question="Q", answer="A")
    assert a.stage == 1


def test_generate_voice_config_request_accepts_stage_on_answers():
    req = GenerateVoiceConfigRequest(
        brand_name="Acme",
        industry="Tech",
        interview_answers=[
            InterviewAnswer(question_index=0, question="Q1", answer="We help founders", stage=1),
            InterviewAnswer(question_index=2, question="Q3", answer="Bold, Direct", stage=1),
        ],
        sample_posts=[],
    )
    assert req.interview_answers[0].stage == 1
    assert req.interview_answers[1].stage == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_interview.py -v
```

Expected: FAIL — `InterviewAnswer` has no `stage` field.

- [ ] **Step 3: Add `stage` field to `InterviewAnswer` in `backend/app/schemas/brands.py`**

Replace the existing `InterviewAnswer` class (line 61–64):

```python
class InterviewAnswer(BaseModel):
    question_index: int
    question: str
    answer: str
    stage: int = 1  # 1 = Core, 2 = Depth
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pytest tests/test_interview.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas/brands.py backend/tests/test_interview.py
git commit -m "feat: add stage field to InterviewAnswer schema"
```

---

## Task 2: Replace INTERVIEW_QUESTIONS with structured objects

**Files:**
- Modify: `backend/app/routers/brands.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_interview.py`:

```python
from app.routers.brands import INTERVIEW_QUESTIONS


def test_interview_questions_is_list_of_dicts():
    assert isinstance(INTERVIEW_QUESTIONS, list)
    assert len(INTERVIEW_QUESTIONS) > 0
    assert isinstance(INTERVIEW_QUESTIONS[0], dict)


def test_each_question_has_required_keys():
    required = {"index", "stage", "question", "input_type"}
    for q in INTERVIEW_QUESTIONS:
        assert required.issubset(q.keys()), f"Missing keys in: {q}"


def test_stage_1_has_exactly_4_questions():
    stage1 = [q for q in INTERVIEW_QUESTIONS if q["stage"] == 1]
    assert len(stage1) == 4


def test_stage_2_has_exactly_4_questions():
    stage2 = [q for q in INTERVIEW_QUESTIONS if q["stage"] == 2]
    assert len(stage2) == 4


def test_chip_questions_have_chips_list():
    chip_questions = [q for q in INTERVIEW_QUESTIONS if q["input_type"] in ("single_chip", "multi_chip")]
    for q in chip_questions:
        assert "chips" in q, f"Chip question missing chips: {q['question']}"
        assert len(q["chips"]) > 0


def test_multi_chip_questions_have_max_select():
    multi = [q for q in INTERVIEW_QUESTIONS if q["input_type"] == "multi_chip"]
    for q in multi:
        assert "max_select" in q, f"Multi-chip question missing max_select: {q['question']}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_interview.py -v
```

Expected: FAIL — `INTERVIEW_QUESTIONS` is a list of strings, not dicts.

- [ ] **Step 3: Replace `INTERVIEW_QUESTIONS` in `backend/app/routers/brands.py`**

Replace the entire `INTERVIEW_QUESTIONS` list (lines 35–58) with:

```python
INTERVIEW_QUESTIONS = [
    # ── Stage 1: Core (required, ~60 seconds) ─────────────────────────────
    {
        "index": 0,
        "stage": 1,
        "question": "What does your brand do, and who is it for?",
        "input_type": "text",
        "placeholder": "e.g. We help SaaS founders reduce churn through better onboarding",
        "hint": "1–2 sentences is enough. This is the most important question.",
    },
    {
        "index": 1,
        "stage": 1,
        "question": "Who are you writing for?",
        "input_type": "single_chip",
        "chips": [
            "Startup Founders",
            "SME Business Owners",
            "Corporate Executives",
            "Marketing Professionals",
            "Tech Teams",
            "General Consumers",
        ],
        "hint": "Pick the closest match. You can refine with 'Other'.",
    },
    {
        "index": 2,
        "stage": 1,
        "question": "Pick up to 3 words that describe how your brand should sound.",
        "input_type": "multi_chip",
        "max_select": 3,
        "chips": [
            "Bold", "Warm", "Authoritative", "Conversational",
            "Inspiring", "Direct", "Playful", "Expert",
            "Empathetic", "Premium",
        ],
        "hint": "Choose 3. These become your brand's voice fingerprint.",
    },
    {
        "index": 3,
        "stage": 1,
        "question": "What should this brand NEVER say or do in content?",
        "input_type": "text",
        "placeholder": "e.g. Never mention competitors by name. Avoid aggressive sales language.",
        "hint": "Off-limits topics, phrases, or tones. Leave blank if none.",
    },
    # ── Stage 2: Depth (optional, unlocks after Stage 1) ──────────────────
    {
        "index": 4,
        "stage": 2,
        "question": "What are the 2–3 biggest problems your brand solves for customers?",
        "input_type": "text",
        "placeholder": "e.g. Our clients waste 3 hours a day on manual reporting. We fix that.",
        "hint": "Specific pain points produce the most compelling content.",
    },
    {
        "index": 5,
        "stage": 2,
        "question": "What makes your brand different from competitors?",
        "input_type": "text",
        "placeholder": "e.g. We're the only agency that focuses exclusively on B2B SaaS in SEA.",
        "hint": "One or two sentences. This sharpens the positioning angle in every post.",
    },
    {
        "index": 6,
        "stage": 2,
        "question": "What kind of content do you want to lead with?",
        "input_type": "multi_chip",
        "max_select": 2,
        "chips": [
            "Thought Leadership",
            "Client Results / Case Studies",
            "Educational Tips",
            "Behind the Scenes",
            "Industry News & Takes",
            "Promotional",
        ],
        "hint": "Pick 1–2. This sets the default angle for all generated posts.",
    },
    {
        "index": 7,
        "stage": 2,
        "question": "Paste 1–3 examples of content whose style you want to match.",
        "input_type": "text",
        "placeholder": "Paste real posts or captions from any brand you admire…",
        "hint": "Optional but powerful — real examples beat any description.",
    },
]
```

- [ ] **Step 4: Update the `/interview-questions` endpoint to return structured objects**

Replace the endpoint body (lines 63–70) with:

```python
@router.get("/interview-questions")
async def get_interview_questions(_: Annotated[dict, Depends(current_user)]):
    """Return the structured interview questions for brand voice creation."""
    return {"questions": INTERVIEW_QUESTIONS}
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
pytest tests/test_interview.py -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/brands.py backend/tests/test_interview.py
git commit -m "feat: replace flat interview questions with structured 8-question progressive set"
```

---

## Task 3: Update generate_voice_config prompt to handle chip answers

**Files:**
- Modify: `backend/app/services/anthropic_service.py`

- [ ] **Step 1: Write failing test**

Add to `backend/tests/test_interview.py`:

```python
from app.services.anthropic_service import _build_voice_config_prompt


def test_voice_config_prompt_renders_chip_answers_distinctly():
    answers = [
        {"question_index": 0, "question": "What does your brand do?", "answer": "We help founders", "stage": 1},
        {"question_index": 1, "question": "Who are you writing for?", "answer": "Startup Founders", "stage": 1},
        {"question_index": 2, "question": "Pick up to 3 words...", "answer": "Bold, Direct, Expert", "stage": 1},
    ]
    prompt = _build_voice_config_prompt("Acme", "Tech", answers, [])
    assert "Startup Founders" in prompt
    assert "Bold, Direct, Expert" in prompt
    assert "Acme" in prompt


def test_voice_config_prompt_includes_stage2_when_provided():
    answers = [
        {"question_index": 0, "question": "What does your brand do?", "answer": "We help founders", "stage": 1},
        {"question_index": 4, "question": "Biggest problems solved?", "answer": "Clients waste 3 hours on reports", "stage": 2},
    ]
    prompt = _build_voice_config_prompt("Acme", "Tech", answers, [])
    assert "Clients waste 3 hours on reports" in prompt


def test_voice_config_prompt_works_without_stage2():
    answers = [
        {"question_index": 0, "question": "What does your brand do?", "answer": "We help founders", "stage": 1},
    ]
    prompt = _build_voice_config_prompt("Acme", "Tech", answers, [])
    assert "Acme" in prompt
    assert "We help founders" in prompt
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_interview.py::test_voice_config_prompt_renders_chip_answers_distinctly -v
```

Expected: FAIL — `_build_voice_config_prompt` does not exist yet.

- [ ] **Step 3: Extract `_build_voice_config_prompt` helper and update `generate_voice_config` in `backend/app/services/anthropic_service.py`**

Add this function before `generate_voice_config` (insert after the existing `_build_user_prompt` function, around line 53):

```python
def _build_voice_config_prompt(
    brand_name: str,
    industry: str,
    interview_answers: list[dict],
    sample_posts: list[str],
) -> str:
    """Build the user prompt for voice config generation from structured interview answers."""
    stage1 = [a for a in interview_answers if a.get("stage", 1) == 1]
    stage2 = [a for a in interview_answers if a.get("stage", 1) == 2]

    def fmt_answer(a: dict) -> str:
        return f"Q: {a['question']}\nA: {a['answer']}"

    stage1_block = "\n\n".join(fmt_answer(a) for a in stage1) if stage1 else "No core answers provided."
    stage2_block = "\n\n".join(fmt_answer(a) for a in stage2) if stage2 else ""
    samples_block = "\n\n---\n\n".join(sample_posts) if sample_posts else "No sample posts provided."

    depth_section = f"\n\n## Additional Brand Depth (Stage 2)\n{stage2_block}" if stage2_block else ""

    return f"""You are a brand strategist. Based on the interview answers and sample posts below, generate a structured brand voice configuration for {brand_name} ({industry}).

## Core Brand Interview (Stage 1)
{stage1_block}{depth_section}

## Sample Posts / Style References
{samples_block}

Important:
- Q2 (audience) and Q3 (personality words) are chip selections — treat them as direct, authoritative signals, not approximations.
- If Stage 2 answers are provided, use them to add specificity and positioning depth to the voice config.
- If Stage 2 is absent, infer reasonable defaults from Stage 1 answers.

Return ONLY valid JSON with this exact structure:
{{
  "tone_descriptors": ["list", "of", "3-6", "adjectives"],
  "content_pillars": [
    {{"name": "Pillar Name", "description": "One sentence description"}}
  ],
  "platform_rules": {{
    "linkedin": "Specific guidance for LinkedIn posts",
    "instagram": "Specific guidance for Instagram posts",
    "tiktok": "Specific guidance for TikTok posts",
    "facebook": "Specific guidance for Facebook posts",
    "x": "Specific guidance for X/Twitter posts",
    "youtube": "Specific guidance for YouTube posts"
  }},
  "word_bank": ["list", "of", "10-20", "brand-appropriate", "words"],
  "avoid": ["things", "to", "never", "say", "or", "do"],
  "sample_prompts": ["3 example generation prompts tailored to this brand"]
}}"""
```

Then update `generate_voice_config` to use this helper. Replace the existing `prompt = f"""..."""` block (lines 118–148) with:

```python
async def generate_voice_config(
    brand_name: str,
    industry: str,
    interview_answers: list[dict],
    sample_posts: list[str],
) -> dict:
    """Use Claude to synthesise interview answers + sample posts into a brand voice config."""
    from app.config import get_settings
    import anthropic
    import json
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    prompt = _build_voice_config_prompt(brand_name, industry, interview_answers, sample_posts)

    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    text = message.content[0].text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return json.loads(text.strip())
```

- [ ] **Step 4: Run tests to verify all pass**

```bash
pytest tests/test_interview.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/anthropic_service.py backend/tests/test_interview.py
git commit -m "feat: extract _build_voice_config_prompt; handle chip answers in voice config generation"
```

---

## Task 4: Update frontend API type

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Find `InterviewAnswer` type in `frontend/lib/api.ts`**

```bash
grep -n "InterviewAnswer" frontend/lib/api.ts
```

- [ ] **Step 2: Add `stage` field to `InterviewAnswer` type**

Find the existing `InterviewAnswer` interface/type (it will look like `{ question_index: number; question: string; answer: string }`). Add the `stage` field:

```typescript
export interface InterviewAnswer {
  question_index: number;
  question: string;
  answer: string;
  stage: number;  // 1 = Core, 2 = Depth
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add stage field to InterviewAnswer frontend type"
```

---

## Task 5: Add interview step to BrandVoiceWizard

**Files:**
- Modify: `frontend/components/domain/BrandVoiceWizard.tsx`

This is the main UI task. The wizard gains a new `"interview"` step that appears before `"source"`. Stage 1 (4 questions) is shown first. After completing Stage 1, a "Want sharper results?" section reveals Stage 2 (4 questions) with a visible skip link.

- [ ] **Step 1: Add `"interview"` to the `WizardStep` type and `STEPS` array**

Find `type WizardStep = "source" | "review" | "generate" | "config";` (line 24) and replace with:

```typescript
type WizardStep = "interview" | "source" | "review" | "generate" | "config";
```

Find the `STEPS` array (around line 206) and replace with:

```typescript
const STEPS: { key: WizardStep; label: string }[] = [
  { key: "interview", label: "Interview" },
  { key: "source", label: "Sources" },
  { key: "review", label: "Review" },
  { key: "generate", label: "Generate" },
  { key: "config", label: "Config" },
];
```

- [ ] **Step 2: Update initial step and add interview state**

Find `const [step, setStep] = useState<WizardStep>("source");` (line 50) and replace with:

```typescript
const [step, setStep] = useState<WizardStep>("interview");
```

Add interview state variables after the existing `// Step 1 state` block (after line 58):

```typescript
// Interview state
const [interviewAnswers, setInterviewAnswers] = useState<Record<number, string>>({});
const [showStage2, setShowStage2] = useState(false);
```

- [ ] **Step 3: Add the interview step to the wizard body**

Find the `{/* Body */}` section (around line 253). Add the interview step render before the existing `{step === "source" && (` block:

```typescript
{step === "interview" && (
  <StepInterview
    answers={interviewAnswers}
    setAnswers={setInterviewAnswers}
    showStage2={showStage2}
    setShowStage2={setShowStage2}
  />
)}
```

- [ ] **Step 4: Add interview step footer buttons**

In the `{/* Footer */}` section, add the interview step button alongside the existing step buttons. Find the block `{step === "source" && (` in the footer and add before it:

```typescript
{step === "interview" && (
  <button
    onClick={() => setStep("source")}
    disabled={!interviewAnswers[0]?.trim() || !interviewAnswers[1]?.trim() || !interviewAnswers[2]?.trim()}
    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
  >
    Next: Add Sources <ChevronRight className="w-4 h-4" />
  </button>
)}
```

The "Next" button requires answers to Q1 (index 0), Q2 (index 1), and Q3 (index 2). Q4 (off-limits, index 3) is optional.

- [ ] **Step 5: Pass interview answers into the generation call**

Find `runGeneration` (around line 135). The existing call passes `interview_answers: []`. Replace it with:

```typescript
const builtAnswers: InterviewAnswer[] = Object.entries(interviewAnswers)
  .filter(([, answer]) => answer.trim())
  .map(([indexStr, answer]) => {
    const idx = parseInt(indexStr);
    const QUESTIONS = [
      { question: "What does your brand do, and who is it for?", stage: 1 },
      { question: "Who are you writing for?", stage: 1 },
      { question: "Pick up to 3 words that describe how your brand should sound.", stage: 1 },
      { question: "What should this brand NEVER say or do in content?", stage: 1 },
      { question: "What are the 2–3 biggest problems your brand solves for customers?", stage: 2 },
      { question: "What makes your brand different from competitors?", stage: 2 },
      { question: "What kind of content do you want to lead with?", stage: 2 },
      { question: "Paste 1–3 examples of content whose style you want to match.", stage: 2 },
    ];
    return {
      question_index: idx,
      question: QUESTIONS[idx]?.question ?? `Question ${idx}`,
      answer,
      stage: QUESTIONS[idx]?.stage ?? 1,
    };
  });

const res = await generateVoiceConfigForBrand({
  brand_name: brandName,
  industry: brandIndustry,
  interview_answers: builtAnswers,
  sample_posts: [combinedText],
});
```

Add the `InterviewAnswer` import at the top of the file where other api types are imported:

```typescript
import {
  analyseSourcesForBrand,
  generateVoiceConfigForBrand,
  getBrand,
  updateBrand,
  type AnalyseSourcesResponse,
  type InterviewAnswer,
  type SourceResult,
  type VoiceConfigResult,
} from "@/lib/api";
```

- [ ] **Step 6: Add the `StepInterview` component**

Add this component at the bottom of `BrandVoiceWizard.tsx`, after the `Step1Sources` function:

```typescript
// ── Interview Step ────────────────────────────────────────────────────────

interface StepInterviewProps {
  answers: Record<number, string>;
  setAnswers: (a: Record<number, string>) => void;
  showStage2: boolean;
  setShowStage2: (v: boolean) => void;
}

function ChipSelect({
  chips,
  value,
  onChange,
  maxSelect,
}: {
  chips: string[];
  value: string;
  onChange: (v: string) => void;
  maxSelect?: number;
}) {
  const selected = value ? value.split(", ").filter(Boolean) : [];

  function toggle(chip: string) {
    if (maxSelect && maxSelect === 1) {
      onChange(chip === value ? "" : chip);
      return;
    }
    const next = selected.includes(chip)
      ? selected.filter((s) => s !== chip)
      : maxSelect && selected.length >= maxSelect
      ? selected
      : [...selected, chip];
    onChange(next.join(", "));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => {
        const active = selected.includes(chip);
        const disabled = !active && !!maxSelect && selected.length >= maxSelect;
        return (
          <button
            key={chip}
            type="button"
            onClick={() => !disabled && toggle(chip)}
            className={[
              "px-3 py-1.5 rounded-full border text-xs font-medium transition-colors",
              active
                ? "bg-primary-muted border-primary text-text-active"
                : disabled
                ? "border-border bg-surface text-text-muted opacity-40 cursor-not-allowed"
                : "border-border bg-surface text-text-muted hover:border-primary/40 hover:text-text-primary cursor-pointer",
            ].join(" ")}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

const STAGE1_QUESTIONS = [
  {
    index: 0,
    question: "What does your brand do, and who is it for?",
    hint: "1–2 sentences. This is the most important question.",
    placeholder: "e.g. We help SaaS founders reduce churn through better onboarding",
    inputType: "text" as const,
  },
  {
    index: 1,
    question: "Who are you writing for?",
    hint: "Pick the closest match.",
    inputType: "single_chip" as const,
    chips: ["Startup Founders", "SME Business Owners", "Corporate Executives", "Marketing Professionals", "Tech Teams", "General Consumers"],
  },
  {
    index: 2,
    question: "Pick up to 3 words that describe how your brand should sound.",
    hint: "Choose 3. These become your brand's voice fingerprint.",
    inputType: "multi_chip" as const,
    maxSelect: 3,
    chips: ["Bold", "Warm", "Authoritative", "Conversational", "Inspiring", "Direct", "Playful", "Expert", "Empathetic", "Premium"],
  },
  {
    index: 3,
    question: "What should this brand NEVER say or do in content?",
    hint: "Off-limits topics or tones. Leave blank if none.",
    placeholder: "e.g. Never mention competitors by name. Avoid aggressive sales language.",
    inputType: "text" as const,
  },
];

const STAGE2_QUESTIONS = [
  {
    index: 4,
    question: "What are the 2–3 biggest problems your brand solves for customers?",
    hint: "Specific pain points produce the most compelling content.",
    placeholder: "e.g. Our clients waste 3 hours a day on manual reporting. We fix that.",
    inputType: "text" as const,
  },
  {
    index: 5,
    question: "What makes your brand different from competitors?",
    hint: "1–2 sentences. Sharpens positioning in every post.",
    placeholder: "e.g. We're the only agency focused exclusively on B2B SaaS in SEA.",
    inputType: "text" as const,
  },
  {
    index: 6,
    question: "What kind of content do you want to lead with?",
    hint: "Pick 1–2. Sets the default angle for all generated posts.",
    inputType: "multi_chip" as const,
    maxSelect: 2,
    chips: ["Thought Leadership", "Client Results / Case Studies", "Educational Tips", "Behind the Scenes", "Industry News & Takes", "Promotional"],
  },
  {
    index: 7,
    question: "Paste 1–3 examples of content whose style you want to match.",
    hint: "Optional — real examples beat any description.",
    placeholder: "Paste real posts or captions from any brand you admire…",
    inputType: "text" as const,
  },
];

function StepInterview({ answers, setAnswers, showStage2, setShowStage2 }: StepInterviewProps) {
  function setAnswer(index: number, value: string) {
    setAnswers({ ...answers, [index]: value });
  }

  function renderQuestion(q: typeof STAGE1_QUESTIONS[0] | typeof STAGE2_QUESTIONS[0], i: number) {
    return (
      <div key={q.index} className="space-y-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            {i + 1}. {q.question}
          </p>
          {q.hint && <p className="text-xs text-text-muted mt-0.5">{q.hint}</p>}
        </div>
        {q.inputType === "text" ? (
          <textarea
            value={answers[q.index] ?? ""}
            onChange={(e) => setAnswer(q.index, e.target.value)}
            placeholder={"placeholder" in q ? q.placeholder : ""}
            rows={q.index === 7 ? 5 : 3}
            className="w-full rounded-lg border border-border bg-elevated text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-primary resize-none placeholder:text-text-muted"
          />
        ) : (
          <ChipSelect
            chips={"chips" in q ? q.chips! : []}
            value={answers[q.index] ?? ""}
            onChange={(v) => setAnswer(q.index, v)}
            maxSelect={"maxSelect" in q ? q.maxSelect : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">Tell us about your brand</h3>
        <p className="text-xs text-text-muted">
          Answer 4 quick questions and we'll build your brand voice. Takes about 60 seconds.
        </p>
      </div>

      {/* Stage 1 */}
      <div className="space-y-5">
        {STAGE1_QUESTIONS.map((q, i) => renderQuestion(q, i))}
      </div>

      {/* Stage 2 toggle */}
      <div className="border-t border-border pt-4">
        {!showStage2 ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">Want sharper results?</p>
              <p className="text-xs text-text-muted mt-0.5">Answer 4 more questions for more specific, on-brand content.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowStage2(true)}
              className="px-4 py-2 rounded-lg border border-border bg-elevated text-text-secondary hover:bg-border text-xs font-medium transition-colors"
            >
              Yes, go deeper
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">Deeper questions (optional)</p>
              <button
                type="button"
                onClick={() => setShowStage2(false)}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Skip these
              </button>
            </div>
            {STAGE2_QUESTIONS.map((q, i) => renderQuestion(q, i + 4))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/domain/BrandVoiceWizard.tsx frontend/lib/api.ts
git commit -m "feat: add 3-stage progressive interview step to BrandVoiceWizard"
```

---

## Task 6: End-to-end smoke test

- [ ] **Step 1: Start backend**

```bash
cd backend && py -m uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: Start frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Test the happy path**

1. Go to `http://localhost:3000/dashboard/brands`
2. Open an existing brand and click "Brand Voice Wizard"
3. Verify the wizard opens on the new **Interview** step (step 1 of 5)
4. Answer Q1 (text), Q2 (single chip), Q3 (multi-chip, pick 3)
5. Verify the **Next: Add Sources** button is enabled after Q1, Q2, Q3 are answered
6. Verify the button stays disabled if Q1 is empty
7. Click "Yes, go deeper" — verify Stage 2 questions appear
8. Click "Skip these" — verify Stage 2 collapses
9. Click "Next: Add Sources" — verify wizard moves to Sources step
10. Complete the wizard through to Config — verify voice config is generated successfully

- [ ] **Step 4: Test the skip path**

1. Open wizard again
2. Answer only Q1, Q2, Q3 (skip Q4 and Stage 2)
3. Proceed — verify generation still works with just 3 answers

- [ ] **Step 5: Run all backend tests**

```bash
cd backend && pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: brand voice interview redesign complete — 22 questions → 8-question progressive interview"
```
