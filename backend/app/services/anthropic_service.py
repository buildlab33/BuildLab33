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
1. Return ONLY the post text. No commentary, no explanations, no preamble. Never ask clarifying questions.
2. Do not invent statistics or specific client names that were not provided in the user brief.
3. If the brief lacks specific details (e.g. a case study with no client named), write a strong, authentic post using what IS provided — use evocative language, the brand voice, and the campaign goal. You can reference "a recent client", "a campaign we ran", "a project" without naming specifics.
4. Do not use generic AI-sounding phrases ("In today's fast-paced world", "Let's dive in", etc.).
5. Match the brand voice precisely. If the brand is strategic and infrastructure-led, be that. If it is cinematic and emotionally driven, be that.
6. The post must feel written by a person who knows this brand deeply.
""".strip()


def _build_user_prompt(req: dict, pillars_text: str, sample_posts: list[str]) -> str:
    format_line = f"Content format: {req['content_format']}\n" if req.get("content_format") else ""
    angle_line = f"Growth angle / specific insight to anchor on: {req['growth_angle']}\n" if req.get("growth_angle") else ""
    pillars_section = f"\nAvailable content pillars to align with:\n{pillars_text}\n" if pillars_text else ""
    samples_section = ""
    if sample_posts:
        formatted = "\n\n---\n\n".join(sample_posts[:5])
        samples_section = f"\nHere are real posts published for this brand — study the style, sentence structure, vocabulary, and tone, then match it exactly:\n\n{formatted}\n"
    return f"""Write a {req['platform']} post for the following brief.

{format_line}Campaign goal: {req['campaign_goal']}
Target audience: {req['audience']}
{angle_line}{pillars_section}{samples_section}
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
        angle = req.get("growth_angle", "").strip()
        text = (
            f"[DEV FALLBACK — set ANTHROPIC_API_KEY for real generation]\n\n"
            + (f"{angle}\n\n" if angle else "")
            + f"For {req['audience']}, this matters because the work happens at the "
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
    user = _build_user_prompt(req, pillars_text, brand.get("sample_posts", []))
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
    text = message.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
    return json.loads(text.strip())
