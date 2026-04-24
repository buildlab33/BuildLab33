# Workflow: Draft Outreach Message

## Objective
Draft a partnership, press, or collaborator outreach message for Yeon Studios or BeLive Studios, apply the correct brand voice, and present it for human review before saving anything.

---

## Required Inputs

Collect all five inputs before drafting. Do not proceed until all are answered.

1. **Brand** — Yeon Studios or BeLive Studios?
2. **Recipient type** — brand manager / agency lead / OTT operator / journalist / event organizer / IP collaborator
3. **Channel** — Email / LinkedIn DM / LinkedIn InMail
4. **Objective** — intro / partnership pitch / press pitch / event / collab
5. **Recipient context** — name, company, role, and a hook (recent news, mutual connection, prior touchpoint)

---

## Steps

### Step 1 — Load brand guide
Read `clients/{brand}/brand_guide.md`. Extract:
- Brand voice and tone keywords
- Off-limits topics and tones
- Target audience segments
- Key differentiator (used for the value-prop line)

### Step 2 — Validate recipient fit
Check the recipient type against the target audience list in the brand guide.
- If it matches → continue.
- If not → flag to the user and ask whether to proceed, adjust, or abort.

### Step 3 — Apply channel format rules

| Channel | Length | Format notes |
|---|---|---|
| Email | 80–150 words | Subject line required. Greeting + 3 short paragraphs + sign-off. No hashtags. |
| LinkedIn DM | 40–80 words | No subject. Conversational. One ask. No links on first touch. |
| LinkedIn InMail | 80–120 words | Subject line required. Slightly more formal than DM. One clear CTA. |

### Step 4 — Draft the message
Structure:
1. **Hook** — specific reference from recipient context (news, mutual, prior touch). No generic openers.
2. **Value prop** — one line tying the brand's key differentiator to something the recipient cares about.
3. **Ask** — a single clear ask matched to the objective.
4. **CTA** — soft close (suggest a short call, reply for more, etc.).

Check draft against the brand guide's off-limits rules before presenting.

### Step 5 — Confirmation gate (mandatory)

Present the draft in this exact format and STOP. Do not save. Wait for user response.

```
---
OUTREACH DRAFT READY FOR REVIEW

Brand:        [Yeon Studios / BeLive Studios]
Recipient:    [name, role, company]
Channel:      [Email / LinkedIn DM / LinkedIn InMail]
Objective:    [intro / partnership / press / event / collab]

---

Subject: [if applicable]

[Message body]

---

Approve, revise, or discard?
```

### Step 6 — Handle response

- **Approve** → Go to Step 7
- **Revise** → Ask what to change, redraft, return to Step 5
- **Discard** → Confirm discard, end workflow. Nothing is saved.

### Step 7 — Save approved message

Save to:
```
outputs/outreach/{brand-folder}/{channel}/YYYY-MM-DD_{recipient-slug}.md
```

Where:
- `{brand-folder}` = `yeon-studios` or `belive-studios`
- `{channel}` = `email`, `linkedin-dm`, or `linkedin-inmail`
- `YYYY-MM-DD` = today's date
- `{recipient-slug}` = 2–4 word kebab-case, e.g. `jane-doe-acme`

Example: `outputs/outreach/yeon-studios/email/2026-04-24_jane-doe-acme.md`

Confirm to user: "Saved to [path]. Draft another?"

---

## Edge Cases

- **Recipient outside target audience** → Flag it after Step 2. Confirm with user before drafting.
- **No hook provided** → Ask one clarifying question. Do not write a generic opener.
- **Sensitive claim in objective** → Apply brand guide off-limits. Reframe or stop.
- **Channel not listed** → Default to Email format and note the assumption.

---

## Brand Voice Quick Reference

| | Yeon Studios | BeLive Studios |
|---|---|---|
| Voice | Strategic, visionary, infrastructure-led | Cinematic, emotionally driven, culturally sharp |
| Differentiator | Proprietary OTT and video infrastructure | Full-stack IP studio, microdrama development |
| Never | Casual, sensational, vague hype | Overly corporate, dry, technical jargon |
