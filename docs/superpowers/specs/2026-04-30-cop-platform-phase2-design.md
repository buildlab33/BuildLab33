# COP Platform — Phase 2 Full Design Spec
**Date:** 2026-04-30
**Status:** Approved
**Scope:** UI Component System + Full Platform Feature Design

---

## 1. Design System

### 1.1 Color Tokens

| Token | Value | Usage |
|---|---|---|
| `bg-base` | `#0f172a` | Page background |
| `bg-surface` | `#0d1117` | Cards, modals |
| `bg-sidebar` | `#0d0f1f` | Sidebar background |
| `bg-elevated` | `#1e293b` | Hover states, code blocks |
| `border` | `#1e293b` | All borders |
| `border-active` | `#6366f150` | Focused inputs, active states |
| `accent-primary` | `#6366f1` | Indigo — Yeon Studios, primary actions |
| `accent-secondary` | `#ec4899` | Pink — BeLive Studios |
| `gradient` | `linear-gradient(135deg, #6366f1, #ec4899)` | Primary buttons, active nav, badges |
| `text-primary` | `#f8fafc` | Headings, labels |
| `text-secondary` | `#94a3b8` | Subtext, descriptions |
| `text-muted` | `#64748b` | Placeholders, timestamps |
| `text-active` | `#a5b4fc` | Active nav items, highlights |
| `success` | `#10b981` | Approved, published, won |
| `warning` | `#f59e0b` | Pending, on hold, caution |
| `error` | `#ef4444` | Rejected, error, danger |
| `info` | `#38bdf8` | Info states, tooltips |

**Day Mode equivalents:** white/light grey background, same gradient accents, all tokens flipped to light equivalents. User toggles Day/Night in Settings.

### 1.2 Typography

- **Font:** DM Sans (Google Fonts)
- **Weights used:** 400 (body), 500 (labels), 600 (subheadings, buttons), 700 (headings)
- **Scale:**
  - Page title: 20px / 700
  - Section heading: 15px / 700
  - Body: 13px / 400
  - Label (uppercase): 11px / 500 / letter-spacing 0.06em
  - Caption: 11px / 400

### 1.3 Spacing & Density

- **Density:** Comfortable — balanced padding, not cramped, not wasteful
- **Card padding:** 20px
- **Page padding:** 24px horizontal, 20px vertical
- **Form field gap:** 14px between fields
- **Component gap:** 8px between related items, 16px between sections

### 1.4 Border Radius

| Element | Radius |
|---|---|
| Cards | 12px |
| Inputs, selects | 8px |
| Buttons | 8px |
| Badges, pills | 20px (fully rounded) |
| Avatars | 50% (circle) |
| Modal | 16px |

### 1.5 Component Library

- **Base:** shadcn/ui (headless, accessible components)
- **Styling:** Tailwind CSS with custom design tokens
- **Icons:** Lucide React (ships with shadcn/ui)
- **Forms:** React Hook Form + Zod validation

---

## 2. Layout & Navigation

### 2.1 Sidebar

- **Desktop (≥768px):** Always open, fixed 220px width, icons + labels visible
- **Mobile (<768px):** Icon strip only (44px wide), tap to expand as overlay
- **Structure:**
  - Logo + platform name (top)
  - Navigation items (middle, scrollable)
  - User avatar + name + role (bottom)
- **Active state:** Gradient background `#6366f120→#ec489920`, gradient border, indigo text
- **Inactive state:** Muted icon, grey text

### 2.2 Sidebar Navigation Items

```
Dashboard
Generate
Posts
Calendar
News Feed
Leads
Outreach
Clients
Brands
Settings
```

### 2.3 Page Header

Every page has a consistent header:
- Left: Page title (20px/700) + subtitle (11px, muted)
- Right: **Navigation action button** — a page-level action that opens a new flow (e.g. "Add Brand", "Generate New", "Import CSV"). This is distinct from a form submit button.

### 2.4 Form Layout

- **Desktop:** Two columns (related fields side by side)
- **Mobile:** Single column (Tailwind: `grid-cols-1 md:grid-cols-2`)
- **Form submit button:** Full-width gradient at bottom of the form (e.g. "Generate for Yeon Studios", "Save Brand")
- **Secondary actions:** Ghost button alongside the submit button (e.g. Reset, Cancel)
- Two button types exist: navigation actions (top-right header) and form submit actions (bottom of form). They serve different purposes and both appear on the same page where applicable.

### 2.5 Responsive Grid

- Cards: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Generate page: `grid-cols-1 md:grid-cols-2` (form | result)
- Posts list: Single column full-width cards

---

## 3. Component Inventory

### 3.1 Core UI (shadcn/ui styled)

| Component | Variants |
|---|---|
| Button | Gradient (primary), Ghost (secondary), Danger, Icon-only |
| Input | Default, Focus state, Error state, Disabled |
| Textarea | Default, Character counter |
| Select | Default, Multi-select |
| Card | Default, Clickable (hover border), With header/footer |
| Modal/Dialog | Confirmation, Form modal, Info |
| Toast | Success, Error, Warning, Info |
| Dropdown | Default menu, With icons |
| Badge | Brand (gradient), Status (colour-coded), Platform (grey) |
| Avatar | With image, Initial fallback, With role badge |
| Tooltip | Short contextual hint |
| Skeleton | Loading placeholder matching component shape |

### 3.2 Layout Components

| Component | Purpose |
|---|---|
| Sidebar | Responsive nav, see Section 2.1 |
| PageHeader | Title + subtitle + right-side action |
| LoadingScreen | Full-page spinner for auth check |
| EmptyState | Icon + message + CTA for empty lists |
| OnboardingTooltip | Guided tip box on first visit per page |

### 3.3 Domain-Specific Components

| Component | Purpose |
|---|---|
| StatusBadge | Colour-coded: draft/pending/approved/scheduled/published |
| BrandBadge | Gradient pill per brand (Yeon=indigo, BeLive=pink) |
| PlatformPill | Platform selector toggle (LinkedIn, Instagram, etc.) |
| CharacterCounter | Live count with platform limit warning |
| RelevanceBar | % bar showing AI relevance score (News Feed) |
| ActivityTimeline | Timestamped log of remarks, status changes, messages |
| LeadStatusTracker | Visual step-through of lead lifecycle |
| ContactCard | Company contact with name, role, email, LinkedIn |

---

## 4. Authentication

### 4.1 Login

- **Login ID:** Alphanumeric username only (no email for login)
- **Password policy:** Min 8 chars, at least 1 uppercase, 1 number, 1 special character
- **Real-time validation:** Inline error messages as user types
- **Session:** JWT access token (15min) + refresh token (7 days), rotation on refresh

### 4.2 Registration

- Invite-only — no public sign-up
- User sets username + password on first login via invite link
- Real-time duplicate username check (debounced API call)

### 4.3 Forgot Password

- User enters their registered email address
- System sends reset link (expires in 1 hour)
- User clicks link → sets new password (policy enforced)
- Old sessions invalidated on password reset

### 4.4 Two-Factor Authentication (2FA)

- **Super Admin:** Mandatory — must set up 2FA on first login (authenticator app: Google Authenticator, Authy)
- **Admin / User / Guest:** Optional — prompted once, can enable/disable in Settings → Security
- Method: TOTP (Time-based One-Time Password via authenticator app)

### 4.5 Session Management

- Auto-logout after **30 minutes of inactivity** (configurable by Super Admin)
- Super Admin can view all active sessions per user and force-logout any device
- User can "Log out all other devices" from Settings → Security
- All session activity logged in audit log

---

## 5. User Management

### 5.1 Invite Methods

| Method | Flow |
|---|---|
| Email invite | Super Admin enters email → system sends invite link → user clicks → sets username + password |
| Direct creation | Super Admin creates account directly (sets username + temp password), shares credentials manually |
| Invite code | Generate single-use code → user enters on registration page |

### 5.2 Roles

| Role | Permissions |
|---|---|
| Super Admin | Full access — all brands, all users, audit logs, system settings, force-logout, 2FA mandatory |
| Admin | Approve posts, manage schedule, view all brands, invite users |
| User | Generate drafts for assigned brands, submit for approval, manage own leads |
| Guest | Read-only dashboard — no generation, no approval, no lead management |

- Roles enforced server-side on every API call — cannot be bypassed from the browser

### 5.3 Granular Permissions

Super Admin can set per-user overrides beyond their base role:
- Toggle visibility of specific sections (e.g. hide Clients tab for a User)
- Toggle actions (e.g. allow a User to approve their own posts)
- Stored as permission flags per user in the database

### 5.4 Brand-Level Access Control

- Each user can be assigned to specific brands
- User only sees brands they are assigned to
- Super Admin and Admin see all brands
- Assignment stored in `user_brands` join table

### 5.5 User Actions (Super Admin only)

- **Block user:** Suspends login access, data retained, can be unblocked
- **Remove user:** Deactivates account, data retained (never deleted), reassigns leads to Admin
- **Change role:** Update at any time, takes effect immediately on next API call

---

## 6. Brand Management

### 6.1 Create Brand — AI Voice Interview

When creating a new brand, the system runs a guided AI interview:

**Phase 1 — Interview (20+ qualified questions):**
Questions cover: brand identity, industry positioning, target audience, communication tone, content pillars, platforms used, competitors, what to avoid, past campaign examples, geographic focus, language formality, emotional register, thought leadership stance, product/service differentiation, ideal customer profile, objections to address, success metrics, brand personality archetypes, cultural sensitivities, and seasonality patterns.

Questions are: non-duplicate, professionally worded, ordered from foundational to nuanced, displayed one at a time with progress indicator.

**Phase 2 — Sample Post Analysis (optional but recommended):**
After the interview, user pastes 3–10 existing social media posts. AI analyses them to extract:
- Actual sentence structure and rhythm
- Vocabulary preferences
- Emoji usage patterns
- Hashtag style
- Opening hook patterns
- Call-to-action style

**Phase 3 — Config Generation:**
AI combines interview answers + sample analysis to generate the brand voice config (stored in database, not static JSON files). Config includes: tone descriptors, content pillars, platform-specific rules, word bank, things to avoid, sample generation prompts.

**Continuous Improvement:**
After each batch of 10 approved posts, the system uses them as additional few-shot examples. Generation quality improves over time as the AI builds a larger corpus of approved brand content.

### 6.2 Brand Record

| Field | Details |
|---|---|
| Name | Brand display name |
| Industry | Primary industry tag |
| Logo | Image upload (Super Admin/Admin only). Default: initials on gradient circle |
| Brand colour | Primary hex colour (used in badge, reports) |
| Default timezone | Set at creation (e.g. SGT UTC+8) |
| Content pillars | Editable list (e.g. Thought Leadership, Industry News, Product Updates) |
| Hashtag sets | Saved sets per platform, auto-appended on generation |
| Voice config | Generated by AI interview + sample analysis |
| Status | Active / Archived |

### 6.3 Archive / Restore

- Archived brands hidden from active views but all data, posts, leads, logs retained permanently
- Restore available to Super Admin at any time
- Every change (create, edit, archive, restore) logged in brand audit log: by whom, when, what changed

---

## 7. Content Generation & Post Workflow

### 7.1 Generate Page

- **Form (left column):** Brand selector, platform pills, campaign goal, target audience, content format, growth angle, news hook (optional — from News Feed)
- **Result (right column):** Generated post with brand/platform badges, character counter, copy button
- **Actions:** Approve & Save, Regenerate, Edit inline

### 7.2 Inline Post Editing

- Generated post text is directly editable before and after approval
- Rich-text not required — plain text with line breaks
- Character counter updates live as user edits
- Changes tracked in version history

### 7.3 Character Limits Per Platform

| Platform | Limit | Warning at |
|---|---|---|
| LinkedIn | 3,000 | 2,700 |
| Instagram | 2,200 | 2,000 |
| Facebook | 63,206 | 60,000 |
| X (Twitter) | 280 | 250 |
| TikTok | 150 | 130 |
| YouTube | 5,000 | 4,500 |

### 7.4 A/B Post Variants

- "Generate 2 versions" option produces two posts side by side
- User picks one to approve, discards the other
- Both versions logged in version history

### 7.5 Post Template Library

- After approving a post, user can "Save as Template"
- Template stores: platform, campaign goal, audience, format, angle (not the generated text)
- Next generation: pick a template to pre-fill the form
- Templates are brand-specific

### 7.6 Post Status Workflow

```
Draft → Pending Approval → Approved → Scheduled → Published
                        ↘ Rejected (with reason, returns to Draft)
```

- Every status change logged with timestamp and user
- Version history saved on every edit — restore any previous version
- Bulk actions: select multiple posts → approve / reject / delete

### 7.7 Post Preview

- Show simulated preview of how the post looks on LinkedIn, Instagram, etc.
- Not pixel-perfect — structural preview (avatar, name, text, platform chrome)
- Available before and after approval

---

## 8. Calendar

### 8.1 Views

- **Monthly view:** Default. Each day shows scheduled posts as colour-coded dots/chips
- **Weekly view:** Toggle. Shows time slots with post cards
- **Brand toggle:** All brands (default, colour-coded) or filter to single brand

### 8.2 Scheduling

- Click any date/time slot → select post to schedule (from approved posts list)
- Timezone: defaults to brand's timezone, user can override per post
- All times stored as UTC in database, displayed in correct brand timezone

### 8.3 Clash Detection

- Triggers only when: same brand + same platform + posts within 2 hours of each other
- Cross-brand posts on same platform: no clash (different audiences, different voice)
- On clash detected → modal with 3 choices:
  1. Reschedule this post (pick new slot)
  2. Reschedule the other post
  3. Post anyway (confirm override)

### 8.4 Drag-and-Drop Reschedule

- Posts on calendar can be dragged to a new date/time slot
- Triggers clash detection on drop if needed

---

## 9. News Feed

### 9.1 Source

- NewsAPI.org — articles filtered by each brand's industry keywords
- Feed refreshes every 30 minutes automatically

### 9.2 Article Card

Each article shows: headline, source, time, excerpt, relevance % bar, brand tag, Generate button, Save button.

### 9.3 Relevance Scoring

- AI scores each article 0–100% against the brand's ideal client profile and content pillars
- High relevance (≥80%) flagged as "High Relevance" with gradient badge
- Relevance bar explained via OnboardingTooltip on user's first visit to News Feed

### 9.4 Generate from Article

- "Generate Post → [Brand]" pre-fills the Generate page with article headline and excerpt as the context hook
- User still fills in remaining fields and generates

### 9.5 Filters

- By brand, by topic/pillar, by date range
- Global search across article headlines and excerpts

---

## 10. Leads System

### 10.1 Lead Entry Sources

1. **From news** — article on News Feed flags a company as a warm lead
2. **By criteria** — user sets filters (industry, location, company size) → system searches
3. **LinkedIn search** — manual URL input (Phase 2: PhantomBuster automation)
4. **Manual input** — paste company name, email, LinkedIn URL
5. **CSV import** — bulk upload via downloadable template (template provided in-app)

### 10.2 Deduplication

- On every new lead: check if same company name or email already exists
- If duplicate found → flag for user review:
  - Merge (combine fields, keep one record)
  - Keep both (separate records, note the overlap)
  - Discard new (keep existing)

### 10.3 Auto-Processing (on entry)

1. Score 1–10 against brand's ideal client profile
2. Enrich missing fields (company size, industry, LinkedIn URL, email)
3. Prompt for assignment or auto-assign to default user
4. Draft outreach message (email + LinkedIn DM)
5. Status set to: **New**

### 10.4 Custom Fields

- Super Admin / Admin can add custom fields in Settings → Lead Fields
- Field types: text, number, date, dropdown, checkbox, URL
- Stored as JSONB in database — no code changes needed to extend
- Applies to all leads immediately on creation

### 10.5 Lead Status Lifecycle

```
New → Not Yet Contacted → Reaching Out → Replied → Meeting Booked
                                                  ↘ Closed — Won → Client Database
Dead-end: Uncontactable / Closed — Not Interested / Closed — Wrong Fit / On Hold
```

### 10.6 Ownership Model

- **Primary Owner:** One user. Makes final decisions (status changes, approve messages, close lead, request reassignment)
- **Collaborators:** Multiple users. Can add remarks, view history, suggest message drafts — cannot change status
- **Cross-brand leads:** Each brand's assigned user becomes a Collaborator; Primary Owner manages overall lead

### 10.7 Reassignment Workflow

- Only Super Admin or Admin can reassign primary owner
- Current owner can request reassignment → Admin approves
- On reassignment: both old and new owner notified, log entry recorded, all history preserved

### 10.8 Multiple Contacts Per Company

- One company record → many contacts
- Each contact: name, job title, email, LinkedIn URL, phone (optional), notes, brand relevance tag
- One contact flagged as Primary (default outreach target)
- User selects which contact to reach out to per outreach step

### 10.9 Remarks + Activity Timeline

- Every lead has a remarks input — user types a note, timestamp auto-applied
- Full timeline per lead: status changes, messages sent, replies, remarks, assignments — all timestamped with user name
- Timeline is read-only (append-only) — nothing can be deleted

### 10.10 Lead Assignment Display

- Lead cards and list view show assigned user's avatar + name
- Filter leads by assigned user
- Reassign from lead detail view (Admin/Super Admin only)

---

## 11. Outreach & Sequences

### 11.1 Message Drafting

- Per lead, per contact: AI drafts email + LinkedIn DM using brand voice, news context, lead details
- User reviews and edits before approving
- Human approval required before any message is sent

### 11.2 Sending

- **Email:** Resend API — sent automatically on approval
- **LinkedIn DM:** Copy-to-clipboard on approval (Phase 2: PhantomBuster automation)
- **Auto-reply (email only):** Resend provides reply webhooks — when someone replies to a platform-sent email, the webhook notifies the system. AI drafts a response → user approves → system sends automatically via Resend. This does NOT require access to the user's full email inbox — it only tracks replies to emails sent through the platform. LinkedIn auto-reply is not supported (no API access).

### 11.3 Sequence Templates (3 built-in)

| Template | Duration | Strategy |
|---|---|---|
| Slow Burn | 45 days | Long nurture, low frequency, high value content |
| Multi-Touch Blitz | 14 days | High frequency, multiple channels |
| Content Bridge | 35 days | Leads with brand content before pitching |

### 11.4 Custom Sequence Builder

- Per step: channel (email/LinkedIn), timing (days after previous), tone, conditions (e.g. only if no reply), end-of-sequence action
- Save custom sequences as reusable templates
- Set default sequence at account level or per campaign
- Guard rail: if step requires LinkedIn DM but contact has no LinkedIn URL → flagged before sequence starts

### 11.5 Sequence Analytics

- Per sequence: open rate (email), reply rate, meeting booked rate
- Per step: which step gets most replies
- Displayed in Outreach → Analytics sub-tab

---

## 12. Client Database

Clients graduate from Closed — Won leads.

### 12.1 Client Record

| Field | Details |
|---|---|
| Company name | From lead record |
| Brand relationships | One entry per brand (status, service, notes) |
| Contacts | All contacts from lead record, carried over |
| Account status | Active / Onboarding / Inactive |
| Date closed | When lead converted |
| Communication log | Full timeline inherited from lead record |
| Onboarding notes | Free-text, editable |

### 12.2 Multi-Brand Relationship

One company can be a client of multiple brands simultaneously. Each brand relationship tracked independently with its own status and notes.

### 12.3 Access

- Visible to all roles (read)
- Edit/update: Admin and above
- Only Super Admin can permanently archive a client record

---

## 13. Notifications

### 13.1 In-App (Bell Icon)

Located top-right of every page. Shows unread count badge.

| Event | Recipient |
|---|---|
| Post submitted for approval | Admin, Super Admin |
| Post approved / rejected | Post author |
| Lead assigned to you | Assigned user |
| Lead status changed | Primary owner, collaborators |
| Outreach reply detected | Primary owner |
| Sequence paused (reply received) | Primary owner |
| Scheduling clash detected | Post scheduler |
| User invited successfully | Inviting admin |
| Lead duplicate flagged | Assigned admin |

### 13.2 Email Notifications

Same events as above, sent to registered email. User can toggle per-event in Settings → Notifications.

### 13.3 Future (Phase 3)

WhatsApp and mobile push notifications — deferred until mobile app exists.

---

## 14. Settings

### 14.1 Appearance

- Day / Night mode toggle (replaces 10-theme picker)
- Night mode: Brand Gradient Dark (default)
- Day mode: Light equivalent with same gradient accents
- Preference saved to user profile, applied instantly

### 14.2 Profile

- Display name (editable)
- Email address (editable, used for notifications and password reset)
- Username (login ID — editable with duplicate check)
- Change password (current password required, policy enforced)
- Enable/disable 2FA

### 14.3 Notifications

- Toggle per-event email notifications
- Toggle in-app notification types

### 14.4 Security

- View active sessions (device, location, last active)
- Force-logout other sessions
- Auto-logout inactivity timer (default 30 minutes)

### 14.5 Lead Fields (Admin/Super Admin)

- Add / edit / remove custom lead fields
- Field types: text, number, date, dropdown, checkbox, URL

### 14.6 API Usage Monitor (Super Admin)

- Anthropic API: calls used this month, estimated cost
- NewsAPI: requests used, remaining in quota
- Resend: emails sent this month
- Displayed as progress bars with quota limits

---

## 15. Onboarding

### 15.1 First Login Flow

1. Set username + password (if invited)
2. Set up 2FA (mandatory Super Admin, prompted for others)
3. Brief welcome screen: "Here's what you can do" — 3 key actions
4. Guided to add first brand (if Super Admin / Admin)

### 15.2 Per-Page Guided Tips

OnboardingTooltip component appears on first visit to each major page:
- **Dashboard:** What the quick actions do
- **Generate:** How brand voice affects output, what each field does
- **News Feed:** What the relevance % bar means and how articles are scored
- **Calendar:** How clash detection works
- **Leads:** What auto-scoring means and how to read the status lifecycle
- **Outreach:** How sequences work and what approval means
- Tips dismissed on click, never shown again (stored in user profile)

---

## 16. Security Standards

- Passwords hashed with bcrypt — never stored plain text
- JWT sessions: 15min access token, 7-day refresh token, rotation on refresh
- All roles enforced server-side — cannot be bypassed from browser
- All form inputs sanitised — blocks SQL injection and XSS
- Login rate-limited (5 attempts → 15 minute lockout)
- HTTPS enforced across all traffic
- API keys in environment variables only — never in code or database
- Audit log: every login, approval, send, brand change, user change — append-only, no role can delete
- 2FA: TOTP via authenticator app (mandatory Super Admin)
- Auto-logout on inactivity (default 30 min, configurable)
- Session management: force-logout by Super Admin

---

## 17. Audit Log (Super Admin only)

Accessible via Settings → Audit Log.

Logs every action: who, what, when, on which brand/lead/post. Filterable by user, date range, action type. Read-only — no role can edit or delete entries.

---

## 18. Build Sequence (Phase 2)

Build in this order — each step depends on the previous:

1. **UI Component System** — design tokens, shadcn/ui setup, all reusable components
2. **Authentication upgrades** — username login, password policy, forgot password, 2FA, session management
3. **Brand Management** — AI interview, create/edit/archive, logo/colour, pillars, hashtags, timezone
4. **Post Approval Workflow** — real Approve & Save, version history, inline edit, character counter
5. **Calendar** — schedule posts, clash detection, drag-drop, timezone display
6. **News Feed** — NewsAPI integration, relevance scoring, generate from article
7. **Leads System** — all 4 entry sources, dedup, scoring, enrichment, co-op model, timeline, CSV import
8. **Outreach & Sequences** — message drafting, sending, auto-reply, sequence builder, analytics
9. **Client Database** — graduation from Closed-Won, multi-brand relationships, contacts
10. **Notifications** — in-app bell, email notifications
11. **Settings** — day/night mode, profile, security, API monitor, lead fields
12. **Onboarding** — welcome flow, per-page guided tips

---

*Spec written 2026-04-30. All decisions confirmed by Kevin Chng during brainstorming session.*
