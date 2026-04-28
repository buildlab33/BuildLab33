# COP Platform — Backend

FastAPI backend for the Content & Outreach Platform.
Deployable to Render with one click. Uses Supabase for database + auth.

---

## What's in this folder

```
backend/
├── app/
│   ├── main.py              ← FastAPI app entry point
│   ├── config.py            ← Settings loaded from .env
│   ├── database.py          ← Supabase client
│   ├── security.py          ← bcrypt + JWT + role guards
│   ├── routers/             ← API endpoints
│   │   ├── auth.py          ← signup, login, refresh, me
│   │   ├── brands.py        ← brand listing
│   │   └── generate.py      ← AI content generation
│   ├── services/            ← business logic
│   │   ├── anthropic_service.py
│   │   └── brand_loader.py
│   └── schemas/             ← Pydantic request/response models
├── brand_configs/
│   ├── yeon_studios.json
│   └── belive_studios.json
├── db/
│   └── 001_initial_schema.sql   ← run this in Supabase SQL Editor
├── requirements.txt
├── .env.example             ← copy to .env, fill in keys
└── README.md
```

---

## Setup — first time

You will need accounts on:
1. **Supabase** — supabase.com (free tier)
2. **Anthropic** — console.anthropic.com (you already have this)
3. **NewsAPI** — newsapi.org (free dev tier, optional for now)
4. **Render** — render.com (free tier, for deploy)

### Step 1 — Create Supabase project
1. Go to supabase.com and sign in with GitHub
2. Click **New Project** — name it `cop-platform`, region closest to Singapore
3. Save the database password somewhere safe
4. Wait ~2 minutes for the project to provision
5. Go to **SQL Editor** → paste the entire contents of `db/001_initial_schema.sql` → Run
6. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon public` key
   - `service_role` key  (keep this secret — it bypasses Row Level Security)

### Step 2 — Configure environment
1. Copy `.env.example` to `.env`
2. Paste your Supabase URL and both keys
3. Generate a JWT secret:
   ```
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
   Paste the result as `JWT_SECRET`
4. Paste your Anthropic API key from console.anthropic.com → API Keys
5. (Optional now) Paste your NewsAPI key

### Step 3 — Run locally
```
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs to see interactive API docs.

---

## Deploy to Render

1. Push this repo to GitHub (already done)
2. Go to render.com → **New → Web Service**
3. Connect the BuildLab33 repository
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free (cold starts) or Starter ($7/month, no cold starts)
5. Add environment variables (same as your local `.env`)
6. Click **Create Web Service**

Render gives you a public URL like `https://cop-platform-api.onrender.com`.

---

## Available endpoints (Phase 1)

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/` | Health info | — |
| GET | `/health` | Health check | — |
| POST | `/api/auth/signup` | Create account | — |
| POST | `/api/auth/login` | Get tokens | — |
| POST | `/api/auth/refresh` | Refresh access token | — |
| GET | `/api/auth/me` | Current user | Bearer |
| GET | `/api/brands` | List brands | Bearer |
| GET | `/api/brands/{id}` | Brand detail | Bearer |
| POST | `/api/generate` | Generate post | Bearer |

Auth header format: `Authorization: Bearer <access_token>`

---

## Coming next

- `/api/posts` — full CRUD with status machine
- `/api/posts/{id}/schedule` — clash detection
- `/api/news` — NewsAPI ingestion
- `/api/leads` — lead generation module
- `/api/outreach` — outreach drafting and sending
- `/api/sequences` — sequence builder
- `/api/users` — admin user management
- `/api/audit` — audit log viewer

---

## Security notes

- Passwords hashed with bcrypt (never stored plain)
- JWT tokens with 24h access + 30d refresh
- Service role key only used server-side — never exposed to frontend
- `.env` is gitignored — never commit real keys
- All endpoints (except auth + health) require valid Bearer token
