# Workflow: Generate Social Media Post

## Objective
Draft a social media post for Yeon Studios or BeLive Studios, apply the correct brand voice, and present it for human review before saving anything.

---

## Required Inputs

Before starting, collect all four inputs from the user. Do not proceed until all are answered.

1. **Brand** — Yeon Studios or BeLive Studios?
2. **Platform** — Instagram / LinkedIn / TikTok / YouTube / Facebook?
3. **Content type** — thought leadership / behind-the-scenes / case study / client win / event recap / promo?
4. **Topic or brief** — 1–2 sentences describing what the post is about.

---

## Steps

### Step 1 — Load brand guide
Read `clients/{brand}/brand_guide.md` for the selected brand.
Extract:
- Brand voice and tone keywords
- Off-limits topics and tones
- Relevant content pillar(s) matching the content type

### Step 2 — Apply platform format rules

| Platform | Length | Format notes |
|----------|--------|--------------|
| Instagram | 150–300 words | Strong hook in first line. 3–5 relevant hashtags at end. Emojis optional but on-brand. |
| LinkedIn | 100–200 words | No hashtags. Professional tone. End with a question or clear CTA. |
| TikTok | 50–100 words | Casual, punchy hook. Trending angle if applicable. Short sentences. |
| YouTube | 150–200 words | Video description format. Include a timestamps placeholder section. |
| Facebook | 100–200 words | Conversational tone. Shareable angle. End with a question or CTA. |

### Step 3 — Draft the post
Write the post applying:
- Brand voice from the brand guide
- Platform format rules from Step 2
- Content type framing (e.g. case study = specific outcome + insight, thought leadership = bold claim + reasoning)
- Off-limits rules — check draft against them before presenting

### Step 4 — Confirmation gate (mandatory)

Present the draft in this exact format and STOP. Do not save. Do not proceed. Wait for user response.

```
---
DRAFT READY FOR REVIEW

Brand:        [Yeon Studios / BeLive Studios]
Platform:     [platform]
Content type: [type]
Topic:        [brief summary]

---

[Post text here]

---

Approve, revise, or discard?
```

### Step 5 — Handle response

- **Approve** → Go to Step 6
- **Revise** → Ask what to change, redraft, return to Step 4
- **Discard** → Confirm discard, end workflow. Nothing is saved.

### Step 6 — Save approved post

Save to:
```
outputs/drafts/{brand-folder}/{platform}/YYYY-MM-DD_{short-topic-slug}.md
```

Where:
- `{brand-folder}` = `yeon-studios` or `belive-studios`
- `{platform}` = `instagram`, `linkedin`, `tiktok`, `youtube`, or `facebook`
- `YYYY-MM-DD` = today's date
- `{short-topic-slug}` = 2–4 word kebab-case summary of the topic

Example: `outputs/drafts/yeon-studios/linkedin/2026-04-23_ott-infrastructure-launch.md`

Confirm to user: "Saved to [path]. Ready to generate another post?"

---

## Edge Cases

- **Off-limits topic detected in brief** → Flag it immediately after collecting inputs. Ask user to reframe before drafting.
- **Platform not listed** → Default to LinkedIn format and note the assumption.
- **Brief is too vague** → Ask one clarifying question before drafting. Do not guess.
- **User wants both brands** → Run workflow twice sequentially, one brand at a time. Each gets its own confirmation gate.

---

## Brand Voice Quick Reference

| | Yeon Studios | BeLive Studios |
|---|---|---|
| Voice | Strategic, visionary, infrastructure-led | Cinematic, emotionally driven, culturally sharp |
| Speaks about | Systems, scale, OTT infrastructure | Stories, IP, audience connection |
| Tone keywords | Strategic · Visionary · Scalable · Authoritative | Cinematic · Bold · Emotionally Driven · Culturally Sharp |
| Never | Casual, sensational, vague hype | Overly corporate, dry, technical jargon |
