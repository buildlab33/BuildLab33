"""Anthropic Claude integration for content generation.

Builds a prompt from the brand config + structured user inputs and asks Claude
to draft a platform-appropriate post that respects the brand voice and off-limits.
"""
from typing import Any

from anthropic import Anthropic
from app.config import get_settings
from app.services.brand_loader import PLATFORM_RULES, load_brand_config


def _build_system_prompt(brand: dict, platform: str) -> str:
    voice = brand["voice"]
    off_limits = "; ".join(brand.get("off_limits", []))
    rules = PLATFORM_RULES.get(platform, PLATFORM_RULES["linkedin"])
    return f"""You are a senior social media writer for {brand['name']}.

Brand voice: {voice['description']}
Tone keywords: {', '.join(voice['keywords'])}
Voice characteristics:
- {chr(10).join(['  ' + c for c in voice['characteristics']])}

Off-limits (never produce content that does any of these): {off_limits}

Platform: {platform}
Length target: {rules['min_words']}-{rules['max_words']} words.
Platform notes: {rules['tone_note']}

Output rules:
1. Return ONLY the post text. No commentary, no explanations, no preamble.
2. Do not invent statistics or client names that were not provided in the user brief.
3. Do not use generic AI-sounding phrases ("In today's fast-paced world", "Let's dive in", etc.).
4. Match the brand voice precisely. If the brand is strategic and infrastructure-led, be that. If it is cinematic and emotionally driven, be that.
5. The post must feel written by a person who knows this brand deeply.
""".strip()


def _build_user_prompt(req: dict, pillars_text: str) -> str:
    return f"""Write a {req['platform']} post for the following brief.

Content format: {req['content_format']}
Campaign goal: {req['campaign_goal']}
Target audience: {req['audience']}
Growth angle / specific insight to anchor on: {req['growth_angle']}

Available content pillars to align with:
{pillars_text}

Write the post now.""".strip()


def generate_post(req: dict[str, Any]) -> dict[str, Any]:
    """Generates a single post via Anthropic API. Falls back to a deterministic
    template if Anthropic is not configured (so local dev works without keys).
    """
    settings = get_settings()
    brand = load_brand_config(req["brand_id"])
    pillars_text = "\n".join([f"- {p['name']}: {p['description']}" for p in brand["content_pillars"]])

    if not settings.anthropic_api_key:
        # Deterministic dev fallback so the API works end-to-end without keys
        text = (
            f"[DEV FALLBACK — set ANTHROPIC_API_KEY for real generation]\n\n"
            f"{req['growth_angle'].strip()}\n\n"
            f"For {req['audience']}, this matters because the work happens at the "
            f"{brand['voice']['keywords'][0].lower()} layer — not the surface."
        )
        return {
            "text": text,
            "platform": req["platform"],
            "word_count": len(text.split()),
            "char_count": len(text),
            "brand_name": brand["name"],
            "model": "dev-fallback",
        }

    client = Anthropic(api_key=settings.anthropic_api_key)
    system = _build_system_prompt(brand, req["platform"])
    user = _build_user_prompt(req, pillars_text)
    rules = PLATFORM_RULES.get(req["platform"], PLATFORM_RULES["linkedin"])
    max_tokens = max(600, rules["max_words"] * 4)

    msg = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    text = "".join(block.text for block in msg.content if hasattr(block, "text")).strip()
    return {
        "text": text,
        "platform": req["platform"],
        "word_count": len(text.split()),
        "char_count": len(text),
        "brand_name": brand["name"],
        "model": settings.anthropic_model,
    }
