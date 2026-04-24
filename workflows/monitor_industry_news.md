# Workflow: Industry News Monitoring

## Objective
Sweep recent industry news relevant to Yeon Studios or BeLive Studios, filter to high-signal items, and present a shortlist for human review before saving a digest or feeding items into other workflows.

---

## Source Integrity Rules (non-negotiable)

Every item in the digest MUST pass all of these before it reaches the shortlist:

1. **Legitimate source only** — established news outlets, official company press releases, regulatory filings, verified industry publications, or first-party posts from a named executive's verified account. No anonymous blogs, AI-generated content farms, aggregator rewrites, or social posts without a primary source.
2. **Real, published, and dated** — the article must exist, be publicly accessible (or explicitly marked `[paywalled]`), and carry a real publish date within the requested time window.
3. **Fact-checkable** — every claim used in the summary must come directly from the article. Do not paraphrase into new claims, do not fill gaps with assumption, do not infer numbers or outcomes that aren't stated.
4. **No fabrication** — if WebSearch returns nothing solid for a query, report that honestly. Never invent a headline, source, URL, quote, or statistic to fill the shortlist.
5. **Cite the URL** — every kept item must carry its source URL. Items without a verifiable URL are discarded.

If any item fails any of the above, discard it. If the whole sweep fails to produce enough legit items, surface that to the user in Step 6 instead of padding.

---

## Required Inputs

1. **Brand lens** — Yeon Studios / BeLive Studios / both
2. **Time window** — last 7 days (default) / last 30 days / custom
3. **Region focus** — Singapore / SEA / Korea / China / global (defaults to brand guide markets)

---

## Steps

### Step 1 — Load brand guide(s)
Read `clients/{brand}/brand_guide.md` for each brand in scope. Extract:
- Content pillars (relevance criteria)
- Target audience (whose interests define "relevant")
- Off-limits topics (hard filter)

### Step 2 — Build search queries

**Yeon Studios:**
- "OTT infrastructure"
- "video platform"
- "streaming monetisation"
- "SEA OTT"
- "media-tech Singapore"

**BeLive Studios:**
- "microdrama"
- "short-form drama"
- "vertical drama"
- "IP studio SEA"
- "Korea microdrama"

Scope each query to the time window and region focus.

### Step 3 — Run searches
Use WebSearch for each query. Collect 10–20 candidate items across queries.

### Step 4 — Filter for relevance
Keep only items that:
- Match at least one brand content pillar, AND
- Align with a target audience interest, AND
- Are not off-limits (politics, unverified claims, competitor attacks)

Discard PR fluff, listicles, and unsourced rumor.

### Step 5 — Structure each kept item

For each item capture:
- Headline
- Source + publish date
- **URL** (mandatory — no URL means discard)
- 1-line summary from the article itself
- Brand relevance (which pillar it maps to)
- Suggested angle: `content post` / `outreach hook` / `internal note`

### Step 6 — Confirmation gate (mandatory)

Present the top 5–8 items as a table and STOP. Do not save.

```
---
NEWS DIGEST — SHORTLIST

Brand lens:  [Yeon / BeLive / both]
Window:      [range]
Region:      [region]

| # | Headline | Source · Date | Relevance | Suggested angle |
|---|----------|---------------|-----------|------------------|
| 1 | ...      | ...           | ...       | ...              |
...

---

Save digest, pick items for content drafting, or discard?
```

### Step 7 — Handle response

- **Save digest** → Write full shortlist to `outputs/news-digest/{brand-folder}/YYYY-MM-DD_digest.md`. If brand lens is `both`, save two files, one per brand.
- **Pick items** → Ask which item numbers, then hand each to `generate_post.md` (as topic/brief input) or `draft_outreach.md` (as hook input).
- **Discard** → End workflow. Nothing saved.

Confirm to user: "Digest saved to [path]. Run another sweep or move to drafting?"

---

## Edge Cases

- **Fewer than 3 relevant items** → Report to user. Suggest widening the window or region before saving.
- **Paywalled source** → Note `[paywalled]` in summary. Do not invent a summary.
- **Off-limits topic in results** → Exclude with a one-line note in the discarded pile so the user knows it was seen.
- **Duplicate story across sources** → Keep the highest-signal source, note others as "also covered by ...".

---

## Notes
- This is a manual-first workflow. If it becomes routine, graduate the search + filter steps to a Python tool in `tools/` (per the WAT principle in CLAUDE.md).
- The digest format is intentionally simple so items can be lifted directly into `generate_post.md` or `draft_outreach.md`.
