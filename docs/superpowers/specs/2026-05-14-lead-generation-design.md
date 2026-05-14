# Lead Generation — Design Spec

## Goal

Add AI-powered influencer and partner discovery to BuildLab33. Users select a brand, trigger on-demand discovery, review AI-generated lead suggestions in an inbox, edit the outreach opener, and approve leads directly into the existing Contacts CRM.

## Architecture

### Backend

**New file:** `backend/app/routers/leads.py`
- Single endpoint: `POST /api/leads/discover`
- Accepts `{ brand_id: string }`
- Validates user has access to the brand via `user_brands` table (same pattern as other brand endpoints)
- Rate limited: 5 requests/minute per user
- Fetches brand context (name, industry, content_pillars, hashtag_sets, voice_config) from Supabase
- Calls Claude API (`claude-haiku-4-5-20251001`) with a structured prompt
- Strips markdown code fences from response before JSON parsing
- Returns a validated, deduplicated array of 10-15 lead suggestions
- Registered in `backend/app/main.py` under `/api/leads`

**New schema:** `backend/app/schemas/leads.py`
- `DiscoverRequest`: `brand_id: str`
- `LeadSuggestion`: full response schema with `fit_score: int = Field(ge=1, le=10)` and coercion validator
- `DiscoverResponse`: `leads: list[LeadSuggestion]`

**No new DB table** — suggestions are ephemeral. Approved leads use the existing `POST /api/contacts` endpoint.

### Frontend

**New page:** `frontend/app/dashboard/leads/discover/page.tsx`
- Four UI states: empty, loading, results, completion
- Results persisted to `sessionStorage` keyed by `brand_id` — survives page refresh

**Modified:** `frontend/app/dashboard/leads/page.tsx`
- Add "Find Leads" button linking to `/dashboard/leads/discover`

**New API helper:** `frontend/lib/leads-api.ts`
- `discoverLeads(brand_id: string)` → calls `POST /api/leads/discover`

## Data Flow

```
User selects brand → clicks "Find Leads"
  → POST /api/leads/discover { brand_id }
    → verify user has brand access
    → fetch brand context from Supabase
    → build prompt (with graceful fallback if pillars/voice empty)
    → call Claude API
    → strip markdown fences, parse JSON, validate with Pydantic
    → deduplicate within batch by handle (case-insensitive)
  → return LeadSuggestion[]
→ frontend stores results in sessionStorage[brand_id]
→ frontend renders discovery inbox cards
→ frontend fetches GET /api/contacts?brand_id=X for dedup check
→ user edits outreach opener inline on each card
→ user clicks Approve (button disabled immediately on click)
  → dedup check: warn if name or handle matches existing contact
  → card enters "approving" state (spinner)
  → POST /api/contacts with lead data + edited opener in notes
  → card disappears with success flash
→ user clicks Dismiss → card disappears
→ when all cards actioned:
  - if X > 0: "X leads imported, Y dismissed" + "View in Leads" link
  - if X = 0: "Nothing imported — try a different brand or adjust your content pillars" + "Find More" button
→ "Find More" resets to empty state with same brand pre-selected
```

## Lead Suggestion Schema

Each suggestion returned by the AI:

```json
{
  "name": "Jane Doe",
  "platform": "instagram",
  "handle": "@janedoe",
  "company": "Jane Doe Media",
  "niche": "Sustainable fashion & lifestyle",
  "audience_size": "45K followers",
  "fit_score": 9,
  "reason": "Strong alignment with your eco brand pillars and posts regularly about sustainable living.",
  "outreach_opener": "Hi Jane, I love how you weave sustainability into everyday style..."
}
```

**Platform values:** `instagram`, `youtube`, `linkedin`, `blog`, `podcast`, `twitter`

**Fit score:** 1-10 integer. Pydantic coerces floats and string numbers. Colour coding: 8-10 green, 5-7 amber, 1-4 red.

**Batch dedup:** Backend deduplicates within the returned batch by `handle` (case-insensitive) before sending to frontend.

## Discovery Inbox UI

### Empty State
- Brand selector dropdown (all user's brands)
- "Find Leads" primary button
- Subtitle: "AI will suggest influencers and partners based on your brand's content pillars and voice"

### Loading State
- Skeleton grid of 6 placeholder cards
- Status line: "Finding influencers and partners for [Brand]..."

### Results State
- Disclaimer banner at top: "These are AI-generated archetypes — verify details before reaching out"
- 2-column card grid (1 column on mobile)
- Each card contains:
  - Header: name + platform badge + fit score badge (coloured)
  - Handle + company (muted)
  - Niche tag
  - Audience size
  - Reason paragraph (read-only, muted)
  - Outreach opener: editable textarea (pre-filled by AI, user can edit freely)
  - Footer: **Approve** button (primary, disabled on click until response) | **Dismiss** button (ghost)
  - Dedup warning banner (yellow) if name or handle matches existing contact in this brand: "Already in CRM as [status]"
- Results survive page refresh (stored in sessionStorage keyed by brand_id)

### Completion State
- If imports > 0: "X leads imported, Y dismissed" + "View in Leads" link + "Find More" button
- If imports = 0: "Nothing imported — try a different brand or adjust your content pillars" + "Find More" button
- "Find More" resets to empty state with the same brand pre-selected

## Contact Import Format

On Approve, calls `POST /api/contacts`. Outreach opener is truncated to fit within the 5000-char notes limit:

```json
{
  "brand_id": "uuid",
  "name": "Jane Doe",
  "company": "Jane Doe Media",
  "role": "Instagram Influencer",
  "status": "lead",
  "linkedin_url": null,
  "notes": "Platform: instagram | Handle: @janedoe | Niche: Sustainable fashion | Audience: 45K | Fit: 9/10\n\nOutreach opener:\nHi Jane, [edited opener text — truncated at 4800 chars total]"
}
```

**LinkedIn special case:** If `platform === "linkedin"` and handle looks like a URL or `/in/` path, populate `linkedin_url` field instead of (or in addition to) notes.

## Deduplication

### Within batch (backend)
- After Claude returns results, deduplicate by `handle` field (case-insensitive)
- Keep the first occurrence, discard duplicates
- This prevents Claude returning the same person twice with slightly different names

### Against existing CRM (client-side)
- Fetch existing contacts for the brand when results load (`GET /api/contacts?brand_id=X`)
- Check each suggestion: does any contact share the same `name` OR `handle` (case-insensitive, handle matched against notes field)?
- If match found: show yellow warning on card "Already in CRM as [status]" — user can still force-approve or dismiss
- Scope is per-brand only (cross-brand dedup not in scope)

## AI Prompt Strategy

**Model:** `claude-haiku-4-5-20251001` (fast, low cost)

**Prompt includes:**
- Brand name, industry
- Content pillars (names + descriptions) — if available
- Hashtag sets (as topic signals) — if available
- Voice config tone descriptors — if available
- Explicit instruction: generate illustrative archetypes (not claims about real accounts)

**Graceful fallback:** If brand has no content pillars or voice config (incomplete setup), the prompt uses only `name` and `industry`. A warning is shown on the empty state: "Your brand has limited profile data — results may be less relevant. Complete your brand voice setup for better suggestions."

**Prompt asks for:** JSON array of 10-15 suggestions with all fields in the schema above.

**Parsing:**
1. Strip markdown code fences (` ```json ` / ` ``` `) from raw response
2. Parse JSON
3. Validate each item with Pydantic `LeadSuggestion` — invalid items are skipped, not fatal
4. Deduplicate by handle
5. Return whatever valid suggestions remain (minimum 1, else return error)

**Rate limiting:** `@limiter.limit("5/minute")` on the endpoint — protects Claude API costs.

## Error Handling

| Scenario | Backend response | Frontend behaviour |
|----------|-----------------|-------------------|
| User has no brand access | 403 | Toast: "You don't have access to this brand" |
| Brand not found | 404 | Toast: "Brand not found" |
| Claude API error | 503 | Toast: "AI service unavailable — try again in a moment" |
| Claude returns unparseable JSON | 503 | Toast: "Failed to parse suggestions — try again" |
| All suggestions invalid after validation | 503 | Toast: "No valid suggestions returned — try again" |
| Rate limit hit | 429 | Toast: "Too many requests — wait a minute and try again" |

## Future: Platform API Integration

Phase 2 (not in scope now):
- Instagram Graph API — real follower counts, post engagement
- YouTube Data API — subscriber counts, video stats
- LinkedIn API — company size, job titles
- Real handles replace AI-generated archetypes

The `platform` and `handle` fields in the schema are designed to accommodate real data when APIs are wired up. The disclaimer banner is removed in Phase 2 for verified leads.

## Files Touched

| File | Change |
|------|--------|
| `backend/app/routers/leads.py` | Create — discover endpoint with auth, rate limit, prompt, parsing |
| `backend/app/schemas/leads.py` | Create — request/response schemas with fit_score coercion |
| `backend/app/main.py` | Register leads router |
| `frontend/app/dashboard/leads/discover/page.tsx` | Create — discovery inbox with 4 states + sessionStorage persistence |
| `frontend/app/dashboard/leads/page.tsx` | Add "Find Leads" button |
| `frontend/lib/leads-api.ts` | Create — discoverLeads() helper |
