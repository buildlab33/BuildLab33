# Human-Quality Post Generation — Design Spec

**Date:** 2026-05-13
**Status:** Approved for planning

---

## Problem

Generated posts feel generic and robotic for two reasons:

1. **No real-world anchor.** The AI writes in a vacuum — no knowledge of what is happening in the market right now. Every post sounds like it could have been written any time in the last three years.
2. **Form friction causes weak inputs.** Four open-text fields (Campaign Goal, Target Audience, Content Format, Growth Angle) are either left blank or filled with vague text. Weak inputs → weak outputs.

The underlying prompt engine and brand voice config are solid. This is a context-starvation and input-quality problem, not a prompt-wording problem.

---

## Goals

- Posts feel written by a real person who follows the industry, not an AI completing a form
- The Generate form is fast to fill — most users should be able to brief a post in under 30 seconds
- The system gets smarter the more a user uses it (personal presets accumulate)
- No mandatory steps added — trend grounding is always optional

---

## Architecture Overview

Three coordinated changes:

1. **Preset chip system** — replaces open-text fields with selectable chips backed by a global defaults table and a per-user personalisation layer
2. **Trend anchor picker** — optional headline chips sourced from the existing News Feed, injected into the generation prompt when selected
3. **Prompt enrichment** — two new instructions added to the system prompt; one optional `trend_context` field added to the user prompt

---

## Section 1: Preset Chip System

### Data model

**`global_presets` table** (Supabase)
```
id           uuid PK default gen_random_uuid()
field        text NOT NULL  -- campaign_goal | target_audience | content_format | growth_angle
label        text NOT NULL
display_order integer NOT NULL default 0
created_at   timestamptz default now()
```

**`user_presets` table** (Supabase)
```
id           uuid PK default gen_random_uuid()
user_id      uuid NOT NULL references auth.users
field        text NOT NULL
label        text NOT NULL
created_at   timestamptz default now()
```

**`user_preset_removals` table** (Supabase)
```
user_id      uuid NOT NULL references auth.users
preset_id    uuid NOT NULL references global_presets(id)
PRIMARY KEY (user_id, preset_id)
```

This three-table design means:
- Global defaults show for everyone by default
- A user hiding a global chip writes one row to `user_preset_removals`
- A user adding their own chip writes one row to `user_presets`
- Restoring a hidden global chip deletes the removal row

### Default chip sets (seeded at migration time)

**Campaign Goal (5 chips)**
- Build Brand Awareness
- Drive Sign-ups / Leads
- Showcase Client Work
- Educate the Audience
- Promote an Offer

**Target Audience (6 chips)**
- SME Founders
- Marketing Teams
- Tech Decision Makers
- C-Suite Executives
- Startup Teams
- Agency Professionals

**Content Format (5 chips)**
- Thought Leadership
- Case Study
- Tips & Tactics
- Industry Insight
- Behind the Scenes

**Growth Angle (6 chips)**
- Pain Point
- Industry Trend
- Success Story
- Contrarian Take
- Data & Stats
- Hot Topic

### Chip rendering in the form

Each field renders as a horizontal wrapping row of chips:

```
Campaign Goal
[ Build Brand Awareness ] [ Drive Sign-ups ] [ Showcase Work ] ...
[ + Other ]
```

- Exactly one chip can be selected per field (single-select)
- Selected chip gets `bg-primary-muted border-primary text-text-active` styling
- User's own saved chips appear after global defaults, before `[ + Other ]`
- Hidden global chips do not appear
- Each chip has a small `×` on hover — clicking it hides it (writes to `user_preset_removals`)

### Other flow

When user clicks `[ + Other ]`:
1. A text input appears inline below the chip row
2. Two buttons appear: **Use Once** and **Save & Use**
3. **Use Once** — sets the field value for this generation only, input clears after Generate
4. **Save & Use** — saves to `user_presets` and sets field value; chip appears in future sessions
5. Pressing Escape closes the input and returns to chip view without selecting anything

### Admin preset management

Admins see a "Manage Default Chips" section in Settings > Team (or a dedicated admin panel route). They can:
- Add a new global chip to any field
- Remove a global chip (soft-delete: marks it inactive, existing user removals unaffected)
- Reorder chips via drag or up/down arrows

This is a simple CRUD interface — no special logic needed.

---

## Section 2: Trend Anchor Picker

### Data flow

1. When the Generate form loads, fetch the 5 most recent news articles from the `news_items` table (or equivalent) filtered by the selected brand's industry
2. Display them as selectable headline chips in a collapsible "Ground in a current trend" section below the brief fields
3. If no articles exist for the brand's industry, the section is hidden entirely
4. User taps a headline to select it (tapping again deselects — always optional)
5. Selected headline's `title` and `summary` (or first 200 chars of content) are passed as `trend_context` in the generation request

### Headline chip rendering

```
Ground in a current trend  (optional)  [chevron to collapse]
─────────────────────────────────────────────────────────────
[ AI Reshapes B2B Sales Funnels in SEA ]
[ LinkedIn Engagement Down 18% — What Changed ]
[ Why Founders Are Ditching Long-Form for Micro-Content ]
[ Singapore SMEs Report 3× ROI on Short Video ]
[ The End of the Cold Email Era ]
```

- Single-select (only one headline can anchor a post)
- Selected chip shows `border-primary bg-primary-muted`
- Section is collapsed by default on first visit, expanded by default if user has previously selected a trend
- Headline text truncated to 60 chars with tooltip showing full title

### Backend API change

`GET /news?industry={industry}&limit=5` — existing news endpoint, no change needed if it already supports industry filtering. If not, add the `industry` query param.

The generation request body gains one optional field:

```json
{
  "brand_id": "...",
  "platform": "linkedin",
  "campaign_goal": "Build Brand Awareness",
  "audience": "SME Founders",
  "content_format": "Thought Leadership",
  "growth_angle": "Industry Trend",
  "trend_context": {
    "title": "AI Reshapes B2B Sales Funnels in SEA",
    "summary": "A new wave of AI tools is changing how B2B companies in Southeast Asia..."
  }
}
```

`trend_context` is optional. When absent, generation behaves exactly as today.

---

## Section 3: Prompt Enrichment

### System prompt additions

Two new rules appended to the existing system prompt in `_build_system_prompt`:

```
7. Write like a real person who follows this industry closely. Use specific,
   concrete language. Avoid category-level generalities ("businesses today",
   "in the modern landscape"). Ground every claim in something tangible.
8. Vary sentence length deliberately. Mix short punchy sentences with longer
   ones. Never write three sentences of the same length in a row.
```

### User prompt addition

In `_build_user_prompt`, when `trend_context` is present, inject after the growth angle line:

```
Current market context — anchor this post to this trend, open by reacting to
it or building on it (do not just mention it in passing):
"{title}" — {summary}
```

When `trend_context` is absent, nothing changes in the user prompt.

### Schema change

`PostGenerateRequest` Pydantic model gains one optional field:

```python
class TrendContext(BaseModel):
    title: str
    summary: str

class PostGenerateRequest(BaseModel):
    ...existing fields...
    trend_context: Optional[TrendContext] = None
```

---

## Section 4: What This Deliberately Excludes

- **No AI-suggested presets** — the global defaults cover common cases; AI suggestion is YAGNI
- **No per-brand preset sets** — user-level personalisation is sufficient for now
- **No mandatory trend selection** — always optional, never blocks generation
- **No preset editing** — delete and re-add is sufficient; an edit UI adds complexity for minimal gain
- **No real-time external trend fetch** — News Feed articles are the source; freshness is a News Feed concern not a generation concern
- **No multi-select on chips** — one value per field keeps the prompt clean and focused

---

## Section 5: Files Touched

### Backend
| File | Change |
|------|--------|
| `app/schemas/posts.py` | Add `TrendContext` model; add `trend_context: Optional[TrendContext]` to generate request |
| `app/services/anthropic_service.py` | Add rules 7–8 to system prompt; inject `trend_context` into user prompt |
| `app/routers/generate.py` (or wherever generate endpoint lives) | Pass `trend_context` through to `generate_post()` |
| New migration | Create `global_presets`, `user_presets`, `user_preset_removals` tables; seed default chips |
| New router `app/routers/presets.py` | CRUD endpoints for presets |

### Frontend
| File | Change |
|------|--------|
| `frontend/lib/api.ts` | Add preset fetch/save/remove API calls; pass `trend_context` in generate request |
| `frontend/app/dashboard/generate/page.tsx` | Redesign brief section with chip rows; add trend picker section |
| New `frontend/components/domain/PresetChipField.tsx` | Reusable chip-select field component with Other flow |
| New `frontend/components/domain/TrendAnchorPicker.tsx` | Headline chip picker component |
| `frontend/app/dashboard/settings/team/page.tsx` (admin only) | Admin chip management UI |

---

## Success Criteria

1. A user can brief a complete post using only chip selections in under 30 seconds
2. Posts generated with a trend anchor reference something specific and current in the opening
3. Posts pass a "does this sound like a real person wrote it" gut-check without editing
4. Users can save a custom chip and see it in future sessions
5. Admins can add/remove global default chips without a code deploy

---

## Section 6: Brand Voice Interview Redesign

### Problem with current interview

The existing interview has 22 open-text questions asked in one long form. Users who are new, time-pressured, or frustrated give low-quality answers — which produces a voice config worse than the default fallback. The interview needs to feel friendly and fast, not like a compliance form.

### New structure: 3-stage progressive interview

**Stage 1 — Core (4 questions, chip-assisted, ~60 seconds)**
Required. Unlocks voice config generation on its own.

**Stage 2 — Depth (4 questions, ~2 minutes)**
Optional. Shown after Stage 1 with a "want sharper results?" prompt. User can skip straight to Generate.

**Stage 3 — Sample posts (optional, existing feature)**
Paste real published posts. Unchanged from current implementation.

---

### Stage 1 Questions

**Q1 — What does your brand do, and who is it for?**
- Type: Short open text (1–2 sentences)
- Why: The single highest-signal input. Everything the AI writes — angle, vocabulary, examples — traces back to this. A brand helping SaaS founders reduce churn writes completely differently from one helping F&B businesses attract foot traffic. No tone keywords compensate for missing this.

**Q2 — Who are you writing for?**
- Type: Single-select chips + Other
- Chips: `Startup Founders` · `SME Business Owners` · `Corporate Executives` · `Marketing Professionals` · `Tech Teams` · `General Consumers`
- Why: The audience determines vocabulary level, formality, pain points to reference, and what counts as credible. Writing for a CMO sounds nothing like writing for a small business owner. Chips work here because most brands clearly fit one bucket — open text adds friction with no quality gain.

**Q3 — Pick up to 3 words that describe how your brand should sound.**
- Type: Multi-select chips (max 3) + Other
- Chips: `Bold` · `Warm` · `Authoritative` · `Conversational` · `Inspiring` · `Direct` · `Playful` · `Expert` · `Empathetic` · `Premium`
- Why: Three adjectives give the AI a concrete personality triangle. "Bold, Direct, Expert" produces very different copy from "Warm, Conversational, Empathetic." Replaces both the separate tone question and the formality scale — personality chips capture both in one step.

**Q4 — What should this brand NEVER say or do in content?**
- Type: Short open text (e.g. "don't mention competitors by name", "never use aggressive sales language")
- Why: Off-limits is a hard constraint, not a soft preference. Missing it means the AI may produce content that embarrasses the brand or violates a client agreement. Most people know their red lines immediately — this question is fast to answer and protects the brand.

---

### Stage 2 Questions

Shown after Stage 1 completes, under the heading: **"Want sharper, more specific results? Answer 4 more questions."** Skip link always visible.

**Q5 — What are the 2–3 biggest problems your brand solves for customers?**
- Type: Open text
- Why: The best marketing content is rooted in real pain points. When the AI knows "clients come to us because they waste 3 hours a day on manual reporting," it writes posts that make the audience feel seen. Without this, posts default to generic benefit statements. Stage 2 because the AI generates decent content without it — but noticeably better with it.

**Q6 — What makes your brand different from competitors?**
- Type: Open text (1–2 sentences)
- Why: Sharpens the positioning angle. A brand that differentiates on speed writes differently from one that differentiates on trust or relationships. Without this the AI defaults to safe middle-ground positioning that sounds like everyone else.

**Q7 — What kind of content do you want to lead with?**
- Type: Multi-select chips (pick 1–2) + Other
- Chips: `Thought Leadership` · `Client Results / Case Studies` · `Educational Tips` · `Behind the Scenes` · `Industry News & Takes` · `Promotional`
- Why: Sets the content pillar direction — tells the AI what "good content" looks like for this brand. Without this signal the AI picks a random angle each time, producing inconsistent output across posts.

**Q8 — Paste 1–3 examples of content whose style you want to match.**
- Type: Optional open text (any brand, any platform)
- Why: The highest-quality voice signal of all. Real examples are worth more than any description — "write like this" beats "be authoritative and warm" every time. The AI studies rhythm, sentence length, vocabulary, and hooks directly from the examples. Optional because not everyone has examples ready, but users who provide them get noticeably better output.

---

### Questions removed from current set (and why)

| Removed question | Reason |
|-----------------|--------|
| Industry/sector | Already stored on the brand profile — auto-populated, no need to ask again |
| Key differentiators (separate from Q6) | Merged into Q6 |
| Competitors + what to do differently | Too detailed for onboarding; overlaps Q6 |
| Industry jargon vs plain language | Captured by tone personality chips (Q3) |
| Ideal customer profile detail | Duplicates Q2 in more words |
| Geographic focus | Rarely affects post copy directly |
| Formality scale 1–10 | Duplicates Q3 chips |
| Objections prospects have | Useful but too advanced for this stage |
| Content success definition | Affects strategy not voice |
| Cultural sensitivities | Edge case — can be added to off-limits (Q4) manually |
| Seasonal campaigns | Operational detail, not voice |
| Platforms that matter most | Already set per-post at generation time |
| Emotional response to evoke | Captured by personality chips (Q3) |
| Thought leadership stance | Captured by content type chips (Q7) |

---

### Backend changes for interview redesign

| File | Change |
|------|--------|
| `app/routers/brands.py` | Replace `INTERVIEW_QUESTIONS` list with the new 8-question structure; add `stage` field to each question; add `input_type` field (text / single_chip / multi_chip); add `chips` array where applicable |
| `app/schemas/brands.py` | Update `InterviewQuestion` schema to include `stage`, `input_type`, `chips`, `max_select` |
| `app/services/anthropic_service.py` | Update `generate_voice_config` prompt to handle the new answer shapes (chip selections vs open text) |

### Frontend changes for interview redesign

| File | Change |
|------|--------|
| `frontend/components/domain/BrandVoiceWizard.tsx` | Replace open-text question list with Stage 1 / Stage 2 layout; render chip-select inputs for Q2, Q3, Q7; render text inputs for Q1, Q4, Q5, Q6, Q8; add "Skip to Generate" affordance on Stage 2 |
