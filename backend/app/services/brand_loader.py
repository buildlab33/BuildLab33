"""Brand config loader for content generation.

Fetches brand data from Supabase and normalises it into the shape that
anthropic_service expects: { name, voice, content_pillars, off_limits }.

voice_config (stored by the AI interview flow) maps to `voice` when present.
Falls back to sensible defaults when a brand has not yet completed the voice
interview, so generation still works.
"""
from app.database import get_supabase

PLATFORM_RULES = {
    "instagram": {"min_words": 150, "max_words": 300, "hashtags": True, "tone_note": "Strong hook in first line. 3-5 relevant hashtags at end. Emojis optional but on-brand."},
    "linkedin":  {"min_words": 100, "max_words": 200, "hashtags": False, "tone_note": "Professional tone. No hashtags. End with a question or clear CTA."},
    "tiktok":    {"min_words": 50,  "max_words": 100, "hashtags": True, "tone_note": "Casual, punchy hook. Trending angle if applicable. Short sentences."},
    "youtube":   {"min_words": 150, "max_words": 200, "hashtags": False, "tone_note": "Video description format. Include a timestamps placeholder section."},
    "facebook":  {"min_words": 100, "max_words": 200, "hashtags": False, "tone_note": "Conversational tone. Shareable angle. End with a question or CTA."},
    "x":         {"min_words": 20,  "max_words": 50,  "hashtags": False, "tone_note": "Very tight. One sharp idea. Optional thread hook."},
}


def load_brand_config(brand_id: str) -> dict:
    """Fetch brand from Supabase and return a normalised config dict.

    Returned shape:
        {
            "name": str,
            "voice": {"description": str, "keywords": list[str], "characteristics": list[str]},
            "content_pillars": [{"name": str, "description": str}, ...],
            "off_limits": list[str],
        }
    """
    sb = get_supabase()
    res = sb.table("brands").select("id, name, industry, voice_config, content_pillars").eq("id", brand_id).limit(1).execute()
    if not res.data:
        raise ValueError(f"Brand not found: {brand_id}")
    brand = res.data[0]

    voice_config: dict = brand.get("voice_config") or {}

    # Build the voice dict from voice_config (set by the interview flow) or fall back.
    tone_descriptors: list[str] = voice_config.get("tone_descriptors", [])
    description = (
        f"{brand['name']} brand voice — {', '.join(tone_descriptors)}"
        if tone_descriptors
        else f"{brand['name']} brand voice"
    )
    voice = {
        "description": description,
        "keywords": tone_descriptors or ["Professional", "Clear", "On-brand"],
        "characteristics": voice_config.get("word_bank", [])[:6] or ["Authentic", "Consistent", "Audience-first"],
    }

    # content_pillars from the brand row (set during brand creation / editing)
    db_pillars: list[dict] = brand.get("content_pillars") or []
    # voice_config may also carry pillars from the interview; prefer the brand row if populated
    vc_pillars: list[dict] = voice_config.get("content_pillars", [])
    pillars = db_pillars if db_pillars else vc_pillars

    off_limits: list[str] = voice_config.get("avoid", [])
    sample_posts: list[str] = voice_config.get("sample_posts", [])

    return {
        "name": brand["name"],
        "voice": voice,
        "content_pillars": pillars,
        "off_limits": off_limits,
        "sample_posts": sample_posts,
    }
