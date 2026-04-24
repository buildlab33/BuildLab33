---
name: Project Current State
description: What has been built, what is planned, and what comes next for BuildLab33
type: project
originSessionId: 6ad28b89-c0a4-4d5b-80ed-9a40f2b9e5b8
---
As of 2026-04-24, the following is complete:

- Brand guides fully written for Yeon Studios and BeLive Studios
- Content generation, outreach drafting, and news monitoring workflows built
- Output folder structure in place
- Full system build plan approved and saved at: C:\Users\Kevin Chng\.claude\plans\cop-platform-build-report.md

**The system being built is called: COP Platform (Content & Outreach Platform)**

**What it does:**
1. AI social media post generation per platform and brand voice (Instagram, LinkedIn, TikTok, YouTube, Facebook)
2. Smart scheduling with clash detection (3-choice resolution modal)
3. Lead generation — finds companies + contacts via news, criteria, LinkedIn, manual input; scores, enriches, flags duplicates
4. Outreach sequences — fully customisable (3 presets + build from scratch + save templates)
5. Response tracking — engagement stats on posts, reply detection on outreach
6. Brand management — add/archive/restore with full history retained
7. 4 roles: Super Admin, Admin, User, Guest — enforced server-side
8. 10 per-user themes
9. Security above basic: bcrypt, JWT rotation, rate limiting, input sanitisation
10. Full version history + rollback on all content
11. Point-in-time database recovery via Supabase

**Tech stack:**
- Frontend: Next.js 14 on Vercel
- Backend: Python FastAPI on Render
- Database: Supabase (PostgreSQL)
- Cache: Upstash Redis
- AI: Anthropic API (claude-sonnet-4-6)
- News: NewsAPI.org
- Email: Resend
- LinkedIn DM: copy-to-clipboard (Phase 1), PhantomBuster (Phase 2)

**Build phases:**
- Phase 1 (Weeks 1–2): Demo build — AI generation real, publishing stubbed
- Phase 2 (Weeks 3–10): Full production — all integrations live
- Phase 3 (Month 3–6): Enterprise scale — multi-tenant SaaS

**Next immediate task:**
Build mockup/ui_mockup.html — single HTML file, 11 screens, dark sidebar, clickable, no server needed

**Clients:**
- Yeon Studios (OTT infrastructure, B2B)
- BeLive Studios (content/IP production)

**GitHub repo:** https://github.com/buildlab33/BuildLab33.git

**Why:** Human approval required at every step. Phase 1 is a client demo. Phase 2 is daily production use.
