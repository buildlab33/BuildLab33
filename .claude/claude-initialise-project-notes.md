# Plan: Build Outreach Drafting + Industry News Monitoring Workflows

## Context
Content Generation workflow (`workflows/generate_post.md`) is built and validated. The user is skipping today's "1 week of Yeon posts" run and moving directly to the next two WAT workflows on the priority list:

1. **Outreach Drafting** — draft partnership / press / collaborator outreach messages for either brand, with the same confirmation-first pattern.
2. **Industry News Monitoring** — a manual-first SOP for surfacing relevant industry news that feeds content ideas and outreach hooks.

Both stay in Option 1 mode: pure markdown SOPs, no Python, no API keys, human approval at every step. Matches the agreed working style until brand voice is validated.

## Files to create

### File 1: `workflows/draft_outreach.md`

Mirrors the structure of `generate_post.md` so the agent pattern stays consistent.

**Required inputs:**
1. **Brand** — Yeon Studios or BeLive Studios (loads `clients/{brand}/brand_guide.md`)
2. **Recipient type** — brand manager / agency lead / OTT operator / journalist / event organizer / IP collaborator
3. **Channel** — Email / LinkedIn DM / LinkedIn InMail
4. **Objective** — intro / partnership pitch / press pitch / event / collab
5. **Recipient context** — name, company, role, hook (recent news, mutual connection, prior touchpoint)

**Steps:**
1. Load brand guide — pull voice, tone keywords, off-limits, target audience fit
2. Validate recipient matches a listed target audience segment; flag if not
3. Apply channel format rules (table below)
4. Draft: specific hook referencing recipient context → 1-line value prop tied to brand differentiator → clear ask → soft CTA
5. **Confirmation gate** — same format block as `generate_post.md` (Brand / Recipient / Channel / Objective / Draft / "Approve, revise, or discard?")
6. On approve → save to `outputs/outreach/{brand-folder}/{channel}/YYYY-MM-DD_{recipient-slug}.md`
7. On revise → ask what to change, redraft, re-gate
8. On discard → nothing saved

**Channel format rules:**
| Channel | Length | Format notes |
|---|---|---|
| Email | 80–150 words | Subject line required. Greeting + 3 short paragraphs + sign-off. No hashtags. |
| LinkedIn DM | 40–80 words | No subject. Conversational. One ask. No links on first touch. |
| LinkedIn InMail | 80–120 words | Subject line required. Slightly more formal than DM. One clear CTA. |

**Edge cases:**
- Recipient outside target audience → flag and confirm before drafting
- No hook provided → ask for one clarifying detail (avoid generic openers)
- Sensitive claim in objective → apply brand guide off-limits, reframe or stop

### File 2: `workflows/monitor_industry_news.md`

Manual SOP for a weekly news sweep. No scraping tools yet — agent uses WebSearch (or user-supplied links) and structures findings. Later iterations graduate to a Python tool in `tools/`.

**Required inputs:**
1. **Brand lens** — Yeon / BeLive / both
2. **Time window** — last 7 days (default) / last 30 days / custom
3. **Region focus** — Singapore / SEA / Korea / China / global (defaults to brand guide markets)

**Steps:**
1. Load brand guide(s) — extract content pillars and target audience as relevance criteria
2. Build search query set from pillars:
   - Yeon: "OTT infrastructure", "video platform", "streaming monetisation", "SEA OTT", "media-tech Singapore"
   - BeLive: "microdrama", "short-form drama", "vertical drama", "IP studio SEA", "Korea microdrama"
3. Run WebSearch per query within time window; collect 10–20 candidates
4. Filter: must match a brand pillar AND target audience interest; discard PR fluff
5. For each kept item extract: headline, source, date, 1-line summary, brand relevance, suggested angle (content post / outreach hook / internal note)
6. **Confirmation gate** — present shortlist (top 5–8) in table form: "Save digest, pick items for content drafting, or discard?"
7. On save → `outputs/news-digest/{brand-folder}/YYYY-MM-DD_digest.md`
8. On pick → hand selected items to `generate_post.md` or `draft_outreach.md` as topic/hook input

**Edge cases:**
- Fewer than 3 relevant items → report and suggest widening window or region
- Paywalled sources → note in digest, don't invent summary
- Off-limits topic surfaces (politics, unverified claims) → exclude with a note

## Critical files to reference
- [workflows/generate_post.md](workflows/generate_post.md) — structural template; mirror its confirmation gate verbatim
- [clients/yeon-studios/brand_guide.md](clients/yeon-studios/brand_guide.md) — voice, pillars, target audience for Yeon
- [clients/belive-studios/brand_guide.md](clients/belive-studios/brand_guide.md) — voice, pillars, target audience for BeLive
- [CLAUDE.md](CLAUDE.md) — WAT framework rules (workflow first, tools later)

## New folders
- `outputs/outreach/yeon-studios/` + `.gitkeep`
- `outputs/outreach/belive-studios/` + `.gitkeep`
- `outputs/news-digest/yeon-studios/` + `.gitkeep`
- `outputs/news-digest/belive-studios/` + `.gitkeep`

## Verification
- **Outreach**: test with Yeon Studios / LinkedIn DM / OTT operator / partnership pitch / fictional recipient. Confirm gate fires, revise path works, approved draft saves to correct folder.
- **News monitoring**: test with "both brands / last 7 days / SEA". Confirm shortlist is presented before saving; confirm selected items can feed `generate_post.md`.
- Delete test outputs after validation (same cleanup pattern used for `generate_post.md` test run).

## Out of scope (explicitly deferred)
- Python tools in `tools/` for outreach sending or news scraping — manual first.
- CRM / contact list integration — recipient context passed inline for now.
- Google Sheets export — stays local markdown in `outputs/` until client approval loop is live.
