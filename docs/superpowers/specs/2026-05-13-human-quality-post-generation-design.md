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
