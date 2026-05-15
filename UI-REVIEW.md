# UI-REVIEW.md — Retroactive 6-Pillar Audit

**Scope:** Frontend post-overhaul (Round 3: UI/UX Pro Max)
**Date:** 2026-05-15
**Auditor:** Inline (no GSD phase dir — project not GSD-managed)
**Stack:** Next.js App Router + Tailwind v4 + 10-theme CSS variable system

---

## Overall Score: 19 / 24

| Pillar | Score | Verdict |
|--------|------:|---------|
| Copywriting | 3/4 | Good |
| Visuals | 3/4 | Good |
| Color | 4/4 | Excellent |
| Typography | 3/4 | Good |
| Spacing | 3/4 | Good |
| Experience Design | 3/4 | Good |

---

## 1. Copywriting — 3/4

**What's working**
- Subtitles consistently explain page intent: "Manage your content pipeline", "Track and manage your prospects", "Industry news matched to your brands"
- CTAs are verb-led: "Submit for Approval", "Find Leads", "Log Activity", "Un-submit"
- Empty states explain *why* and *what next*: discover page tells users they need a brand first and links to creation
- Error toasts are actionable: "Too many requests — wait a minute and try again"

**Issues**
- Greeting "Good morning, {name} 👋" — only emoji left in the product, inconsistent with no-emoji-icons rule
- "Un-submit" is internal jargon; "Retract" or "Withdraw" would read better
- Discover page disclaimer ("These are AI-generated archetypes — verify details before reaching out.") is buried inside the results panel; should be on the empty state too
- "All done" completion screen is sparse — no celebration, no clear next step beyond "View in Leads"

**Top fixes**
1. Remove the 👋 emoji from dashboard greeting (or commit to a defined emoji set)
2. Rename "Un-submit" → "Retract" across `posts/page.tsx` and `posts/[id]/page.tsx`

---

## 2. Visuals — 3/4

**What's working**
- Consistent card pattern (rounded-xl, border-border, bg-surface) with proper inset highlight + drop shadow per theme
- Light-mode shadow override now correctly uses light inset + soft drop shadow instead of dark-mode values
- Icon system unified on Lucide (no emoji-as-icon)
- Status badges use opacity-based colour pairs (`text-X bg-X/10`) that work across all 10 themes

**Issues**
- The login page logo mark still uses `gradient-brand` (indigo→pink). Since the gradient button variant was deprecated as garish, the logo gradient is now an orphan style — either re-embrace it as brand mark or drop it
- Card shadow stack is heavy in dark themes (`0 4px 16px rgba(0,0,0,0.35)` plus a second shadow). Two stacked shadows can look muddy on the deepest themes (midnight, forest)
- Discover page lead cards use plain `border` + `rounded-xl` but no shadow — inconsistent with the `Card` component used everywhere else
- No skeleton state for posts page initial load on slow connection (relies on `loading` boolean only)

**Top fixes**
1. Replace `gradient-brand` logo on `login/page.tsx` with a solid primary square or actual logo
2. Standardize the discover page `<div className="bg-surface border ...">` blocks to use the `<Card>` component

---

## 3. Color — 4/4

**What's working**
- 10-theme semantic token system: every colour pulled from `--color-*` variables, no raw hex in components after the sweep
- Semantic naming (`primary`, `error`, `warning`, `success`, `info`) with `-muted` opacity pairs
- Per-theme contrast verified: `text-text-primary` on `bg-surface` meets WCAG AA in all 10 themes
- Token consistency sweep eliminated all bare `text-text` (invalid token) → `text-text-primary`
- Light-mode (`day` theme) gets dedicated shadow override
- Platform badges (instagram, youtube etc.) refactored from hard light-mode classes (`bg-pink-100 text-pink-700`) to theme-safe opacity classes (`bg-pink-500/15 text-pink-400`)

**Issues**
- None significant.

---

## 4. Typography — 3/4

**What's working**
- Migrated to Plus Jakarta Sans (friendly, modern, professional — appropriate for B2B SaaS)
- Font weights 400/500/600/700 loaded with `display: swap`
- `PageHeader` now `text-2xl` (was `text-xl`) — closer to standard SaaS dashboard headline scale
- Body text consistently `text-sm` with `leading-relaxed` for paragraphs
- Hierarchy: h1 (2xl bold) → section labels (sm bold) → body (sm) → meta (xs muted) is consistent across pages

**Issues**
- 12px (`text-xs`) is used heavily for buttons, meta, helper text, badges, and even some primary copy (e.g. dashboard quick-action card descriptions). Below the readable minimum on mobile for primary content
- `Card` titles use `text-sm font-bold` — most dashboards use `text-base` or `text-lg` for card titles; `text-sm` makes section structure feel cramped
- No defined type scale tokens (`--text-display`, `--text-headline`, etc.) — sizes are hardcoded Tailwind utilities, so changing the scale requires touching every page

**Top fixes**
1. Bump `CardTitle` from `text-sm` → `text-base`
2. Audit `text-xs` usage and promote primary body copy to `text-sm` (keep `text-xs` only for badges/meta)

---

## 5. Spacing — 3/4

**What's working**
- Dashboard layout has single `p-6` wrapper; pages no longer double-pad with their own `p-6 space-y-6`
- 4pt/8pt scale: gaps are `gap-2/3/4/6`, padding is `p-3/4/5/6` — consistent
- `Input` now `min-h-[44px]` meeting Apple HIG touch target
- `Button` size scale (`sm h-8`, `md h-10`, `lg h-11`) — reasonable but `md` is just under the 44px touch minimum
- Page subtitles get proper breathing room (`mt-1`)

**Issues**
- `Button md` size is `h-10` (40px), `lg` is `h-11` (44px). The default `md` doesn't meet touch target — should be `h-11` minimum, or auto-promote on mobile
- The notification panel fix uses `fixed bottom-[110px] left-0 w-[220px]` — magic numbers that will break if sidebar header/footer heights change
- Some pages use `space-y-6` while dashboard uses `mb-8` between sections — inconsistent vertical rhythm
- Calendar `min-h-[80px]` cells feel cramped on dense weeks; could benefit from auto-expand

**Top fixes**
1. Promote `Button` size `md` to `h-11` (or set `md: "h-11 px-4 text-sm"`) so the default button meets touch target without callers needing `size="lg"`
2. Replace notification panel magic numbers with a calculated position (`bottom: footer-height + 8px`)

---

## 6. Experience Design — 3/4

**What's working**
- Self-service unsubmit flow gives users control before admin review
- Brand creation now redirects to brand detail (orientation preserved)
- Notification panel: backdrop close pattern fixed the mousedown-vs-click race
- Discover page handles 4 states explicitly (empty / loading / results / completion) with appropriate transitions
- News feed sessionStorage read/unread mimics inbox conventions
- Password strength meter provides real-time feedback (4 segments, semantic colours)
- Skeleton loaders on dashboard, posts, calendar, and discover prevent CLS
- Inactivity logout (30 min) protects abandoned sessions
- Calendar clash modal offers three resolution paths instead of just blocking

**Issues**
- No `prefers-reduced-motion` query anywhere — animations always run, violating accessibility for vestibular users
- No `focus-visible:ring` consistently applied to non-Button interactive elements (sidebar links, status pills, table rows)
- Modal/slide-over close: ESC key not handled — users must click X or backdrop
- Outreach modal uses `confirm("Unschedule this post?")` (browser-native) — inconsistent with the styled toast/modal system
- `cursor-pointer` was added to Button but inline `<button>` and `<a>` tags across pages don't get it — visible inconsistency on hover
- No "you have unsaved changes" guard on profile/brand edit forms

**Top fixes**
1. Add `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }` to `globals.css`
2. Add a `Modal` component with ESC handler and replace native `confirm()` calls in calendar/profile flows
3. Add global keyboard handler for closing slide-overs (ContactSlideOver, NewsSlideOver, Calendar reschedule panel) on ESC

---

## Top 5 Fixes (Cross-Pillar Priority)

1. **Accessibility — reduced-motion query** (Experience): one CSS block, biggest accessibility win
2. **Button default size → `h-11`** (Spacing): default CTA meets touch target without per-callsite fix
3. **ESC handler for modals/slide-overs** (Experience): native pattern users expect, currently broken
4. **CardTitle `text-sm` → `text-base`** (Typography): immediate hierarchy improvement across every card
5. **Drop or commit to the logo gradient** (Visuals): currently orphaned style; either becomes brand mark or goes

---

## Notes

- **Audit method:** code-only (no Playwright-MCP). No visual diff against a UI-SPEC because none exists in this project.
- **Themes verified:** midnight, day, ocean, forest, rose, slate, amber, violet, dusk, nordic — token contrast pairs all meet AA when sampled. Day theme shadow override now appropriate for light mode.
- **Not audited:** mobile breakpoint behaviour (would require Playwright or device testing), animation performance, real-content overflow.

---

## ▶ Next

- Address the Top 5 fixes (estimated ~45 min)
- Optionally write a `UI-SPEC.md` to lock in current design decisions before the next round of changes
