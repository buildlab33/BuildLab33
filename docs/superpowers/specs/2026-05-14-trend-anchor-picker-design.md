# Trend Anchor Picker — Design Spec

**Date:** 2026-05-14
**Status:** Approved for planning

---

## Problem

Generated posts have no real-world grounding. The AI writes in a vacuum — no awareness of what is happening in the market right now. Every post sounds like it could have been written any time in the last three years.

The existing News Feed fetches RSS headlines per brand industry but is completely disconnected from the Generate flow. This spec bridges that gap with a smart, self-improving trend picker that surfaces the 5 most relevant headlines at generation time, learns from user behaviour, and injects the selected headline into the Claude prompt as a concrete real-world anchor.

---

## Goals

- 5 relevant headlines appear on the Generate page, ranked by brand + post context
- Algorithm improves over time from implicit clicks and explicit saves
- "Picked for you" vs "Trending" labels make the algorithm's work visible
- Trend selection is always optional — never blocks generation
- News source can be swapped without touching the algorithm or UI
- All 21 loopholes identified in design review are addressed

---

## Architecture

### Layer 1: News Provider (abstraction)

`backend/app/services/news_provider.py`

Abstract `NewsProvider` base class. All feed fetching goes through this interface. Swapping news sources = new file implementing the same interface + one config change. Nothing else changes.

```
Headline shape: { title, url, source, published_at, summary }
```

`RSSProvider` is the first concrete implementation — reuses the existing `_fetch_all()` and `_get_feeds_for_industry()` logic from `news.py`, refactored into the provider.

### Layer 2: Trend Ranker (algorithm)

`backend/app/services/trend_ranker.py`

- Extracts keyword signals from brand config (industry, content pillars, voice keywords) AND post context (campaign goal, audience, platform)
- Chip label values (e.g. "Build Brand Awareness") are mapped to semantic keywords via a backend `CHIP_KEYWORD_MAP` constant — chip labels are UX labels, not search terms
- Scores each headline across 3 normalised dimensions (all 0–1):
  - **Relevance** (0.5 weight): keyword overlap against title + summary
  - **Recency** (0.3 weight): exponential decay, half-life = 24 hours
  - **Preference boost** (0.2 weight): weighted sum of decayed user interactions
- Preference boost only applied if decayed score > 0.1 threshold — otherwise headline labelled "Trending" not "Picked for you"
- Deduplicates by URL, then by fuzzy title match (Levenshtein distance < 0.2)
- Returns top 5 with label: `"picked_for_you"` or `"trending"`

### Layer 3: Preference Store (Supabase)

`trend_preferences` table:
```
id           uuid PK default gen_random_uuid()
user_id      uuid NOT NULL references auth.users
brand_id     uuid NOT NULL references brands(id)
headline_url text NOT NULL
headline_title text NOT NULL
action       text NOT NULL  -- 'clicked' | 'saved'
created_at   timestamptz default now()
```

Composite index on `(user_id, brand_id, created_at)` — required for performance.

Decay rules:
- `clicked`: 14-day decay window, ignored after 14 days
- `saved`: 30-day decay window, ignored after 90 days
- Postgres function purges rows older than 90 days (called by a lightweight scheduled endpoint)

Deduplication rules:
- `clicked`: same `(user_id, brand_id, headline_url)` within 24h → ignore duplicate write
- `saved`: idempotent toggle — insert if not exists, delete if exists

### Layer 4: Redis Cache (Upstash)

Both the trend headlines cache AND the existing in-memory news cache are migrated to Redis together. One cache, one source of truth.

- Cache key: `trends:{brand_id}`
- TTL: 3 hours
- On cache miss: fetch from RSS provider → rank → cache → return
- Cache stores the raw ranked list (5 headlines with labels)

**Note:** Upstash Redis is already in the tech stack. If `REDIS_URL` is not yet in `.env`, it must be added.

### Layer 5: API Endpoints

**`GET /api/trends/headlines`**
- Query params: `brand_id`, `goal`, `audience`, `platform`
- Auth: `current_user` required
- Brand access check: verify brand belongs to the requesting user's organisation
- Returns: `{ headlines: [...], source_status: "ok" | "degraded" | "unavailable" }`
- `source_status` is `"degraded"` if some feeds failed, `"unavailable"` if all failed

**`POST /api/trends/interaction`**
- Body: `{ brand_id, headline_url, headline_title, action: "clicked" | "saved" }`
- Auth: `current_user` required
- Brand access check: same as above
- Deduplication enforced server-side
- Response: `{ ok: true }` always — failure is silent (fire-and-forget pattern)

### Layer 6: Generate Schema Change

`backend/app/schemas/generate.py` gains:

```python
class TrendContext(BaseModel):
    title: str = Field(max_length=200)
    summary: str = Field(max_length=500)

class GenerateRequest(BaseModel):
    ...existing fields...
    trend_context: TrendContext | None = None
```

`trend_context` is sanitised before injection — strips prompt injection patterns, truncated to 200 chars for title and 500 chars for summary.

### Layer 7: Prompt Enrichment

Two new rules in `_build_system_prompt` (appended after existing rule 6):
```
7. Write like a real person who follows this industry closely. Use specific,
   concrete language. Avoid category-level generalities ("businesses today",
   "in the modern landscape"). Ground every claim in something tangible.
8. Vary sentence length deliberately. Mix short punchy sentences with longer
   ones. Never write three sentences of the same length in a row.
```

In `_build_user_prompt`, when `trend_context` is present:
```
Current market context — use this as a real-world hook or angle, not the
entire post topic. Open by reacting to it or building on it:
"{title}" — {summary}
```

### Layer 8: Frontend Component

`TrendAnchorPicker` — collapsible section on the Generate page, below the brief fields.

- Loads on brand select change (not page load — waits for brand + platform + goal + audience to be set)
- Shows skeleton while loading
- 5 headline cards: title (truncated 60 chars, full title in tooltip), source, time-ago, label chip
- Single-select — click selects, click again deselects
- Bookmark icon (separate from selection) — logs `saved` interaction
- Empty state: "Headlines unavailable — check back shortly" when `source_status` is `"unavailable"`
- Degraded state: shows available headlines with a subtle "Some sources unavailable" note
- `trendAnchor` state flows into `generatePost()` call as `trend_context`

### Layer 9: Generate Page Refactor

The existing `handleGenerate` has a bug: the Regenerate button calls it passing a `MouseEvent`, but it calls `e.preventDefault()` which throws on non-form events.

Refactored to:
- `collectParams()` — reads all form state, returns a params object
- `runGeneration(params)` — async, calls API, sets result
- Form `onSubmit`: `e.preventDefault(); runGeneration(collectParams())`
- Regenerate button: `runGeneration(collectParams())`

`trendAnchor` is included in `collectParams()` output.

---

## Security Considerations

1. **Brand access check** on both trend endpoints — user can only query/write for brands they own
2. **Prompt injection sanitisation** on `trend_context` before Claude injection — strip instruction-framing patterns, hard-truncate
3. **Interaction rate limiting** — server-side deduplication by `(user_id, brand_id, headline_url)` per 24h for `clicked`
4. **`saved` is idempotent** — cannot be spammed to inflate boost weight

---

## What This Deliberately Excludes

- No NewsAPI integration (RSS provider is sufficient; abstraction makes future swap trivial)
- No admin-configurable RSS feeds per brand (Phase 2 — add as a second `RSSProvider` variant)
- No real-time news (3-hour cache is fresh enough; live calls add latency and rate-limit risk)
- No topic management UI (Phase 2 — wait until preference data volume justifies it)
- No global learning across brands (per-brand preference keeps brand voice distinct)

---

## Files Touched

### Backend
| File | Change |
|------|--------|
| `app/services/news_provider.py` | **Create** — `NewsProvider` abstract base + `RSSProvider` implementation (refactored from `news.py`) |
| `app/services/trend_ranker.py` | **Create** — keyword extraction, scoring, deduplication, label assignment |
| `app/routers/trends.py` | **Create** — `GET /trends/headlines` + `POST /trends/interaction` |
| `app/schemas/trends.py` | **Create** — `TrendHeadline`, `TrendHeadlinesResponse`, `TrendInteractionRequest` |
| `app/routers/news.py` | **Modify** — remove internal `_fetch_all`/`_cache`, delegate to `RSSProvider`; migrate in-memory cache to Redis |
| `app/schemas/generate.py` | **Modify** — add `TrendContext` model + `trend_context` field on `GenerateRequest` |
| `app/services/anthropic_service.py` | **Modify** — rules 7-8 in `_build_system_prompt`; `trend_context` injection in `_build_user_prompt`; sanitisation |
| `app/main.py` | **Modify** — register `trends` router |
| `app/config.py` | **Modify** — add `redis_url: str = ""` setting |
| Supabase migration | **Create** — `trend_preferences` table + composite index + purge function |

### Frontend
| File | Change |
|------|--------|
| `frontend/lib/api.ts` | **Modify** — add `getTrendHeadlines()` + `logTrendInteraction()` API helpers |
| `frontend/components/domain/TrendAnchorPicker.tsx` | **Create** — collapsible picker component |
| `frontend/app/dashboard/generate/page.tsx` | **Modify** — refactor `handleGenerate` → `collectParams` + `runGeneration`; wire `trendAnchor` state; mount `TrendAnchorPicker` |
