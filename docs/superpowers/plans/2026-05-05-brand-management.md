# Brand Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full Brand Management — Supabase tables, backend CRUD + AI voice interview, and frontend Brands page with create/edit/archive flows.

**Architecture:** Backend adds a `brands` router with full CRUD; the existing static `brand_loader.py` is replaced by Supabase-backed queries. The AI interview runs as a streaming multi-turn conversation using the Anthropic SDK. Frontend adds `/dashboard/brands` with a list page, detail/edit page, and a multi-step create wizard (interview → sample posts → config preview). Brand logo upload goes to Supabase Storage.

**Tech Stack:** FastAPI, Supabase (PostgreSQL + Storage), Anthropic Claude API (`claude-sonnet-4-6`), Next.js 16, React 19, Tailwind CSS v4, Zustand, Axios, Vitest + RTL

---

## Existing Code to Read Before Implementing

- `backend/app/routers/brands.py` — current static loader (will be replaced)
- `backend/app/services/brand_loader.py` — static JSON loader (will be superseded)
- `backend/app/services/anthropic_service.py` — AI generation service (re-use pattern)
- `backend/app/security.py` — `current_user`, `require_role` dependencies
- `backend/app/database.py` — `get_supabase()`
- `frontend/lib/api.ts` — axios instance + existing brand endpoints (will be extended)
- `frontend/components/ui/` — Button, Input, Textarea, Label, Card, Dialog, Select, Badge, Avatar, Skeleton
- `frontend/components/layout/` — PageHeader, EmptyState, LoadingScreen
- `frontend/store/auth.ts` — `useAuthStore`, `User` type

---

## File Map

**Backend — Create:**
- `backend/app/schemas/brands.py` — Pydantic models: BrandCreate, BrandUpdate, BrandPublic, BrandDetail, InterviewAnswers, VoiceConfigOut
- `backend/app/routers/brands.py` — **replace** existing file; full CRUD + AI interview endpoint
- `backend/app/services/brand_service.py` — DB operations: create, get, list, update, archive, restore, logo upload

**Backend — Modify:**
- `backend/app/main.py` — no change needed (brands router already registered)

**Supabase SQL (run in dashboard):**
- `brands` table with all fields
- `user_brands` join table (user ↔ brand assignment)
- Supabase Storage bucket `brand-logos`

**Frontend — Create:**
- `frontend/app/dashboard/brands/page.tsx` — brands list (grid of brand cards, Add Brand button)
- `frontend/app/dashboard/brands/new/page.tsx` — multi-step wizard: interview → sample posts → preview → save
- `frontend/app/dashboard/brands/[id]/page.tsx` — brand detail: view + edit inline, archive/restore

**Frontend — Modify:**
- `frontend/lib/api.ts` — add brand CRUD + interview endpoints
- `frontend/app/dashboard/page.tsx` — update getBrands call to use new API response shape

---

## Task 1: Supabase schema — brands + user_brands tables + storage bucket

**Files:** SQL only — run in Supabase dashboard SQL editor

- [ ] **Step 1: Open Supabase SQL editor**

Go to your Supabase project → SQL Editor → New query.

- [ ] **Step 2: Run brands table migration**

```sql
CREATE TABLE IF NOT EXISTS brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  industry VARCHAR(80),
  logo_url TEXT,
  brand_colour VARCHAR(7) DEFAULT '#6366f1',
  default_timezone VARCHAR(50) DEFAULT 'Asia/Singapore',
  content_pillars JSONB DEFAULT '[]'::jsonb,
  hashtag_sets JSONB DEFAULT '{}'::jsonb,
  voice_config JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'active' NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS brands_status_idx ON brands (status);
```

Expected: "Success. No rows returned"

- [ ] **Step 3: Run user_brands join table migration**

```sql
CREATE TABLE IF NOT EXISTS user_brands (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS ub_brand_idx ON user_brands (brand_id);
CREATE INDEX IF NOT EXISTS ub_user_idx ON user_brands (user_id);
```

Expected: "Success. No rows returned"

- [ ] **Step 4: Create brand-logos Storage bucket**

Go to Supabase → Storage → New bucket.
- Name: `brand-logos`
- Public bucket: **Yes** (logos are publicly viewable)
- Click Create.

- [ ] **Step 5: Verify in Supabase Table Editor**

Navigate to Table Editor and confirm:
- `brands` table exists with 12 columns
- `user_brands` table exists with 3 columns
- Storage → `brand-logos` bucket is listed

---

## Task 2: Backend — brand schemas

**Files:**
- Create: `backend/app/schemas/brands.py`

- [ ] **Step 1: Create `backend/app/schemas/brands.py`**

```python
"""Pydantic schemas for brand endpoints."""
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field


class ContentPillar(BaseModel):
    name: str
    description: str = ""


class HashtagSet(BaseModel):
    platform: str
    tags: list[str]


class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(default="", max_length=80)
    brand_colour: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
    default_timezone: str = Field(default="Asia/Singapore", max_length=50)
    content_pillars: list[ContentPillar] = []
    hashtag_sets: list[HashtagSet] = []


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    industry: Optional[str] = Field(default=None, max_length=80)
    brand_colour: Optional[str] = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    default_timezone: Optional[str] = Field(default=None, max_length=50)
    content_pillars: Optional[list[ContentPillar]] = None
    hashtag_sets: Optional[list[HashtagSet]] = None
    voice_config: Optional[dict[str, Any]] = None


class BrandPublic(BaseModel):
    id: str
    name: str
    industry: str = ""
    logo_url: Optional[str] = None
    brand_colour: str = "#6366f1"
    default_timezone: str = "Asia/Singapore"
    status: Literal["active", "archived"] = "active"


class BrandDetail(BrandPublic):
    content_pillars: list[dict[str, Any]] = []
    hashtag_sets: list[dict[str, Any]] = []
    voice_config: dict[str, Any] = {}
    created_at: str
    updated_at: str


class InterviewAnswer(BaseModel):
    question_index: int
    question: str
    answer: str


class GenerateVoiceConfigRequest(BaseModel):
    brand_name: str
    industry: str
    interview_answers: list[InterviewAnswer]
    sample_posts: list[str] = []


class VoiceConfigOut(BaseModel):
    tone_descriptors: list[str]
    content_pillars: list[ContentPillar]
    platform_rules: dict[str, str]
    word_bank: list[str]
    avoid: list[str]
    sample_prompts: list[str]
```

- [ ] **Step 2: Verify no syntax errors**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -c "from app.schemas.brands import BrandCreate, BrandDetail, GenerateVoiceConfigRequest; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add backend/app/schemas/brands.py && git commit -m "feat: add brand Pydantic schemas"
```

---

## Task 3: Backend — brand service (DB operations)

**Files:**
- Create: `backend/app/services/brand_service.py`

- [ ] **Step 1: Create `backend/app/services/brand_service.py`**

```python
"""Brand database operations."""
from datetime import datetime, timezone
from typing import Optional
from app.database import get_supabase


def list_brands_for_user(user_id: str, role: str) -> list[dict]:
    """Return brands the user can see. Super Admin/Admin see all active brands."""
    sb = get_supabase()
    if role in ("super_admin", "admin"):
        res = sb.table("brands").select("id, name, industry, logo_url, brand_colour, default_timezone, status").eq("status", "active").execute()
    else:
        # Regular users see only assigned brands
        assignment_res = sb.table("user_brands").select("brand_id").eq("user_id", user_id).execute()
        brand_ids = [r["brand_id"] for r in (assignment_res.data or [])]
        if not brand_ids:
            return []
        res = sb.table("brands").select("id, name, industry, logo_url, brand_colour, default_timezone, status").in_("id", brand_ids).eq("status", "active").execute()
    return res.data or []


def list_all_brands(include_archived: bool = False) -> list[dict]:
    """Super Admin view — all brands, optionally including archived."""
    sb = get_supabase()
    query = sb.table("brands").select("id, name, industry, logo_url, brand_colour, default_timezone, status, created_at")
    if not include_archived:
        query = query.eq("status", "active")
    return query.execute().data or []


def get_brand(brand_id: str) -> Optional[dict]:
    """Get full brand record by ID."""
    sb = get_supabase()
    res = sb.table("brands").select("*").eq("id", brand_id).limit(1).execute()
    return res.data[0] if res.data else None


def create_brand(data: dict, created_by: str) -> dict:
    """Insert a new brand and return the created record."""
    sb = get_supabase()
    payload = {**data, "created_by": created_by, "status": "active"}
    # Serialize nested objects to plain dicts for Supabase JSONB
    for key in ("content_pillars", "hashtag_sets", "voice_config"):
        if key in payload and payload[key] and hasattr(payload[key][0] if isinstance(payload[key], list) else payload[key], "model_dump"):
            if isinstance(payload[key], list):
                payload[key] = [item.model_dump() if hasattr(item, "model_dump") else item for item in payload[key]]
    res = sb.table("brands").insert(payload).execute()
    if not res.data:
        raise RuntimeError("Failed to create brand")
    return res.data[0]


def update_brand(brand_id: str, updates: dict) -> dict:
    """Update brand fields and refresh updated_at."""
    sb = get_supabase()
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Serialize nested objects
    for key in ("content_pillars", "hashtag_sets", "voice_config"):
        if key in updates and updates[key] is not None and isinstance(updates[key], list):
            updates[key] = [item.model_dump() if hasattr(item, "model_dump") else item for item in updates[key]]
    res = sb.table("brands").update(updates).eq("id", brand_id).execute()
    if not res.data:
        raise RuntimeError("Failed to update brand")
    return res.data[0]


def archive_brand(brand_id: str) -> dict:
    return update_brand(brand_id, {"status": "archived"})


def restore_brand(brand_id: str) -> dict:
    return update_brand(brand_id, {"status": "active"})


def assign_user_to_brand(user_id: str, brand_id: str) -> None:
    sb = get_supabase()
    sb.table("user_brands").upsert({"user_id": user_id, "brand_id": brand_id}).execute()


def remove_user_from_brand(user_id: str, brand_id: str) -> None:
    sb = get_supabase()
    sb.table("user_brands").delete().eq("user_id", user_id).eq("brand_id", brand_id).execute()
```

- [ ] **Step 2: Verify import**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -c "from app.services.brand_service import list_brands_for_user, create_brand; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add backend/app/services/brand_service.py && git commit -m "feat: add brand service (Supabase CRUD operations)"
```

---

## Task 4: Backend — AI voice config generation service

**Files:**
- Modify: `backend/app/services/anthropic_service.py` (add `generate_voice_config` function)

- [ ] **Step 1: Read the current anthropic_service.py**

```bash
cat /c/Users/Kevin\ Chng/Documents/BuildLab33/backend/app/services/anthropic_service.py
```

- [ ] **Step 2: Add `generate_voice_config` to the file**

Append this function to the bottom of `backend/app/services/anthropic_service.py`:

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
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    qa_block = "\n".join(
        f"Q{i+1}: {a['question']}\nA: {a['answer']}" for i, a in enumerate(interview_answers)
    )
    samples_block = "\n\n---\n\n".join(sample_posts) if sample_posts else "No sample posts provided."

    prompt = f"""You are a brand strategist. Based on the interview answers and sample posts below, generate a structured brand voice configuration for {brand_name} ({industry}).

## Interview Answers
{qa_block}

## Sample Posts
{samples_block}

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

    message = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )
    import json
    text = message.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())
```

- [ ] **Step 3: Verify import**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -c "from app.services.anthropic_service import generate_voice_config; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add backend/app/services/anthropic_service.py && git commit -m "feat: add generate_voice_config to anthropic service"
```

---

## Task 5: Backend — replace brands router with full CRUD

**Files:**
- Replace: `backend/app/routers/brands.py`

- [ ] **Step 1: Read the current brands router**

```bash
cat /c/Users/Kevin\ Chng/Documents/BuildLab33/backend/app/routers/brands.py
```

- [ ] **Step 2: Replace `backend/app/routers/brands.py` entirely**

```python
"""Brand CRUD and AI voice interview endpoints."""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.database import get_supabase
from app.schemas.brands import (
    BrandCreate,
    BrandDetail,
    BrandPublic,
    BrandUpdate,
    GenerateVoiceConfigRequest,
    VoiceConfigOut,
)
from app.security import current_user, require_role
from app.services.brand_service import (
    archive_brand,
    assign_user_to_brand,
    create_brand,
    get_brand,
    list_brands_for_user,
    list_all_brands,
    remove_user_from_brand,
    restore_brand,
    update_brand,
)
from app.services.anthropic_service import generate_voice_config

router = APIRouter(prefix="/brands", tags=["brands"])

INTERVIEW_QUESTIONS = [
    "What is the primary mission or purpose of this brand?",
    "What industry or sector does this brand operate in?",
    "Who is the ideal customer or target audience for this brand?",
    "What are the top 3 problems this brand solves for its customers?",
    "How would you describe the brand's personality in 3–5 words?",
    "What tone should content use — formal, conversational, inspirational, authoritative, or playful?",
    "What topics or themes should content focus on (content pillars)?",
    "Which social media platforms are most important for this brand?",
    "What are the brand's key differentiators from competitors?",
    "Who are the brand's main competitors, and what should we do differently?",
    "What words, phrases, or topics should the brand NEVER use?",
    "Does the brand use industry jargon or prefer plain language?",
    "What emotional response should the brand evoke in its audience?",
    "What is the brand's stance on thought leadership — do they share opinions or stay neutral?",
    "Describe the ideal customer profile: job title, company size, industry, pain points.",
    "What is the brand's geographic focus — local, regional, or global?",
    "How formal or casual should the language be on a scale of 1–10?",
    "What objections do prospects typically have, and how does the brand address them?",
    "What does success look like for this brand's content — engagement, leads, awareness?",
    "Are there cultural sensitivities or regional considerations to keep in mind?",
    "Does the brand have seasonal campaigns or recurring content themes?",
    "What are 3 examples of brands (inside or outside the industry) whose content style you admire?",
]


# ── Interview questions ────────────────────────────────────────────────────────

@router.get("/interview-questions")
async def get_interview_questions(_: Annotated[dict, Depends(current_user)]):
    """Return the list of AI interview questions for brand voice creation."""
    return {
        "questions": [
            {"index": i, "question": q} for i, q in enumerate(INTERVIEW_QUESTIONS)
        ]
    }


# ── Generate voice config ──────────────────────────────────────────────────────

@router.post("/generate-voice-config")
async def generate_voice_config_endpoint(
    body: GenerateVoiceConfigRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Run AI synthesis on interview answers + sample posts to produce a voice config."""
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can create brands")
    try:
        config = await generate_voice_config(
            brand_name=body.brand_name,
            industry=body.industry,
            interview_answers=[a.model_dump() for a in body.interview_answers],
            sample_posts=body.sample_posts,
        )
        return config
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice config generation failed: {str(e)}")


# ── List brands ────────────────────────────────────────────────────────────────

@router.get("")
async def get_brands(
    user: Annotated[dict, Depends(current_user)],
    include_archived: bool = Query(default=False),
):
    """List brands the current user can access."""
    if user["role"] in ("super_admin", "admin") and include_archived:
        brands = list_all_brands(include_archived=True)
    else:
        brands = list_brands_for_user(user["sub"], user["role"])
    return {"brands": brands}


# ── Get single brand ───────────────────────────────────────────────────────────

@router.get("/{brand_id}", response_model=BrandDetail)
async def get_brand_detail(
    brand_id: str,
    user: Annotated[dict, Depends(current_user)],
):
    brand = get_brand(brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    # Check access: non-admin users must be assigned to this brand
    if user["role"] not in ("super_admin", "admin"):
        sb = get_supabase()
        res = sb.table("user_brands").select("brand_id").eq("user_id", user["sub"]).eq("brand_id", brand_id).execute()
        if not res.data:
            raise HTTPException(status_code=403, detail="Access denied")
    return BrandDetail(**brand)


# ── Create brand ───────────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_brand_endpoint(
    body: BrandCreate,
    user: Annotated[dict, Depends(current_user)],
):
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can create brands")
    payload = body.model_dump()
    # Flatten content_pillars and hashtag_sets to plain dicts
    payload["content_pillars"] = [p.model_dump() for p in body.content_pillars]
    payload["hashtag_sets"] = [h.model_dump() for h in body.hashtag_sets]
    brand = create_brand(payload, created_by=user["sub"])
    try:
        sb = get_supabase()
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "brand_created",
            "detail": f"Brand created: {body.name}",
        }).execute()
    except Exception:
        pass
    return brand


# ── Update brand ───────────────────────────────────────────────────────────────

@router.patch("/{brand_id}")
async def update_brand_endpoint(
    brand_id: str,
    body: BrandUpdate,
    user: Annotated[dict, Depends(current_user)],
):
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can edit brands")
    if not get_brand(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "content_pillars" in updates and updates["content_pillars"] is not None:
        updates["content_pillars"] = [p.model_dump() if hasattr(p, "model_dump") else p for p in updates["content_pillars"]]
    if "hashtag_sets" in updates and updates["hashtag_sets"] is not None:
        updates["hashtag_sets"] = [h.model_dump() if hasattr(h, "model_dump") else h for h in updates["hashtag_sets"]]
    brand = update_brand(brand_id, updates)
    try:
        sb = get_supabase()
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "brand_updated",
            "detail": f"Brand updated: {brand_id}",
        }).execute()
    except Exception:
        pass
    return brand


# ── Archive / Restore ──────────────────────────────────────────────────────────

@router.post("/{brand_id}/archive")
async def archive_brand_endpoint(
    brand_id: str,
    user: Annotated[dict, Depends(current_user)],
):
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can archive brands")
    if not get_brand(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    brand = archive_brand(brand_id)
    try:
        sb = get_supabase()
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "brand_archived",
            "detail": f"Brand archived: {brand_id}",
        }).execute()
    except Exception:
        pass
    return brand


@router.post("/{brand_id}/restore")
async def restore_brand_endpoint(
    brand_id: str,
    user: Annotated[dict, Depends(current_user)],
):
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can restore brands")
    if not get_brand(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    brand = restore_brand(brand_id)
    try:
        sb = get_supabase()
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "brand_restored",
            "detail": f"Brand restored: {brand_id}",
        }).execute()
    except Exception:
        pass
    return brand


# ── User assignment ────────────────────────────────────────────────────────────

@router.post("/{brand_id}/assign/{user_id_param}")
async def assign_user(
    brand_id: str,
    user_id_param: str,
    user: Annotated[dict, Depends(current_user)],
):
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can assign users")
    if not get_brand(brand_id):
        raise HTTPException(status_code=404, detail="Brand not found")
    assign_user_to_brand(user_id_param, brand_id)
    return {"message": "User assigned to brand"}


@router.delete("/{brand_id}/assign/{user_id_param}")
async def unassign_user(
    brand_id: str,
    user_id_param: str,
    user: Annotated[dict, Depends(current_user)],
):
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Only Admin and above can unassign users")
    remove_user_from_brand(user_id_param, brand_id)
    return {"message": "User unassigned from brand"}
```

- [ ] **Step 3: Verify backend imports cleanly**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -c "from app.routers.brands import router; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Run all backend tests**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -m pytest tests/ -v 2>&1 | tail -15
```

Expected: 11 tests passing

- [ ] **Step 5: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add backend/app/routers/brands.py && git commit -m "feat: replace brands router with full CRUD, AI interview, archive/restore, user assignment"
```

---

## Task 6: Frontend — add brand API endpoints

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Read the current api.ts to find the brands section**

```bash
grep -n "brands\|getBrand" /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend/lib/api.ts
```

- [ ] **Step 2: Replace the Brands section in `frontend/lib/api.ts`**

Find the existing brands section (currently just `getBrands` and `getBrand`) and replace it with:

```typescript
// ── Brands ────────────────────────────────────────────────────────────────

export interface BrandPublic {
  id: string;
  name: string;
  industry: string;
  logo_url: string | null;
  brand_colour: string;
  default_timezone: string;
  status: "active" | "archived";
}

export interface BrandDetail extends BrandPublic {
  content_pillars: Array<{ name: string; description: string }>;
  hashtag_sets: Array<{ platform: string; tags: string[] }>;
  voice_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InterviewAnswer {
  question_index: number;
  question: string;
  answer: string;
}

export const getBrands = (includeArchived = false) =>
  api.get("/api/brands", { params: { include_archived: includeArchived } });

export const getBrand = (id: string) => api.get<BrandDetail>(`/api/brands/${id}`);

export const createBrand = (data: {
  name: string;
  industry: string;
  brand_colour: string;
  default_timezone: string;
  content_pillars: Array<{ name: string; description: string }>;
  hashtag_sets: Array<{ platform: string; tags: string[] }>;
}) => api.post("/api/brands", data);

export const updateBrand = (id: string, data: Partial<BrandDetail>) =>
  api.patch(`/api/brands/${id}`, data);

export const archiveBrand = (id: string) => api.post(`/api/brands/${id}/archive`);
export const restoreBrand = (id: string) => api.post(`/api/brands/${id}/restore`);

export const getInterviewQuestions = () => api.get("/api/brands/interview-questions");

export const generateVoiceConfig = (data: {
  brand_name: string;
  industry: string;
  interview_answers: InterviewAnswer[];
  sample_posts: string[];
}) => api.post("/api/brands/generate-voice-config", data);
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Fix any errors.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add frontend/lib/api.ts && git commit -m "feat: add brand CRUD and interview API functions to api.ts"
```

---

## Task 7: Frontend — brands list page

**Files:**
- Create: `frontend/app/dashboard/brands/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend/app/dashboard/brands
```

- [ ] **Step 2: Create `frontend/app/dashboard/brands/page.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrands, archiveBrand, restoreBrand, type BrandPublic } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { Building2, Plus, Archive, RotateCcw, Settings } from "lucide-react";

export default function BrandsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [brands, setBrands] = useState<BrandPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await getBrands(showArchived);
      setBrands(res.data?.brands || []);
    } catch {
      toast.error("Failed to load brands");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, [showArchived]);

  const handleArchive = async (id: string, name: string) => {
    setArchiving(id);
    try {
      await archiveBrand(id);
      toast.success(`${name} archived`);
      fetchBrands();
    } catch {
      toast.error("Failed to archive brand");
    } finally {
      setArchiving(null);
    }
  };

  const handleRestore = async (id: string, name: string) => {
    setArchiving(id);
    try {
      await restoreBrand(id);
      toast.success(`${name} restored`);
      fetchBrands();
    } catch {
      toast.error("Failed to restore brand");
    } finally {
      setArchiving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Manage your brand profiles and voice configurations"
        action={
          isAdmin ? (
            <Button onClick={() => router.push("/dashboard/brands/new")}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Brand
            </Button>
          ) : undefined
        }
      />

      {isAdmin && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`text-xs flex items-center gap-1.5 transition-colors ${showArchived ? "text-text-active" : "text-text-muted hover:text-text-secondary"}`}
          >
            <Archive className="w-3.5 h-3.5" />
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : brands.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-8 h-8" />}
          title="No brands yet"
          description={isAdmin ? "Create your first brand to start generating content." : "You haven't been assigned to any brands yet."}
          action={isAdmin ? <Button onClick={() => router.push("/dashboard/brands/new")}>Add Brand</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {brands.map((brand) => (
            <Card
              key={brand.id}
              clickable={brand.status === "active"}
              onClick={brand.status === "active" ? () => router.push(`/dashboard/brands/${brand.id}`) : undefined}
              className={brand.status === "archived" ? "opacity-60" : ""}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {brand.logo_url ? (
                      <img src={brand.logo_url} alt={brand.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base"
                        style={{ backgroundColor: brand.brand_colour }}
                      >
                        {brand.name[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-text-primary text-sm">{brand.name}</div>
                      <div className="text-xs text-text-muted">{brand.industry || "—"}</div>
                    </div>
                  </div>
                  {brand.status === "archived" && (
                    <Badge variant="outline" className="text-xs">Archived</Badge>
                  )}
                </div>

                <div className="text-xs text-text-muted mb-4">{brand.default_timezone}</div>

                <div className="flex gap-2">
                  {brand.status === "active" ? (
                    <>
                      <Button
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/brands/${brand.id}`); }}
                      >
                        <Settings className="w-3.5 h-3.5 mr-1" />
                        Manage
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          disabled={archiving === brand.id}
                          onClick={(e) => { e.stopPropagation(); handleArchive(brand.id, brand.name); }}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 text-xs"
                        disabled={archiving === brand.id}
                        onClick={(e) => { e.stopPropagation(); handleRestore(brand.id, brand.name); }}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Restore
                      </Button>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Fix any errors.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add frontend/app/dashboard/brands/page.tsx && git commit -m "feat: add brands list page with archive/restore"
```

---

## Task 8: Frontend — brand create wizard (step 1: basic info + interview)

**Files:**
- Create: `frontend/app/dashboard/brands/new/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend/app/dashboard/brands/new
```

- [ ] **Step 2: Create `frontend/app/dashboard/brands/new/page.tsx`**

```typescript
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
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Tokyo",
  "Asia/Hong_Kong",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "UTC",
];

export default function NewBrandPage() {
  const router = useRouter();

  // Step tracking
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

  // Load questions when entering interview step
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
      });
      // Update voice config via PATCH after creation is not needed — createBrand doesn't accept voice_config yet.
      // The voice_config will be set on the detail page or we can extend createBrand payload.
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
              <div className="flex items-center gap-3">
                <input type="color" id="colour" value={brandColour} onChange={(e) => setBrandColour(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent" />
                <Input value={brandColour} onChange={(e) => setBrandColour(e.target.value)} placeholder="#6366f1" className="font-mono w-32" />
                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: brandColour }} />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Default timezone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface text-text-primary text-sm px-3 py-2 focus:outline-none focus:border-border-active"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
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
        <PageHeader title="Brand Voice Interview" subtitle={`Step 2 of 4 — Question ${currentQ + 1} of ${questions.length} (answer at least 10)`} />

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
              <button onClick={() => setStep("samples")} disabled={!canProceedInterview} className="hover:text-text-secondary transition-colors disabled:opacity-40">Skip to sample posts →</button>
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

          <Button
            className="w-full"
            disabled={generatingConfig}
            onClick={handleGenerateConfig}
          >
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
                    <li key={p.name} className="text-xs text-text-secondary"><span className="font-medium text-text-primary">{p.name}</span> — {p.description}</li>
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
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Fix any errors.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add frontend/app/dashboard/brands/new/page.tsx && git commit -m "feat: add brand creation wizard — basic info, AI interview, sample posts, voice config preview"
```

---

## Task 9: Frontend — brand detail + edit page

**Files:**
- Create: `frontend/app/dashboard/brands/[id]/page.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p "/c/Users/Kevin Chng/Documents/BuildLab33/frontend/app/dashboard/brands/[id]"
```

- [ ] **Step 2: Create `frontend/app/dashboard/brands/[id]/page.tsx`**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBrand, updateBrand, archiveBrand, restoreBrand, type BrandDetail } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Save, Archive, RotateCcw, ChevronLeft, Plus, X } from "lucide-react";

export default function BrandDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  const [brand, setBrand] = useState<BrandDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brandColour, setBrandColour] = useState("#6366f1");
  const [timezone, setTimezone] = useState("Asia/Singapore");
  const [pillars, setPillars] = useState<Array<{ name: string; description: string }>>([]);
  const [newPillarName, setNewPillarName] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getBrand(id)
      .then((res) => {
        const b = res.data;
        setBrand(b);
        setName(b.name);
        setIndustry(b.industry || "");
        setBrandColour(b.brand_colour || "#6366f1");
        setTimezone(b.default_timezone || "Asia/Singapore");
        setPillars(b.content_pillars || []);
      })
      .catch(() => { toast.error("Failed to load brand"); router.push("/dashboard/brands"); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateBrand(id, {
        name,
        industry,
        brand_colour: brandColour,
        default_timezone: timezone,
        content_pillars: pillars,
      });
      toast.success("Brand saved");
    } catch {
      toast.error("Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!id || !brand) return;
    setArchiving(true);
    try {
      await archiveBrand(id);
      toast.success(`${brand.name} archived`);
      router.push("/dashboard/brands");
    } catch {
      toast.error("Failed to archive brand");
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (!id || !brand) return;
    setArchiving(true);
    try {
      await restoreBrand(id);
      toast.success(`${brand.name} restored`);
      router.push("/dashboard/brands");
    } catch {
      toast.error("Failed to restore brand");
    } finally {
      setArchiving(false);
    }
  };

  const addPillar = () => {
    if (!newPillarName.trim()) return;
    setPillars([...pillars, { name: newPillarName.trim(), description: "" }]);
    setNewPillarName("");
  };

  const removePillar = (index: number) => {
    setPillars(pillars.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!brand) return null;

  return (
    <div>
      <PageHeader
        title={brand.name}
        subtitle={brand.industry || "Brand settings"}
        action={
          isAdmin ? (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/brands")}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              {brand.status === "active" ? (
                <Button variant="danger" size="sm" disabled={archiving} onClick={handleArchive}>
                  <Archive className="w-4 h-4 mr-1" />
                  Archive
                </Button>
              ) : (
                <Button variant="ghost" size="sm" disabled={archiving} onClick={handleRestore}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restore
                </Button>
              )}
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard/brands")}>
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          )
        }
      />

      {brand.status === "archived" && (
        <div className="mb-4 px-4 py-2 bg-elevated border border-warning/30 rounded-lg text-xs text-warning">
          This brand is archived. Restore it to use it in content generation.
        </div>
      )}

      <div className="space-y-4 max-w-lg">
        {/* Basic Info */}
        <Card>
          <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Brand name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
            </div>
            <div>
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} disabled={!isAdmin} />
            </div>
            <div>
              <Label htmlFor="colour">Brand colour</Label>
              <div className="flex items-center gap-3">
                <input type="color" id="colour" value={brandColour} onChange={(e) => setBrandColour(e.target.value)} disabled={!isAdmin} className="w-10 h-10 rounded-lg cursor-pointer border border-border bg-transparent disabled:opacity-50 disabled:cursor-not-allowed" />
                <Input value={brandColour} onChange={(e) => setBrandColour(e.target.value)} disabled={!isAdmin} className="font-mono w-32" />
                <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: brandColour }} />
              </div>
            </div>
            <div>
              <Label htmlFor="timezone">Default timezone</Label>
              <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} disabled={!isAdmin} />
            </div>
          </CardContent>
        </Card>

        {/* Content Pillars */}
        <Card>
          <CardHeader><CardTitle>Content Pillars</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {pillars.length === 0 && <p className="text-xs text-text-muted">No content pillars defined.</p>}
            {pillars.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <Badge variant="outline" className="flex-1 justify-start text-xs font-normal py-1.5 px-3">
                  {p.name}
                </Badge>
                {isAdmin && (
                  <button onClick={() => removePillar(i)} className="text-text-muted hover:text-error transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {isAdmin && (
              <div className="flex gap-2 mt-2">
                <Input
                  value={newPillarName}
                  onChange={(e) => setNewPillarName(e.target.value)}
                  placeholder="Add a content pillar..."
                  onKeyDown={(e) => e.key === "Enter" && addPillar()}
                />
                <Button size="sm" variant="ghost" onClick={addPillar}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Config (read-only preview) */}
        {brand.voice_config && Object.keys(brand.voice_config).length > 0 && (
          <Card>
            <CardHeader><CardTitle>Brand Voice Config</CardTitle></CardHeader>
            <CardContent>
              {Array.isArray((brand.voice_config as Record<string, unknown>).tone_descriptors) && (
                <div className="mb-3">
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
                  <p className="text-xs text-error">{((brand.voice_config as Record<string, unknown>).avoid as string[]).join(", ")}</p>
                </div>
              )}
              <p className="text-xs text-text-muted mt-3">Voice config is generated during brand creation and used automatically in content generation.</p>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Button className="w-full" disabled={saving} onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Fix any errors.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add "frontend/app/dashboard/brands/[id]/page.tsx" && git commit -m "feat: add brand detail/edit page with content pillars and voice config preview"
```

---

## Task 10: Fix createBrand to also save voice_config + update dashboard

**Files:**
- Modify: `backend/app/routers/brands.py` (extend BrandCreate to accept voice_config)
- Modify: `backend/app/schemas/brands.py` (add voice_config to BrandCreate)
- Modify: `frontend/app/dashboard/brands/new/page.tsx` (pass voice_config to createBrand)
- Modify: `frontend/lib/api.ts` (add voice_config to createBrand payload type)
- Modify: `frontend/app/dashboard/page.tsx` (update getBrands response shape)

- [ ] **Step 1: Add voice_config to BrandCreate schema**

In `backend/app/schemas/brands.py`, update `BrandCreate`:

```python
class BrandCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    industry: str = Field(default="", max_length=80)
    brand_colour: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")
    default_timezone: str = Field(default="Asia/Singapore", max_length=50)
    content_pillars: list[ContentPillar] = []
    hashtag_sets: list[HashtagSet] = []
    voice_config: dict[str, Any] = {}
```

- [ ] **Step 2: Update createBrand in `frontend/lib/api.ts`**

Update the `createBrand` function signature to accept voice_config:

```typescript
export const createBrand = (data: {
  name: string;
  industry: string;
  brand_colour: string;
  default_timezone: string;
  content_pillars: Array<{ name: string; description: string }>;
  hashtag_sets: Array<{ platform: string; tags: string[] }>;
  voice_config?: Record<string, unknown>;
}) => api.post("/api/brands", data);
```

- [ ] **Step 3: Pass voice_config in the wizard's handleSave**

In `frontend/app/dashboard/brands/new/page.tsx`, update `handleSave`:

```typescript
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
```

- [ ] **Step 4: Update dashboard page brand card to use new response shape**

In `frontend/app/dashboard/page.tsx`, the getBrands call currently does:
```typescript
getBrands().then((res) => setBrands(res.data?.brands || res.data || []))
```

Update to simply:
```typescript
getBrands().then((res) => setBrands(res.data?.brands || []))
```

Also update the Brand interface to match BrandPublic:
```typescript
interface Brand { id: string; name: string; industry: string; brand_colour?: string; logo_url?: string | null; }
```

And update the brand card to use `brand_colour` instead of hard-coded `bg-primary`:
```typescript
style={{ backgroundColor: brand.brand_colour || "#6366f1" }}
```

- [ ] **Step 5: Verify backend imports cleanly**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -c "from app.schemas.brands import BrandCreate; b = BrandCreate(name='Test', industry='Tech'); print(b.voice_config)"
```

Expected: `{}`

- [ ] **Step 6: TypeScript check**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend && npx tsc --noEmit 2>&1 | tail -15
```

Fix any errors.

- [ ] **Step 7: Run all backend tests**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/backend && python -m pytest tests/ -v 2>&1 | tail -10
```

Expected: 11 tests pass

- [ ] **Step 8: Run frontend build**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33/frontend && npm run build 2>&1 | tail -15
```

Expected: build succeeds

- [ ] **Step 9: Commit**

```bash
cd /c/Users/Kevin\ Chng/Documents/BuildLab33 && git add backend/app/schemas/brands.py backend/app/routers/brands.py frontend/lib/api.ts frontend/app/dashboard/brands/new/page.tsx frontend/app/dashboard/page.tsx && git commit -m "feat: wire voice_config into brand creation, update dashboard brand cards"
```

---

## Self-Review Against Spec (Section 6)

### Spec coverage check:

| Requirement | Covered By |
|---|---|
| AI voice interview (20+ questions) | Task 5 (INTERVIEW_QUESTIONS list = 22 questions), Task 8 (wizard interview step) |
| Questions one at a time with progress | Task 8 (currentQ state, question counter) |
| Sample post analysis (3-10 posts) | Task 8 (sample posts step, up to 10 fields) |
| AI generates voice config | Task 4 (generate_voice_config), Task 5 (/generate-voice-config endpoint), Task 8 (wizard preview step) |
| Voice config: tone, pillars, platform rules, word bank, avoid, sample prompts | Task 4 (generate_voice_config prompt + VoiceConfigOut schema) |
| Brand name, industry, logo, colour, timezone | Task 2 (BrandCreate), Task 8 (basic info step), Task 9 (edit page) |
| Content pillars (editable list) | Task 2 (BrandCreate.content_pillars), Task 9 (pillars editor) |
| Hashtag sets | Task 2 (BrandCreate.hashtag_sets schema — UI editing deferred, stored in DB) |
| Archive / Restore | Task 3 (archive_brand/restore_brand), Task 5 (endpoints), Task 7 (list page buttons), Task 9 (detail page buttons) |
| Audit log on every brand change | Task 5 (audit_log.insert on create/update/archive/restore) |
| Role-based access (Admin+ to create/edit) | Task 5 (role checks on all mutating endpoints), Task 7/8/9 (isAdmin conditional UI) |
| User-brand assignment (user_brands) | Task 1 (user_brands table), Task 3 (assign/remove functions), Task 5 (assign/unassign endpoints) |
| Active/Archived status | Task 1 (brands.status column), Task 3 (archive/restore), Task 7 (showArchived toggle) |

### Gaps noted and addressed:
- Logo upload: Supabase Storage bucket created (Task 1 Step 4), but actual file upload endpoint and UI are deferred — logo_url field stores the URL when uploaded. Not in spec's MVP critical path — the initials fallback covers it.
- Hashtag set editing UI: Schema and DB storage in place; full UI editor deferred to a follow-up task since it's not blocking content generation.
- Continuous improvement (few-shot from approved posts): Deferred to Post Approval Workflow subsystem (subsystem 4) where approved posts are available.
- "Regenerate" button in preview step calls setStep("samples") which re-renders sample step; user can click "Generate Brand Voice Config" again.

### Placeholder scan: None found.

### Type consistency:
- `BrandPublic` and `BrandDetail` defined in both `schemas/brands.py` and `frontend/lib/api.ts` — fields match.
- `InterviewAnswer` type matches between `GenerateVoiceConfigRequest.interview_answers` (backend) and `InterviewAnswer[]` (frontend).
- `content_pillars: Array<{ name: string; description: string }>` consistent across wizard → createBrand → backend → detail page.

---

*Plan written 2026-05-05. Implements Section 6 of the Phase 2 spec (Brand Management). Next plan: Post Approval Workflow (Section 7).*
