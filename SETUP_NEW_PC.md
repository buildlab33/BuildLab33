# COP Platform — Setup on New PC

This guide helps you continue development on a new machine.

## Prerequisites
- Git installed
- Node.js 18+ (for frontend)
- Python 3.11 (for backend)
- A code editor (VS Code recommended)

## Step 1: Clone the Repository

```bash
git clone https://github.com/buildlab33/BuildLab33.git
cd BuildLab33
```

## Step 2: Frontend Setup

```bash
cd frontend
npm install
```

Create `.env.local` file in the `frontend/` directory:

```
NEXT_PUBLIC_API_URL=https://cop-platform-api.onrender.com
```

Start the dev server:

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

## Step 3: Backend Setup

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment:
- **Windows (PowerShell):** `.\.venv\Scripts\Activate.ps1`
- **Windows (Git Bash):** `source .venv/Scripts/activate`
- **Mac/Linux:** `source .venv/bin/activate`

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `.env` file in the `backend/` directory:

```
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_supabase_service_role_key>
JWT_SECRET=<your_jwt_secret>
ANTHROPIC_API_KEY=<your_anthropic_api_key>
ANTHROPIC_MODEL=claude-sonnet-4-6
CORS_ORIGINS=https://build-lab33.vercel.app,http://localhost:3000
```

**Where to find these values:**
1. **Supabase:** Log in to https://supabase.com → Project Settings → API
2. **Anthropic:** Get key from https://console.anthropic.com/
3. **JWT_SECRET:** Use any random string (or check `.env` file from your previous setup)

Start the backend:

```bash
python -m uvicorn app.main:app --reload
```

Backend will be available at `http://localhost:8000`

## Step 4: Verify Everything Works

1. **Frontend:** http://localhost:3000 → should show login page
2. **Backend API docs:** http://localhost:8000/docs → should show Swagger UI
3. **Login:** Use credentials from your previous session (e.g., kevinchng82@gmail.com / Admin@2026)

## Current Status (as of April 29, 2026)

**Phase 1 — COMPLETE:**
- ✅ Backend: FastAPI with JWT auth, Supabase integration, Anthropic AI generation
- ✅ Frontend: Next.js with login, dashboard, content generation, posts list
- ✅ Database: Supabase PostgreSQL with full schema
- ✅ Deployed: Backend on Render, Frontend on Vercel

**Phase 2 — IN PROGRESS:**
- 🔄 UI/Component System: Need to build reusable components (Button, Input, Modal, Card, etc.)
- 🔄 Brand Management: Add create/edit/delete brand endpoints + user-brand relationships
- 🔄 Post Approval Workflow: Real "Approve & Save" button → saves to database
- ⏳ Calendar View: Schedule posts with clash detection
- ⏳ Leads Module: Find and score companies via NewsAPI
- ⏳ Outreach Sequences: Customizable templates for email/LinkedIn

## Important Files

**Frontend:**
- `frontend/app/login/page.tsx` — Login form
- `frontend/app/dashboard/page.tsx` — Dashboard home
- `frontend/app/dashboard/generate/page.tsx` — Content generation
- `frontend/app/dashboard/posts/page.tsx` — Posts list
- `frontend/lib/api.ts` — API client with axios
- `frontend/store/auth.ts` — Zustand auth state

**Backend:**
- `backend/app/main.py` — FastAPI app setup
- `backend/app/routers/auth.py` — Login/signup endpoints
- `backend/app/routers/brands.py` — Brand listing
- `backend/app/routers/generate.py` — Content generation endpoint
- `backend/app/services/anthropic_service.py` — AI generation logic
- `backend/db/001_initial_schema.sql` — Database schema

**Environment Variables:**
- `.env` — Backend credentials (Git-ignored, not in repo)
- `frontend/.env.local` — Frontend API URL (Git-ignored)

## Troubleshooting

**"Module not found" on backend?**
```bash
pip install -r requirements.txt
```

**"Cannot find module" on frontend?**
```bash
npm install
```

**Port 3000 or 8000 already in use?**
```bash
# Change frontend dev server port
npm run dev -- -p 3001

# Change backend port
python -m uvicorn app.main:app --reload --port 8001
```

**Login not working?**
- Check that backend is running (http://localhost:8000/docs should load)
- Verify `.env` files are in place with correct keys
- Check browser console for error messages
- Ensure CORS_ORIGINS in backend `.env` includes your frontend URL

## Next Steps

When you're ready to continue:
1. Read `cop-platform-build-report.md` for the full Phase 1-3 plan
2. Work on UI component system (most impactful for Phase 2)
3. Then add brand management (create/edit/delete)
4. Then implement post approval workflow

Good luck! 🚀
