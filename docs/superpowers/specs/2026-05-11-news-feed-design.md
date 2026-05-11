# News Feed — Design Spec

## Goal

Display curated industry news on the News Feed page, auto-matched to each brand's industry using free RSS feeds. Users filter by brand and click articles to preview them in-app.

## Architecture

Two parts: a FastAPI news router (backend) and a News Feed page + slide-over (frontend). No database — articles are fetched live and cached in memory for 15 minutes per brand.

---

## Backend

### Router: `backend/app/routers/news.py`

Single endpoint:

```
GET /api/news?brand_id={id}
```

**Flow:**
1. Look up brand by `brand_id` → get `industry` field
2. Map `industry` to a list of RSS feed URLs (see mapping below)
3. Fetch all feeds in parallel using `httpx.AsyncClient`
4. Parse each feed with `feedparser`
5. Merge articles, sort by `published_at` descending, return top 30
6. Cache result in a module-level dict keyed by `brand_id`, TTL 15 minutes

**Response shape (list of):**
```json
{
  "title": "Article title",
  "url": "https://...",
  "source": "TechCrunch",
  "summary": "First 300 chars of description",
  "published_at": "2026-05-11T08:00:00Z"
}
```

**Industry → RSS mapping:**

| Industry keyword | Feeds |
|---|---|
| `media`, `tech`, `ott` | TechCrunch, The Verge, Wired |
| `marketing`, `content`, `social` | Marketing Week, AdAge, HubSpot |
| `retail`, `fashion`, `ecommerce` | Retail Dive, Business of Fashion |
| `finance`, `fintech` | Reuters Business, CNBC Finance |
| *(fallback)* | BBC Business, Reuters Top News |

Industry matching is case-insensitive substring — e.g. `"Media-tech and OTT infrastructure"` matches `media`, `tech`, and `ott` → uses media/tech feeds.

**Dependencies to add:** `feedparser`, `httpx` (httpx already installed for Supabase).

### Register in `main.py`

```python
from app.routers import news
app.include_router(news.router, prefix=settings.api_prefix)
```

---

## Frontend

### `frontend/lib/news-api.ts`

Types + one API helper:

```ts
export interface NewsArticle {
  title: string
  url: string
  source: string
  summary: string
  published_at: string
}

export const getNews = (brandId: string) =>
  api.get<NewsArticle[]>('/api/news', { params: { brand_id: brandId } })
```

### `frontend/app/dashboard/news/page.tsx`

Replaces the stub. Layout:
- Page header: "News Feed" + subtitle
- Brand filter dropdown (same pattern as Leads/Outreach pages)
- If no brand selected: prompt to select a brand
- Article list: each row shows title (bold), source + date (muted), chevron right
- Click row → opens `NewsSlideOver`
- Loading state: skeleton rows
- Empty state: "No articles found for this brand"

### `frontend/components/domain/NewsSlideOver.tsx`

Slide-over (same pattern as ContactSlideOver). Shows:
- Article title (large)
- Source name + published date
- Summary paragraph
- "Read full article →" button (opens `article.url` in new tab)
- Close button

---

## Error Handling

- If a single RSS feed fails to fetch, skip it silently — other feeds still load
- If all feeds fail, return empty array (frontend shows empty state)
- If `brand_id` not found, return 404

## Caching

Module-level dict in `news.py`:
```python
_cache: dict[str, tuple[list, datetime]] = {}
CACHE_TTL = timedelta(minutes=15)
```

On each request: check if cache entry exists and is fresh → return cached. Otherwise fetch, store, return.

---

## Out of Scope

- Saving/bookmarking articles
- NewsAPI integration (future)
- Per-user read/unread tracking
- Push notifications for new articles
