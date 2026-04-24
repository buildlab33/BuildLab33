---
name: Never commit secrets to GitHub
description: User strongly prefers all API keys and secrets to stay local only, never on GitHub
type: feedback
originSessionId: 56d47c2a-ad8f-4144-a3b0-8d7f0108f55e
---
Never suggest committing API keys, tokens, or secrets to GitHub — even to private repos. Always keep secrets in the local `.env` file which is gitignored.

**Why:** User has explicitly stated they want secrets hosted locally only for security reasons.

**How to apply:** Before any git add/commit/push, verify no secrets are included. If .env or credentials files are ever accidentally staged, flag it immediately and remove them.
