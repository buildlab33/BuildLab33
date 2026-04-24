# Project Build Report
## Unified Content, Outreach & Response Management System
**Prepared by:** BuildLab33
**Date:** 24 April 2026
**Version:** 1.0

---

## 1. Project Overview

BuildLab33 is building an AI-powered platform that centralises social media content generation, client outreach, lead management, and response tracking for Yeon Studios and BeLive Studios — in one unified system.

The system replaces the need for separate tools (Buffer, Apollo, Lemlist, etc.) and gives both brands a single command centre for all outbound communications — from broadcasting posts to cold outreach to tracking replies.

---

## 2. What The System Does

### 2.1 Content Generation
- AI generates social media posts tailored per platform (Instagram, LinkedIn, TikTok, YouTube, Facebook)
- Each post matches the brand's voice, content pillar, and platform culture
- Human approves every post before it is scheduled or published
- Real news pulled from legitimate sources used as content hooks

### 2.2 Scheduling & Publishing
- User selects preferred date and time per post
- System detects scheduling clashes — if two posts are too close together on the same platform, user is prompted to post anyway, pick the next available slot, or choose manually
- One-click publish and one-click remove/unpublish
- Copy-to-clipboard on every piece of generated content

### 2.3 Lead Generation
The system actively finds leads — it does not wait for the user to provide them.

**Lead types found:**
- Companies (B2B) — organisations matching a target profile
- Individual contacts — specific people by job title and company
- Both — find the company first, then identify the right person inside it

**How leads are found (4 sources):**
1. **From news** — companies mentioned in relevant OTT, media-tech, or content industry articles are automatically surfaced as warm leads
2. **By criteria** — user sets filters (industry, location, company size) and system searches for matching companies
3. **LinkedIn search** — system finds people by job title and industry (via PhantomBuster in Phase 2; manual URL input in Phase 1)
4. **Manual input** — user pastes company names, LinkedIn URLs, or emails; system enriches the record

**Ideal client profile:**
- BuildLab33 defines the professional default profile for each brand (Yeon Studios and BeLive Studios) — industry fit, company size, seniority, geography, intent signals
- Clients can log in and adjust the profile to their own preferences and campaign needs
- System uses the active profile to score every incoming lead automatically

**What happens when a lead is found:**
1. **Score** — rated 1–10 against the ideal client profile. High scores surfaced first.
2. **Enrich** — missing fields auto-filled: company size, industry, LinkedIn URL, email where available
3. **Duplicate check** — if the same company or email already exists in the database, the new lead is added but flagged for user review. User decides: merge, keep both, or discard.
4. **Outreach message generated** — personalised email and LinkedIn DM drafted immediately using brand voice, news context, and lead details
5. **Assigned to sequence** — lead automatically enters the default outreach sequence (or user selects one)

**Lead status tracking:**
Not Found → Found → Enriched → Message Drafted → Approved → Contacted → Replied → Meeting Booked → Closed / Not Interested

### 2.4 Outreach & Sequences
- Human approves every message before it is sent
- Email sending via Resend API; LinkedIn DM via copy-to-clipboard (Phase 1), PhantomBuster automation (Phase 2)
- Fully customisable sequence builder:
  - 3 built-in templates: Slow Burn (45 days), Multi-Touch Blitz (14 days), Content Bridge (35 days)
  - Build from scratch or modify any template
  - Per step: choose channel, timing, tone, conditions, end-of-sequence action
  - Save custom sequences as reusable templates
  - Set a default sequence at account level or choose per campaign
- Guard rail: if a step requires LinkedIn DM but lead has no LinkedIn URL → flagged before sequence starts

### 2.4 Response Tracking
- Published posts show engagement stats: likes, comments, shares per platform
- Comment feed visible inside system — no need to log into each platform separately
- Outreach replies auto-detected — status updates from Contacted → Replied
- Reply notification triggers sequence pause: "Review before sequence continues"

### 2.5 Brand Management
- Add new brands with one click
- Archive brands — removed from active view but all data, logs, and history permanently retained
- Restore archived brands at any time (Super Admin)
- Every brand change logged: created, edited, archived, restored — by whom and when

### 2.6 User Roles & Access
| Role | What They Can Do |
|---|---|
| **Super Admin** | Full access — user management, brand config, audit logs, system settings |
| **Admin** | Approve posts, manage schedule, view all brands |
| **User** | Generate drafts for assigned brands, submit for approval |
| **Guest** | Read-only dashboard — no generation, no approval |

Roles enforced at server level — not just hidden in the UI.

### 2.7 Themes
- 10 preset themes per user — each person chooses their own in Settings → Appearance
- Saves to their profile, updates instantly
- Theme 10 (Brand) uses the active client's brand colours — feels like their own tool
- Default: Midnight (dark navy sidebar, electric blue accent)

---

## 3. Security Standards

- Passwords hashed with bcrypt — never stored in plain text
- JWT sessions with expiry and refresh token rotation — old tokens invalidated on logout
- All roles enforced server-side — cannot be bypassed from the browser
- All form inputs sanitised before reaching the database — blocks SQL injection and script attacks
- Login attempts rate-limited — prevents brute force attacks
- HTTPS enforced across all traffic
- API keys stored in environment variables only — never in code
- Audit log: every login, approval, send, and brand change timestamped and read-only — no role can delete logs

---

## 4. Logs, Records & Version Control

- **Activity log** — who did what, when, on which brand
- **Content version history** — every edit saved, never overwritten; restore any previous version with one click; latest version moves to history, not deleted
- **Outreach log** — every message sent, to whom, current reply status
- **Brand change log** — full lifecycle of every brand
- **Error log** — visible to Super Admin
- **Database rollback** — Supabase point-in-time recovery; restore the entire database to any moment in the last 7 days without losing data created after the error

---

## 5. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 on Vercel | Deploys from GitHub in one click. No cold starts. |
| Backend | Python FastAPI on Render | Click-to-deploy. Reliable. Easy environment variable management. |
| Database | Supabase (PostgreSQL) | Hosted Postgres + auth + backups. Free tier generous. One-click upgrade. |
| Cache | Upstash Redis | Serverless. Pay per request. No server to manage. |
| AI | Anthropic API (claude-sonnet-4-6) | Best in class for brand voice generation. |
| News | NewsAPI.org | Real, legitimate news. Free tier for development. |
| Email sending | Resend | 3,000 emails/month free. Simple API. |
| LinkedIn DM | Copy-to-clipboard → PhantomBuster (Phase 2) | LinkedIn blocks automation without approval. Manual first, automated later. |
| Scheduling | Supabase pg_cron | Built into Supabase. No extra service needed. |

### Cost Breakdown
| Stage | Monthly Cost | Notes |
|---|---|---|
| Demo / Development | ~$0 | Free tiers, acceptable cold starts |
| Live (light use) | ~$32/month | Render $7 + Supabase $25 — no cold starts, always-on DB |
| Scale up | ~$57/month | Add Upstash paid + Resend paid |
| Full production | ~$100–120/month | All paid tiers + PhantomBuster |

All upgrades are one-click in each platform's dashboard. No code changes. No downtime.

---

## 6. The 3 Build Options

### Option A — Demo-Ready (2 Weeks)
A fully clickable, functional demo. AI generation works for real. News feed is real. Approval workflow is live. Publishing is stubbed (shows "Published ✓" — no live social API call). Email sending is stubbed. Two roles active (Super Admin + User).

**Best for:** Showing clients a working system before committing to full build.

### Option B — Professional Product (6–8 Weeks)
All features fully implemented. Real social media publishing via platform APIs. Real email sending. All 4 roles. Outreach sequences automated. Full security hardening. Response tracking live.

**Best for:** Post-demo, client has signed off and wants a production system.

### Option C — Enterprise / Scale (3–6 Months, Team of 5–7)
Multi-tenant SaaS. Multiple agencies on one platform. White-label per client. Microservices architecture. Kafka event bus. Kubernetes deployment. SOC 2 compliance roadmap.

**Best for:** Scaling BuildLab33 into a product sold to 10+ agencies.

---

## 7. File & Folder Structure

```
project/
├── mockup/
│   └── ui_mockup.html              ← Interactive demo, open in browser
│
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   │   └── user, post, brand, lead, outreach, news_item, audit_log
│   ├── schemas/
│   ├── routers/
│   │   └── auth, generate, posts, news, schedule, leads, outreach, brands
│   ├── services/
│   │   └── anthropic_service, news_service, publish_service (stub),
│   │       email_service (stub), clash_detection
│   └── brand_configs/
│       └── yeon_studios.json, belive_studios.json
│
├── frontend/
│   ├── app/
│   │   └── dashboard, generate, posts, calendar, news,
│   │       outreach, sequence-builder, brands, settings
│   └── components/
│       └── PostCard, ClashModal, BrandManager, OutreachCard,
│           SequenceBuilder, PlatformSelector, ThemeSwitcher
│
├── clients/                        ← Existing — carried forward
│   ├── yeon-studios/brand_guide.md
│   └── belive-studios/brand_guide.md
│
├── workflows/                      ← Existing — logic encoded into services
│   ├── generate_post.md
│   ├── monitor_industry_news.md
│   └── draft_outreach.md
│
└── .env                            ← API keys, never committed to Git
```

---

## 8. UI Screens

1. **Login** — email + password, role badge on entry
2. **Dashboard** — posts generated today, pending approval, scheduled this week, leads in pipeline, replies this week
3. **Generate** — brand → content pillar → platforms → brief → Generate → platform cards with copy button + Approve
4. **Posts** — Kanban: Draft / Pending Approval / Scheduled / Published with engagement stats
5. **Post Detail** — engagement breakdown + comment feed per post
6. **Calendar** — monthly grid, clash indicator in red
7. **News** — real news feed, "Use in Post" and "Use in Outreach" buttons
8. **Lead Generation** — search by criteria or news, lead cards with score + enrich status, duplicate flags
9. **Outreach** — lead table, generated message cards, reply status, copy button, sequence assignment
10. **Sequence Builder** — visual step builder, 3 template presets, save as custom template
10. **Brands** — active brands, Add Brand button, archived brands section
11. **Settings** — user management, roles, default sequence, theme selector (Super Admin)

---

---

## SUMMARY

**What is being built:**
A single platform where brands generate AI-written social media posts, schedule them with clash protection, manage cold outreach sequences, track responses, and control everything through a clean role-based interface — without needing multiple separate tools.

**Who it is for:**
BuildLab33 operates it. Clients (Yeon Studios, BeLive Studios) log in to review, approve, and monitor.

**Key capabilities at a glance:**
- AI content generation per platform and brand voice
- Smart scheduling with clash detection
- Fully customisable outreach sequences (3 presets + custom builder)
- Response and engagement tracking
- 10 per-user themes
- Brand add/archive with full history retained
- Security above basic: bcrypt, JWT rotation, rate limiting, server-side roles
- Full version history and rollback on all content
- Point-in-time database recovery

---

## BUILD SCHEDULE

### Phase 1 — Demo Build (Weeks 1–2)
**Goal:** Working demo ready to show clients

| Day | Work |
|---|---|
| 1 | Supabase setup, FastAPI scaffold on Render, JWT auth, seed data |
| 2 | Brand config JSONs, prompt templates (all 10 platform × brand combos) |
| 3 | /generate endpoint live — test all 10 combos for content quality |
| 4 | NewsAPI integration, keyword filtering per brand, Supabase cache |
| 5 | Post CRUD, status machine (Draft → Pending → Approved → Scheduled → Published), clash detection |
| 6 | Lead generation module — criteria search, news-based lead surfacing, scoring, enrichment, duplicate flagging, sequence assignment |
| 7 | Scheduling endpoints, end-to-end backend test, fix broken flows |
| 8 | Next.js + Tailwind + shadcn/ui on Vercel, login page, auth context, theme system |
| 9 | Dashboard, Generate wizard |
| 10 | Posts Kanban (copy button, approve/reject), News page |
| 11 | Calendar with clash indicator, Post Detail with mock engagement stats |
| 12 | Outreach tab, Sequence Builder UI, Brand management page |
| 13 | Full deploy, smoke test, fix demo-blocking bugs |
| 14 | Buffer — demo prep only |

**Deliverable:** Fully clickable demo deployed at live URL. All screens working. AI generation real. Publishing stubbed with clear client communication.

---

### Phase 2 — Professional Product (Weeks 3–10)
**Goal:** All features live, real integrations, production-ready

| Weeks | Work |
|---|---|
| 3–4 | Real social API integrations — Instagram Graph, LinkedIn, TikTok, YouTube, Facebook. Apply for API access at start of Week 1 (approval takes time). |
| 5–6 | Real email sending via Resend, outreach sequence automation, reply detection webhooks, sequence pause on reply |
| 7–8 | All 4 roles fully enforced, audit log UI, Supabase Row Level Security, rate limiting, input sanitisation hardening |
| 9–10 | Response tracking live (real engagement data), comment feed, PhantomBuster LinkedIn DM integration, production polish and client handover docs |

**Deliverable:** Full production system. All 8 original requirements met. Ready for daily client use.

---

### Phase 3 — Scale (Month 3–6, if needed)
**Goal:** Multi-tenant platform, sell to additional agencies

| Month | Work |
|---|---|
| 3 | Microservices split, Kafka event bus, multi-tenancy data model |
| 4 | Elasticsearch news search, analytics service, white-label theming per tenant |
| 5 | Kubernetes deployment, CI/CD pipelines, security audit |
| 6 | Penetration test, load testing, SOC 2 roadmap, client onboarding flow |

**Deliverable:** Platform ready to onboard 10+ agencies. Team of 5–7 required.

---

*End of Report*
