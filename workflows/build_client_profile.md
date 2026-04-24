# Workflow: Build Client Profile (Factual Dossier)

## Objective
Produce a verified, source-backed dossier on a client brand so every future post, pitch, and outreach is grounded in truth — not in the self-reported CEO questionnaire alone. Save to `clients/{brand}/company_profile.md`.

---

## Source Integrity Rules (non-negotiable)

Every fact in the dossier MUST pass all of these:

1. **Legitimate source only** — official company site, verified LinkedIn (company or named executive), established news outlets, regulatory filings (ACRA / SSM / equivalent), industry publications, or client-supplied materials (press kits, decks, timelines). No anonymous blogs, AI-generated content, aggregator rewrites.
2. **Attributable** — every claim cites a source URL or a named client-supplied document.
3. **Verified, not paraphrased into new claims** — wording stays close to the source. Do not infer numbers, outcomes, or relationships the source doesn't state.
4. **Dated** — every fact carries the source's publish date or "as of [date] per [source]".
5. **No fabrication** — if a fact can't be verified, mark it `[unverified]` and surface it to the user. Never fill gaps with assumption.
6. **Client-flagged exclusions honored** — anything the client asks not to reference is excluded even if public.

---

## Required Inputs

Collect before starting.

1. **Brand** — Yeon Studios or BeLive Studios (first two runs). Future: any client.
2. **Mode** — `light` (2–3 hours, public-facts only) or `full` (half-day+, includes client-supplied materials and deeper history)
3. **Client materials** — any decks, press kits, timelines the client has shared (or "none — public sources only")
4. **Client exclusions** — anything the client has asked not to reference

---

## Steps

### Step 1 — Pre-flight client check-in (full mode only)
Before research begins, the user should have asked the client:
- "Anything you want us to include beyond the questionnaire?"
- "Anything you do NOT want referenced in public content?"
- "Any materials — decks, press kits, past coverage — you can share?"

If this hasn't happened in `full` mode, flag it and ask the user whether to proceed anyway or pause.

### Step 2 — Read existing project context
- `clients/{brand}/brand_guide.md`
- `clients/{brand}/questionnaire_answers.md`
- `clients/{brand}/config.json`

Note what is *self-reported* vs. what needs *external verification*.

### Step 3 — Run source sweep

Check, in order:
1. **Official site** — About, Team, Press, News, Careers pages
2. **LinkedIn company page** — headcount, founded date, HQ, specialties, recent posts
3. **Founder / key executive LinkedIn profiles** — career history, prior companies
4. **Regulatory filing** — ACRA (Singapore) BizFile for incorporation date, shareholders (public fields only), business activities
5. **Press mentions** — established outlets (Variety, ContentAsia, Screen Daily, AVIA, The Business Times, Tech in Asia, Straits Times, etc.) within the last 3 years
6. **Partnerships / client wins** — cross-check against official site claims via the partner's own announcements
7. **Awards, events, speaking slots** — verify via event organizer's site
8. **Client-supplied materials** — extract dated facts, tag each as "client-supplied, [doc name]"

Use WebSearch for 5–7 and direct URL fetches where needed.

### Step 4 — Structure the dossier

Populate these sections. Leave sections empty with `[not verified]` if no legit source found — do not invent.

```
# {Brand} — Company Profile

Last updated: YYYY-MM-DD
Mode: [light / full]
Prepared by: BuildLab33

## 1. Snapshot
- Legal entity: [name + jurisdiction, per ACRA/registry]
- Founded: [date + source]
- HQ: [city + source]
- Headcount: [range + source + as-of date]
- Website: [URL]

## 2. Founding story & timeline
Verified events in chronological order. Each item: date · event · source URL.

## 3. Leadership
Named executives with verified roles, prior background per LinkedIn. No personal detail beyond public profile.

## 4. What they actually do
Services / products / IP they have publicly claimed AND that are corroborated (site + press + partner).

## 5. Verified partnerships & client wins
Only items corroborated by a second source (partner announcement, press mention). Mark single-source items `[single-source]`.

## 6. Press & industry coverage
Top 5–10 legit mentions in last 3 years. Date · outlet · headline · URL · 1-line summary.

## 7. Awards, events, recognitions
Verified only. Event organizer URL required.

## 8. Public positioning claims vs. evidence
Side-by-side: what the brand says about itself (from brand_guide / site) vs. what public record corroborates. Flag gaps without judgement.

## 9. Sensitive / exclusions
- Items the client asked not to reference (note the exclusion exists; do not repeat the content)
- Items flagged `[unverified]` that need client confirmation
- Any public controversy or correction (only if legit outlet reported; state neutrally with source)

## 10. Sources
Full list of URLs cited above, grouped by section.
```

### Step 5 — Confirmation gate (mandatory)

Present a summary to the user — NOT the full dossier — and STOP.

```
---
CLIENT PROFILE — READY FOR REVIEW

Brand:        [name]
Mode:         [light / full]
Sections populated: [X of 10]
Facts verified:     [count]
Flagged [unverified]: [count]
Single-source items: [count]
Client exclusions honored: [count]

Top 3 findings worth the user's attention:
1. ...
2. ...
3. ...

Any gaps or concerns:
- ...

---

Save dossier, revise specific sections, or discard?
```

### Step 6 — Handle response

- **Save** → write to `clients/{brand-folder}/company_profile.md`
- **Revise** → ask which sections, redo, re-gate
- **Discard** → nothing saved

### Step 7 — Client review loop (full mode)
After saving, the user should share the dossier with the client for:
- Correction of any `[unverified]` items
- Confirmation of sensitive exclusions
- Additions they want included

Update the dossier with a new `Last updated` date after client input.

---

## Edge Cases

- **Private company, thin public trail** → complete what's verifiable, flag the rest `[unverified]`, recommend switching to `full` mode with client-supplied materials.
- **Contradiction between self-report and public record** → surface neutrally in Section 8. Do not editorialize.
- **Source behind paywall** → mark `[paywalled]`, do not invent summary.
- **Client exclusion conflicts with something already public** → honor the exclusion; note its existence in Section 9 without repeating the content.
- **Legal / reputational item surfaced** → flag to user immediately before saving. User decides whether to include neutrally or escalate to client.

---

## Output Location

```
clients/{brand-folder}/company_profile.md
```

Where `{brand-folder}` = `yeon-studios` or `belive-studios`.

---

## Notes
- First two runs: Yeon Studios, then BeLive Studios.
- Reuse for every future client onboarding. The dossier is a foundation document, not a one-off.
- If this becomes routine, graduate Steps 3 (sweep) and 4 (structuring) to a Python tool in `tools/` per the WAT framework.
