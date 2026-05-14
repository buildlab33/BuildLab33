# Lead Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered influencer and partner discovery — users pick a brand, AI generates 10-15 lead suggestions, user reviews/edits and approves them into the existing Contacts CRM.

**Architecture:** New `POST /api/leads/discover` endpoint fetches brand context from Supabase, calls Claude Haiku, strips/parses/validates the JSON response, and returns deduplicated `LeadSuggestion[]`. Frontend discovery page has 4 states (empty → loading → results → completion) with sessionStorage persistence and client-side CRM dedup.

**Tech Stack:** FastAPI + Pydantic v2 (backend), Next.js 16 App Router + TypeScript + Tailwind CSS v4 (frontend), Anthropic SDK (claude-haiku-4-5-20251001), existing `contacts` table via `POST /api/contacts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/app/schemas/leads.py` | Create | `DiscoverRequest`, `LeadSuggestion`, `DiscoverResponse` schemas |
| `backend/app/routers/leads.py` | Create | `POST /api/leads/discover` — auth, rate limit, prompt, parse |
| `backend/app/main.py` | Modify | Register leads router |
| `frontend/lib/leads-api.ts` | Create | `discoverLeads()` API helper + TypeScript types |
| `frontend/app/dashboard/leads/discover/page.tsx` | Create | Discovery inbox — 4 UI states |
| `frontend/app/dashboard/leads/page.tsx` | Modify | Add "Find Leads" button |

---

### Task 1: Backend schemas

**Files:**
- Create: `backend/app/schemas/leads.py`

- [ ] **Step 1: Create the schemas file**

```python
# backend/app/schemas/leads.py
from typing import Literal
from pydantic import BaseModel, Field, field_validator


class DiscoverRequest(BaseModel):
    brand_id: str


class LeadSuggestion(BaseModel):
    name: str
    platform: Literal["instagram", "youtube", "linkedin", "blog", "podcast", "twitter"]
    handle: str
    company: str
    niche: str
    audience_size: str
    fit_score: int = Field(ge=1, le=10)
    reason: str
    outreach_opener: str

    @field_validator("fit_score", mode="before")
    @classmethod
    def coerce_fit_score(cls, v):
        try:
            return max(1, min(10, int(float(str(v).split("/")[0]))))
        except (ValueError, TypeError):
            return 5

    @field_validator("platform", mode="before")
    @classmethod
    def normalise_platform(cls, v):
        return str(v).lower().strip()


class DiscoverResponse(BaseModel):
    leads: list[LeadSuggestion]
```

- [ ] **Step 2: Verify the file exists**

```powershell
Get-Content backend\app\schemas\leads.py
```

Expected: file contents printed without error.

- [ ] **Step 3: Commit**

```powershell
git add backend/app/schemas/leads.py
git commit -m "feat: add lead generation schemas (DiscoverRequest, LeadSuggestion, DiscoverResponse)"
```

---

### Task 2: Backend router — discover endpoint

**Files:**
- Create: `backend/app/routers/leads.py`

- [ ] **Step 1: Create the router**

```python
# backend/app/routers/leads.py
"""Lead discovery endpoint — AI-powered influencer/partner suggestions."""
import json
import logging
import re
from typing import Annotated

from anthropic import Anthropic, APIError
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import get_supabase
from app.schemas.leads import DiscoverRequest, DiscoverResponse, LeadSuggestion
from app.security import current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["leads"])
limiter = Limiter(key_func=get_remote_address)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def _check_brand_access(brand_id: str, user_id: str, user_role: str) -> bool:
    sb = get_supabase()
    if user_role in ("super_admin", "admin"):
        res = sb.table("brands").select("id").eq("id", brand_id).limit(1).execute()
        return bool(res.data)
    res = (
        sb.table("user_brands")
        .select("brand_id")
        .eq("user_id", user_id)
        .eq("brand_id", brand_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _build_prompt(brand: dict) -> str:
    name = brand.get("name", "")
    industry = brand.get("industry", "")

    pillars = brand.get("content_pillars") or []
    pillars_text = ""
    if pillars:
        lines = [f"- {p['name']}: {p.get('description', '')}" for p in pillars]
        pillars_text = "\nContent pillars:\n" + "\n".join(lines)

    hashtags = brand.get("hashtag_sets") or []
    tags_text = ""
    if hashtags:
        all_tags = []
        for hs in hashtags:
            all_tags.extend(hs.get("tags", []))
        if all_tags:
            tags_text = f"\nRelevant hashtags/topics: {', '.join(all_tags[:20])}"

    voice = brand.get("voice_config") or {}
    tone_text = ""
    tone_descriptors = voice.get("tone_descriptors") or []
    if tone_descriptors:
        tone_text = f"\nBrand tone: {', '.join(tone_descriptors)}"

    return f"""You are a partnership strategist for {name}, a brand in the {industry} industry.{pillars_text}{tags_text}{tone_text}

Generate 12 illustrative influencer and partner archetypes that would be ideal collaborators for this brand.
These are fictional archetypes for discovery inspiration — do NOT claim they are real accounts.

Return ONLY a JSON array with exactly this structure per item:
[
  {{
    "name": "First Last",
    "platform": "instagram",
    "handle": "@handle",
    "company": "Company or Channel Name",
    "niche": "Short niche description",
    "audience_size": "45K followers",
    "fit_score": 9,
    "reason": "1-2 sentences explaining why they fit this brand.",
    "outreach_opener": "A personalised first-message opener for this lead (2-3 sentences)."
  }}
]

Platform must be one of: instagram, youtube, linkedin, blog, podcast, twitter.
fit_score must be an integer 1-10.
Return ONLY the JSON array. No explanation, no markdown, no preamble."""


def _parse_suggestions(raw: str) -> list[LeadSuggestion]:
    cleaned = _FENCE_RE.sub("", raw).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=503, detail=f"Failed to parse AI response: {e}")

    if not isinstance(data, list):
        raise HTTPException(status_code=503, detail="AI response was not a list")

    valid: list[LeadSuggestion] = []
    seen_handles: set[str] = set()
    for item in data:
        try:
            lead = LeadSuggestion(**item)
            key = lead.handle.lower().strip()
            if key not in seen_handles:
                seen_handles.add(key)
                valid.append(lead)
        except Exception:
            continue

    if not valid:
        raise HTTPException(status_code=503, detail="No valid suggestions returned — try again")

    return valid


@router.post("/discover", response_model=DiscoverResponse)
@limiter.limit("5/minute")
async def discover_leads(
    request: Request,
    body: DiscoverRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Generate AI-powered influencer/partner suggestions for a brand."""
    if not _check_brand_access(body.brand_id, user["sub"], user.get("role", "")):
        raise HTTPException(status_code=403, detail="You don't have access to this brand")

    sb = get_supabase()
    brand_res = sb.table("brands").select("*").eq("id", body.brand_id).limit(1).execute()
    if not brand_res.data:
        raise HTTPException(status_code=404, detail="Brand not found")

    brand = brand_res.data[0]
    settings = get_settings()

    if not settings.anthropic_api_key:
        # Dev fallback — return mock data without hitting Claude
        mock = [
            LeadSuggestion(
                name="Alex Rivera",
                platform="instagram",
                handle="@alexrivera",
                company="Rivera Media",
                niche=f"{brand.get('industry', 'General')} content creator",
                audience_size="28K followers",
                fit_score=8,
                reason=f"Strong alignment with {brand.get('name', 'your brand')} values and consistent posting cadence.",
                outreach_opener=f"Hi Alex, I've been following your work and think there's a real synergy with {brand.get('name', 'our brand')}. Would love to explore a collaboration.",
            )
        ]
        return DiscoverResponse(leads=mock)

    prompt = _build_prompt(brand)
    try:
        client = Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = "".join(block.text for block in msg.content if hasattr(block, "text")).strip()
    except APIError as e:
        logger.error("Anthropic API error in lead discovery: %s", e)
        raise HTTPException(status_code=503, detail="AI service unavailable — try again in a moment")

    leads = _parse_suggestions(raw)
    return DiscoverResponse(leads=leads)
```

- [ ] **Step 2: Verify file saved**

```powershell
Get-Content backend\app\routers\leads.py | Select-Object -First 5
```

Expected: first 5 lines of the file printed.

- [ ] **Step 3: Commit**

```powershell
git add backend/app/routers/leads.py
git commit -m "feat: add lead discovery endpoint with auth, rate limit, Claude prompt, and JSON parsing"
```

---

### Task 3: Register leads router in main.py

**Files:**
- Modify: `backend/app/main.py` (line 13 — imports, line 77 — include_router)

- [ ] **Step 1: Add leads to the import line**

In `backend/app/main.py`, find this line:
```python
from app.routers import auth, brands, contacts, generate, news, notifications, posts, trends, users
```

Replace with:
```python
from app.routers import auth, brands, contacts, generate, leads, news, notifications, posts, trends, users
```

- [ ] **Step 2: Register the router**

After this line in `create_app()`:
```python
    app.include_router(contacts.router, prefix=settings.api_prefix)
```

Add:
```python
    app.include_router(leads.router, prefix=settings.api_prefix)
```

- [ ] **Step 3: Verify backend starts without error**

```powershell
cd backend
uvicorn app.main:app --reload --port 8000
```

Expected: `INFO: Application startup complete.` with no import errors. Stop with Ctrl+C.

- [ ] **Step 4: Test the endpoint exists**

With the server running:
```powershell
curl -X POST http://localhost:8000/api/leads/discover -H "Content-Type: application/json" -d "{\"brand_id\": \"test\"}"
```

Expected: `401 Unauthorized` (not 404 — proves the route is registered).

- [ ] **Step 5: Commit**

```powershell
git add backend/app/main.py
git commit -m "feat: register leads router in main app"
```

---

### Task 4: Frontend API helper

**Files:**
- Create: `frontend/lib/leads-api.ts`

- [ ] **Step 1: Create the file**

```typescript
// frontend/lib/leads-api.ts
import api from "./api";

export type LeadPlatform = "instagram" | "youtube" | "linkedin" | "blog" | "podcast" | "twitter";

export interface LeadSuggestion {
  name: string;
  platform: LeadPlatform;
  handle: string;
  company: string;
  niche: string;
  audience_size: string;
  fit_score: number;
  reason: string;
  outreach_opener: string;
}

export interface DiscoverResponse {
  leads: LeadSuggestion[];
}

export const discoverLeads = (brand_id: string) =>
  api.post<DiscoverResponse>("/api/leads/discover", { brand_id });
```

- [ ] **Step 2: Verify TypeScript accepts the file**

```powershell
cd frontend
npx tsc --noEmit 2>&1 | Select-String "leads-api"
```

Expected: no output (no errors referencing leads-api.ts).

- [ ] **Step 3: Commit**

```powershell
git add frontend/lib/leads-api.ts
git commit -m "feat: add discoverLeads API helper and TypeScript types"
```

---

### Task 5: Discovery inbox page

**Files:**
- Create: `frontend/app/dashboard/leads/discover/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// frontend/app/dashboard/leads/discover/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands } from "@/lib/api";
import { getContacts, createContact } from "@/lib/contacts-api";
import { discoverLeads, LeadSuggestion } from "@/lib/leads-api";
import { toast } from "@/components/ui/toast";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";

interface Brand { id: string; name: string }

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram", youtube: "YouTube", linkedin: "LinkedIn",
  blog: "Blog", podcast: "Podcast", twitter: "Twitter / X",
};

const PLATFORM_COLOURS: Record<string, string> = {
  instagram: "bg-pink-500/15 text-pink-400",
  youtube: "bg-red-500/15 text-red-400",
  linkedin: "bg-blue-500/15 text-blue-400",
  blog: "bg-violet-500/15 text-violet-400",
  podcast: "bg-amber-500/15 text-amber-400",
  twitter: "bg-sky-500/15 text-sky-400",
};

function fitScoreClass(score: number) {
  if (score >= 8) return "bg-success/15 text-success";
  if (score >= 5) return "bg-warning/15 text-warning";
  return "bg-error/15 text-error";
}

function buildNotes(lead: LeadSuggestion, opener: string): string {
  const meta = `Platform: ${lead.platform} | Handle: ${lead.handle} | Niche: ${lead.niche} | Audience: ${lead.audience_size} | Fit: ${lead.fit_score}/10`;
  const openerSection = `\n\nOutreach opener:\n${opener}`;
  const full = meta + openerSection;
  return full.length > 4900 ? full.slice(0, 4900) + "…" : full;
}

function buildLinkedInUrl(handle: string): string | null {
  if (handle.includes("linkedin.com") || handle.includes("/in/")) return handle;
  return null;
}

const SESSION_KEY = (brandId: string) => `lead_discover_${brandId}`;

type PageState = "empty" | "loading" | "results" | "completion";

interface CardState {
  lead: LeadSuggestion;
  opener: string;
  approving: boolean;
  approved: boolean;
  dismissed: boolean;
  dupWarning: string | null;
}

export default function LeadsDiscoverPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [pageState, setPageState] = useState<PageState>("empty");
  const [cards, setCards] = useState<CardState[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [hasLimitedProfile, setHasLimitedProfile] = useState(false);

  useEffect(() => {
    getBrands()
      .then(r => {
        const list: Brand[] = r.data?.brands || [];
        setBrands(list);
        if (list.length > 0) setBrandId(list[0].id);
      })
      .catch(() => {});
  }, []);

  // Restore from sessionStorage on mount
  useEffect(() => {
    if (!brandId) return;
    const stored = sessionStorage.getItem(SESSION_KEY(brandId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as CardState[];
        const active = parsed.filter(c => !c.approved && !c.dismissed);
        if (active.length > 0) {
          setCards(parsed);
          setPageState("results");
        }
      } catch { /* ignore corrupt storage */ }
    }
  }, [brandId]);

  async function handleDiscover() {
    if (!brandId) return;
    setPageState("loading");
    setCards([]);
    setImportedCount(0);
    setDismissedCount(0);

    try {
      const [leadsRes, contactsRes] = await Promise.all([
        discoverLeads(brandId),
        getContacts({ brand_id: brandId }),
      ]);

      const existingContacts = contactsRes.data ?? [];
      const leads = leadsRes.data.leads;

      const initialCards: CardState[] = leads.map(lead => {
        const lowerHandle = lead.handle.toLowerCase();
        const lowerName = lead.name.toLowerCase();
        const dup = existingContacts.find(c =>
          c.name.toLowerCase() === lowerName ||
          (c.notes || "").toLowerCase().includes(lowerHandle)
        );
        return {
          lead,
          opener: lead.outreach_opener,
          approving: false,
          approved: false,
          dismissed: false,
          dupWarning: dup ? `Already in CRM as "${dup.status}"` : null,
        };
      });

      setCards(initialCards);
      sessionStorage.setItem(SESSION_KEY(brandId), JSON.stringify(initialCards));
      setPageState("results");
    } catch (err: unknown) {
      setPageState("empty");
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg || "Failed to discover leads — try again");
    }
  }

  function updateOpener(index: number, value: string) {
    setCards(prev => {
      const next = [...prev];
      next[index] = { ...next[index], opener: value };
      sessionStorage.setItem(SESSION_KEY(brandId), JSON.stringify(next));
      return next;
    });
  }

  async function handleApprove(index: number) {
    const card = cards[index];
    if (card.approving || card.approved) return;

    setCards(prev => {
      const next = [...prev];
      next[index] = { ...next[index], approving: true };
      return next;
    });

    const { lead, opener } = card;
    const isLinkedIn = lead.platform === "linkedin";
    const linkedInUrl = isLinkedIn ? buildLinkedInUrl(lead.handle) : null;

    try {
      await createContact({
        brand_id: brandId,
        name: lead.name,
        company: lead.company,
        role: `${PLATFORM_LABELS[lead.platform] || lead.platform} ${lead.niche.split("&")[0].trim()}`,
        status: "lead",
        linkedin_url: linkedInUrl ?? undefined,
        notes: buildNotes(lead, opener),
      });

      setCards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], approving: false, approved: true };
        sessionStorage.setItem(SESSION_KEY(brandId), JSON.stringify(next));
        return next;
      });
      setImportedCount(c => c + 1);
      checkCompletion(cards, index, "approved");
    } catch {
      setCards(prev => {
        const next = [...prev];
        next[index] = { ...next[index], approving: false };
        return next;
      });
      toast.error("Failed to import lead — try again");
    }
  }

  function handleDismiss(index: number) {
    setCards(prev => {
      const next = [...prev];
      next[index] = { ...next[index], dismissed: true };
      sessionStorage.setItem(SESSION_KEY(brandId), JSON.stringify(next));
      return next;
    });
    setDismissedCount(c => c + 1);
    checkCompletion(cards, index, "dismissed");
  }

  function checkCompletion(currentCards: CardState[], changedIndex: number, action: "approved" | "dismissed") {
    const updated = currentCards.map((c, i) => {
      if (i === changedIndex) return { ...c, [action]: true };
      return c;
    });
    const allDone = updated.every(c => c.approved || c.dismissed);
    if (allDone) {
      sessionStorage.removeItem(SESSION_KEY(brandId));
      setPageState("completion");
    }
  }

  function handleFindMore() {
    sessionStorage.removeItem(SESSION_KEY(brandId));
    setCards([]);
    setImportedCount(0);
    setDismissedCount(0);
    setPageState("empty");
  }

  const activeCards = cards.filter(c => !c.approved && !c.dismissed);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Find Leads</h1>
          <p className="text-sm text-text-muted mt-1">Discover influencers and partners for your brand</p>
        </div>
        <button
          onClick={() => router.push("/dashboard/leads")}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ← Back to Leads
        </button>
      </div>

      {/* Empty state */}
      {pageState === "empty" && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-6 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl gradient-brand flex items-center justify-center text-2xl">🔍</div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary mb-1">Discover leads for your brand</h2>
              <p className="text-sm text-text-muted">AI will suggest influencers and partners based on your brand's content pillars and voice</p>
            </div>
            {hasLimitedProfile && (
              <div className="w-full rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-xs text-warning text-left">
                Your brand has limited profile data — results may be less relevant. Complete your brand voice setup for better suggestions.
              </div>
            )}
            <div className="w-full space-y-3">
              <div className="relative">
                <select
                  value={brandId}
                  onChange={e => setBrandId(e.target.value)}
                  className="w-full appearance-none bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary pr-8"
                >
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              </div>
              <button
                onClick={handleDiscover}
                disabled={!brandId}
                className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Find Leads
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {pageState === "loading" && (
        <div className="space-y-4">
          <p className="text-sm text-text-muted text-center">
            Finding influencers and partners for {brands.find(b => b.id === brandId)?.name ?? "your brand"}...
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-5 space-y-3 animate-pulse">
                <div className="flex gap-2">
                  <div className="h-5 w-32 bg-elevated rounded" />
                  <div className="h-5 w-16 bg-elevated rounded" />
                </div>
                <div className="h-3 w-24 bg-elevated rounded" />
                <div className="h-3 w-full bg-elevated rounded" />
                <div className="h-3 w-4/5 bg-elevated rounded" />
                <div className="h-16 w-full bg-elevated rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results state */}
      {pageState === "results" && activeCards.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg bg-info/10 border border-info/30 px-4 py-2.5 text-xs text-info">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            These are AI-generated archetypes — verify details before reaching out
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card, i) => {
              if (card.approved || card.dismissed) return null;
              const { lead } = card;
              return (
                <div key={i} className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
                  {card.dupWarning && (
                    <div className="px-4 py-2 bg-warning/10 border-b border-warning/30 text-xs text-warning flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {card.dupWarning}
                    </div>
                  )}
                  <div className="p-5 flex flex-col gap-3 flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-text-primary text-sm">{lead.name}</p>
                        <p className="text-xs text-text-muted">{lead.handle} · {lead.company}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLATFORM_COLOURS[lead.platform] ?? "bg-surface text-text-muted"}`}>
                          {PLATFORM_LABELS[lead.platform] ?? lead.platform}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${fitScoreClass(lead.fit_score)}`}>
                          {lead.fit_score}/10
                        </span>
                      </div>
                    </div>
                    {/* Meta */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs bg-elevated text-text-secondary px-2 py-0.5 rounded-full">{lead.niche}</span>
                      <span className="text-xs text-text-muted">{lead.audience_size}</span>
                    </div>
                    {/* Reason */}
                    <p className="text-xs text-text-muted leading-relaxed">{lead.reason}</p>
                    {/* Editable opener */}
                    <div className="flex-1">
                      <label className="text-xs font-medium text-text-secondary mb-1 block">Outreach opener (edit before approving)</label>
                      <textarea
                        value={card.opener}
                        onChange={e => updateOpener(i, e.target.value)}
                        rows={3}
                        className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-xs text-text-primary resize-none focus:outline-none focus:border-primary/50 transition-colors"
                      />
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleApprove(i)}
                        disabled={card.approving}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-white py-2 rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                      >
                        {card.approving ? (
                          <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        {card.approving ? "Importing…" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleDismiss(i)}
                        disabled={card.approving}
                        className="px-4 py-2 rounded-lg text-xs font-medium text-text-muted border border-border hover:border-primary/40 hover:text-text-primary disabled:opacity-50 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Completion state */}
      {pageState === "completion" && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center text-center gap-4 max-w-md mx-auto">
            {importedCount > 0 ? (
              <>
                <div className="w-12 h-12 rounded-full bg-success/15 flex items-center justify-center">
                  <Check className="w-6 h-6 text-success" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-text-primary">{importedCount} lead{importedCount !== 1 ? "s" : ""} imported</p>
                  {dismissedCount > 0 && <p className="text-sm text-text-muted">{dismissedCount} dismissed</p>}
                </div>
                <button
                  onClick={() => router.push("/dashboard/leads")}
                  className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  View in Leads
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-text-primary">Nothing imported</p>
                <p className="text-sm text-text-muted">Try a different brand or adjust your content pillars for better suggestions.</p>
              </>
            )}
            <button onClick={handleFindMore} className="text-sm text-text-muted hover:text-text-primary transition-colors underline underline-offset-2">
              Find more leads
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "discover"
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```powershell
git add frontend/app/dashboard/leads/discover/page.tsx
git commit -m "feat: add lead discovery inbox page with 4 UI states and sessionStorage persistence"
```

---

### Task 6: Add "Find Leads" button to Leads page

**Files:**
- Modify: `frontend/app/dashboard/leads/page.tsx`

- [ ] **Step 1: Read the current header section**

Open `frontend/app/dashboard/leads/page.tsx` and find this block (around line 51-61):
```tsx
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <button onClick={() => setSlideOver({ contactId: null, mode: "create" })} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Add Contact
          </button>
        </div>
```

- [ ] **Step 2: Add the import for Link at the top of the file**

Add to the imports at the top of `frontend/app/dashboard/leads/page.tsx`:
```tsx
import Link from "next/link";
```

- [ ] **Step 3: Add the "Find Leads" button before "Add Contact"**

Replace the button block with:
```tsx
        <div className="flex items-center gap-3">
          <div className="relative">
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="appearance-none bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text pr-7">
              <option value="">All brands</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted text-xs">&#9660;</span>
          </div>
          <Link href="/dashboard/leads/discover" className="border border-primary text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/10 transition-colors">
            Find Leads
          </Link>
          <button onClick={() => setSlideOver({ contactId: null, mode: "create" })} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            Add Contact
          </button>
        </div>
```

- [ ] **Step 4: Check TypeScript**

```powershell
npx tsc --noEmit 2>&1 | Select-String "leads"
```

Expected: no output.

- [ ] **Step 5: Commit**

```powershell
git add frontend/app/dashboard/leads/page.tsx
git commit -m "feat: add Find Leads button linking to discovery inbox"
```

---

### Task 7: End-to-end smoke test

- [ ] **Step 1: Ensure backend is running**

```powershell
cd backend
uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 2: Ensure frontend is running**

In a second terminal:
```powershell
cd frontend
npm run dev
```

- [ ] **Step 3: Test the full flow**

1. Open `http://localhost:3000/dashboard/leads`
2. Verify "Find Leads" button appears next to "Add Contact"
3. Click "Find Leads" — lands on `/dashboard/leads/discover`
4. Select a brand from the dropdown
5. Click "Find Leads" button
6. Verify loading skeleton appears briefly
7. Verify 10-15 lead cards render with name, platform badge, fit score, reason, editable opener
8. Edit one opener text
9. Click "Approve" on one card — verify it disappears and a contact appears in `/dashboard/leads`
10. Click "Dismiss" on another card — verify it disappears
11. Refresh the page — verify remaining cards are restored from sessionStorage
12. Action all remaining cards — verify completion state shows correct import count

- [ ] **Step 4: Test error state**

Temporarily set `ANTHROPIC_API_KEY=""` in `.env`, restart backend, try discovery — verify dev fallback mock card appears (not an error).

- [ ] **Step 5: Final commit**

```powershell
git add -A
git commit -m "feat: lead generation — AI discovery, review inbox, CRM import complete"
```
