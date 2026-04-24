---
name: Security Checks — Always Run Before Every Session
description: Three security rules to check proactively at every session for BuildLab33 project
type: feedback
originSessionId: 56d47c2a-ad8f-4144-a3b0-8d7f0108f55e
---
Always check these 3 security points proactively for BuildLab33. Do not wait for the user to ask.

1. **No API keys outside .env** — Scan any new or modified files to ensure secrets are never hardcoded. Only `.env` holds credentials.

2. **credentials.json and token.json stay gitignored** — Verify `.gitignore` still covers these files before every commit. Never allow these to be staged.

3. **Audit .gitignore when adding new tools** — Every time a new tool or integration is added, check if it introduces new secret files and update `.gitignore` accordingly.

**Why:** User explicitly requested these 3 points be checked always and never overlooked or overwritten.

**How to apply:** At the start of any session involving BuildLab33, and before every git commit, run through these 3 checks and report status to the user.
