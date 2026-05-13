"""Brand CRUD and AI voice interview endpoints."""
import logging
from datetime import datetime, timezone
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query, status

logger = logging.getLogger(__name__)

from app.database import get_supabase
from app.schemas.brands import (
    AnalyseSourcesRequest,
    AnalyseSourcesResponse,
    BrandCreate,
    BrandDetail,
    BrandUpdate,
    GenerateVoiceConfigRequest,
)
from app.security import current_user
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
from app.services.url_scraper import analyse_sources

router = APIRouter(prefix="/brands", tags=["brands"])

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


# ── Interview questions ────────────────────────────────────────────────────────

@router.get("/interview-questions")
async def get_interview_questions(_: Annotated[dict, Depends(current_user)]):
    """Return the structured interview questions for brand voice creation."""
    return {"questions": INTERVIEW_QUESTIONS}


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


# ── Analyse sources ───────────────────────────────────────────────────────────

@router.post("/{brand_id}/analyse-sources", response_model=AnalyseSourcesResponse)
async def analyse_brand_sources(
    brand_id: str,
    body: AnalyseSourcesRequest,
    user: Annotated[dict, Depends(current_user)],
):
    """Scrape URLs and/or accept pasted text; return per-source structured results."""
    if user["role"] not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    brand = get_brand(brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    if not body.urls and not body.pasted_texts:
        raise HTTPException(status_code=422, detail="Provide at least one URL or pasted text")

    sources = await analyse_sources(
        [str(u) for u in body.urls],
        body.pasted_texts,
    )

    valid_sources = [s for s in sources if s.text.strip()]
    if not valid_sources:
        raise HTTPException(status_code=422, detail="Could not extract content from any source")

    combined = "\n\n---\n\n".join(
        f"[Source: {s.source_label}]\n{s.text}" for s in valid_sources
    )

    try:
        sb = get_supabase()
        sb.table("audit_log").insert({
            "user_id": user["sub"],
            "action": "brand_voice_analyse",
            "detail": f"Analysed {len(sources)} sources for brand {brand_id}",
        }).execute()
    except Exception as exc:
        logger.warning("audit_log insert failed: %s", exc)

    return AnalyseSourcesResponse(
        sources=sources,
        combined_text=combined,
        total_chars=sum(s.char_count for s in valid_sources),
        has_warnings=any(s.warning for s in valid_sources),
    )


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
    if "content_pillars" in updates and isinstance(updates["content_pillars"], list):
        updates["content_pillars"] = [p.model_dump() if hasattr(p, "model_dump") else p for p in updates["content_pillars"]]
    if "hashtag_sets" in updates and isinstance(updates["hashtag_sets"], list):
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
