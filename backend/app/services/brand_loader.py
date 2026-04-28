"""Loads brand configuration JSON files from disk."""
import json
from functools import lru_cache
from pathlib import Path
from app.config import get_settings

PLATFORM_RULES = {
    "instagram": {"min_words": 150, "max_words": 300, "hashtags": True, "tone_note": "Strong hook in first line. 3-5 relevant hashtags at end. Emojis optional but on-brand."},
    "linkedin":  {"min_words": 100, "max_words": 200, "hashtags": False, "tone_note": "Professional tone. No hashtags. End with a question or clear CTA."},
    "tiktok":    {"min_words": 50,  "max_words": 100, "hashtags": True, "tone_note": "Casual, punchy hook. Trending angle if applicable. Short sentences."},
    "youtube":   {"min_words": 150, "max_words": 200, "hashtags": False, "tone_note": "Video description format. Include a timestamps placeholder section."},
    "facebook":  {"min_words": 100, "max_words": 200, "hashtags": False, "tone_note": "Conversational tone. Shareable angle. End with a question or CTA."},
    "x":         {"min_words": 20,  "max_words": 50,  "hashtags": False, "tone_note": "Very tight. One sharp idea. Optional thread hook."},
}


@lru_cache
def load_brand_config(brand_id: str) -> dict:
    """Loads a brand JSON config from backend/brand_configs/."""
    settings = get_settings()
    file_map = {
        "yeon-studios": "yeon_studios.json",
        "belive-studios": "belive_studios.json",
    }
    filename = file_map.get(brand_id)
    if not filename:
        raise ValueError(f"Unknown brand_id: {brand_id}")
    path: Path = settings.project_root / "brand_configs" / filename
    if not path.exists():
        raise FileNotFoundError(f"Brand config not found at {path}")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def list_brands() -> list[dict]:
    """Returns a summary of all brand configs available."""
    out = []
    for brand_id in ["yeon-studios", "belive-studios"]:
        try:
            cfg = load_brand_config(brand_id)
            out.append({"id": cfg["id"], "name": cfg["name"], "industry": cfg["industry"]})
        except Exception:
            continue
    return out
