# Lead Generation — Design Spec

## Goal

Add AI-powered influencer and partner discovery to BuildLab33. Users select a brand, trigger on-demand discovery, review AI-generated lead suggestions in an inbox, edit the outreach opener, and approve leads directly into the existing Contacts CRM.

## Architecture

### Backend

**New file:** `backend/app/routers/leads.py`
- Single endpoint: `POST /api/leads/discover`
- Accepts `{ brand_id: string }`
- Fetches brand context (name, industry, content_pillars, hashtag_sets, voice_config) from Supabase
- Calls Claude API (`claude-haiku-4-5-20251001`) with a structured prompt
- Returns a validated JSON array of 10-15 lead suggestions
- Registered in `backend/app/main.py` under `/api/leads`

**New schema:** `backend/app/schemas/leads.py`
- `DiscoverRequest`: `brand_id: str`
- `LeadSuggestion`: full response schema per lead
- `DiscoverResponse`: `leads: list[LeadSuggestion]`

**No new DB table** — suggestions are ephemeral. Approved leads use the existing `POST /api/contacts` endpoint.

### Frontend

**New page:** `frontend/app/dashboard/leads/discover/page.tsx`
- Three UI states: empty (brand selector + button), loading (skeleton cards), results (card grid)

**Modified:** `frontend/app/dashboard/leads/page.tsx`
- Add "Find Leads" button linking to `/dashboard/leads/discover`

**New API helper:** `frontend/lib/leads-api.ts`
- `discoverLeads(brand_id: string)` → calls `POST /api/leads/discover`

## Data Flow

```
User selects brand → clicks "Find Leads"
  → POST /api/leads/discover { brand_id }
    → fetch brand context from Supabase
    → call Claude API with brand context prompt
    → parse + validate JSON response
  → return LeadSuggestion[]
→ frontend renders discovery inbox cards
→ frontend fetches GET /api/contacts?brand_id=X for dedup check
→ user edits outreach opener inline on each card
→ user clicks Approve
  → dedup check: warn if name or handle already in contacts
  → POST /api/contacts with lead data + edited opener in notes
  → card disappears with success flash
→ user clicks Dismiss → card disappears
→ when all actioned: "X leads imported" + link to Leads list
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

**Fit score:** 1-10 integer. Colour coding: 8-10 green, 5-7 amber, 1-4 red.

## Discovery Inbox UI

### Empty State
- Brand selector dropdown (all user's brands)
- "Find Leads" primary button
- Subtitle: "AI will suggest influencers and partners based on your brand's content pillars and voice"

### Loading State
- Skeleton grid of 6 placeholder cards
- Status line: "Finding influencers and partners for [Brand]..."

### Results State
- 2-column card grid (1 column on mobile)
- Each card contains:
  - Header: name + platform badge + fit score badge
  - Handle + company (muted)
  - Niche tag
  - Audience size
  - Reason paragraph (read-only, muted)
  - Outreach opener: editable textarea (pre-filled, user can modify)
  - Footer: **Approve** button (primary) + **Dismiss** button (ghost)
  - Dedup warning banner (yellow) if name or handle matches existing contact: "Already in CRM as [status]"

### Completion State
- "All done — X leads imported, Y dismissed"
- Link: "View in Leads" → `/dashboard/leads`
- Button: "Find More" → resets to empty state

## Contact Import Format

On Approve, calls `POST /api/contacts`:
```json
{
  "brand_id": "uuid",
  "name": "Jane Doe",
  "company": "Jane Doe Media",
  "role": "Instagram Influencer",
  "status": "lead",
  "notes": "Platform: instagram | Handle: @janedoe | Niche: Sustainable fashion | Audience: 45K | Fit: 9/10\n\nOutreach opener:\nHi Jane, [edited opener text]"
}
```

## Deduplication

- Fetch existing contacts for the brand when results load
- Check each suggestion: does any contact share the same `name` OR `handle` (case-insensitive)?
- If match found: show yellow warning on card, allow force-approve or dismiss
- Dedup is client-side only — no backend change needed

## AI Prompt Strategy

**Model:** `claude-haiku-4-5-20251001` (fast, low cost)

**Prompt includes:**
- Brand name, industry
- Content pillars (names + descriptions)
- Hashtag sets (as topic signals)
- Voice config tone descriptors (to match personality fit)

**Prompt asks for:** JSON array of 10-15 influencer/partner suggestions with all fields in the schema above.

**Parsing:** Response parsed with Pydantic `LeadSuggestion` model. Invalid/missing fields get defaults. Partial results returned rather than failing the whole request.

## Future: Platform API Integration

Phase 2 (not in scope now):
- Instagram Graph API — real follower counts, post engagement
- YouTube Data API — subscriber counts, video stats
- LinkedIn API — company size, job titles
- Real handles replace AI estimates

The `platform` and `handle` fields in the schema are designed to accommodate real data when APIs are wired up.

## Files Touched

| File | Change |
|------|--------|
| `backend/app/routers/leads.py` | Create — discover endpoint |
| `backend/app/schemas/leads.py` | Create — request/response schemas |
| `backend/app/main.py` | Register leads router |
| `frontend/app/dashboard/leads/discover/page.tsx` | Create — discovery inbox page |
| `frontend/app/dashboard/leads/page.tsx` | Add "Find Leads" button |
| `frontend/lib/leads-api.ts` | Create — discoverLeads() helper |
