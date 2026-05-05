# Settings Subsystem Design

## Goal

Build a full Settings area covering Profile, Security, Appearance, Notifications, and Team & Users — giving every user control over their account and giving Super Admins tools to manage the workspace.

## Architecture

Settings lives at `/dashboard/settings` with a shared left-nav layout. Each section is a sub-route (`/settings/profile`, `/settings/security`, etc.). The settings page index redirects to `/settings/profile`. The left nav is a shared layout component (`SettingsLayout`) that wraps all sub-pages.

The Team & Users section is only visible to `super_admin` role — hidden from Admin and User.

All form elements follow the established UI standards: `rounded-md`, `self-stretch` for height-matching, `appearance-none` + SVG arrow for selects, plain `<button>` with `py-2` for icon-buttons paired with inputs.

---

## Section A — Profile

**Route:** `/dashboard/settings/profile`  
**Access:** All roles

**Fields:**
- Display name — editable text input, saved on submit
- Email address — editable, used for notifications and password reset
- Username — read-only display (cannot be changed post-registration)
- Change password — three fields: current password, new password, confirm new password
  - Policy: min 8 chars, at least 1 uppercase, 1 number, 1 special character
  - Current password must be verified before allowing change
  - On success: toast "Password updated", all other sessions invalidated

**Backend:**
- `PATCH /auth/me` — update name and/or email
- `POST /auth/change-password` — verify current password, set new hash, invalidate other sessions

---

## Section B — Security

**Route:** `/dashboard/settings/security`  
**Access:** All roles  
**Status:** 2FA already built — extend with one addition

**Existing:**
- 2FA setup (QR + TOTP code)
- 2FA enable / disable

**New:**
- "Log out all other devices" button — calls `POST /auth/logout-all` which invalidates all refresh tokens in the DB for this user except the current session token

---

## Section C — Appearance

**Route:** `/dashboard/settings/appearance`  
**Access:** All roles

**Feature:** Day / Night mode toggle

- Toggle switch: Night (default) / Day
- Preference stored in `users.preferences` JSONB column as `{ "theme": "dark" | "light" }`
- Saved via `PATCH /auth/me` with `preferences` field
- Applied instantly on toggle via a `data-theme` attribute on `<html>` — no page reload
- Theme persists across sessions: loaded from user profile on login, stored in auth store

**Light theme implementation:**
- All Tailwind CSS design tokens have light-mode equivalents defined in `globals.css` under `[data-theme="light"]`
- Tokens to flip: `--color-base`, `--color-surface`, `--color-elevated`, `--color-sidebar`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-active`
- Gradient accents (`gradient-brand`) remain the same in both themes
- Light values: base `#f8f9fb`, surface `#ffffff`, elevated `#f1f3f7`, sidebar `#ffffff`, border `#e2e5eb`, text-primary `#0f1117`, text-secondary `#374151`, text-muted `#6b7280`

---

## Section D — Notifications

**Route:** `/dashboard/settings/notifications`  
**Access:** All roles

### Bell Icon (Sidebar)
- Position: bottom of sidebar, above the user/logout section
- Shows unread count badge (red dot with number, max "99+")
- Clicking opens an inline dropdown panel (not a separate page) anchored to the sidebar
- Panel shows last 20 notifications, newest first
- "Mark all as read" button at top of panel
- Each notification: icon + message + relative timestamp ("2 hours ago")
- Clicking a notification navigates to the relevant page and marks it read

### Notification Events (in-app + email)
| Event | Who receives |
|---|---|
| Post approved | Post author |
| Post rejected | Post author |
| Post scheduled | Post author |
| Brand created | All admins |
| Brand archived | All admins |
| User invited | Inviting admin |

### Email Toggle Settings
- Per-event toggles saved to `users.preferences` as `{ "notifications": { "post_approved": true, ... } }`
- Default: all on
- UI: list of events with toggle switch per row, save button at bottom

### Backend
- `notifications` table: `id`, `user_id`, `type`, `message`, `link`, `read`, `created_at`
- `GET /notifications` — last 20 for current user
- `POST /notifications/mark-read` — mark all or specific IDs as read
- Notifications are created server-side when the triggering event occurs (post approval, brand creation, etc.)

---

## Section E — Team & Users

**Route:** `/dashboard/settings/team`  
**Access:** Super Admin only (hidden from Admin and User in nav)

### User List
- Table: Avatar initial + Name, Email, Username, Role badge, Status badge, Actions
- Status: `active`, `invited` (invite pending), `disabled`
- Actions per row: Change role (dropdown: Admin / User), Disable account, Resend invite (if status = invited)
- Disabled accounts cannot log in; their data is preserved

### Invite Methods

**1. Email Invite**
- Form: Email address + Role (Admin / User)
- System generates a signed invite token (24h expiry), sends email with link
- User clicks link → `/accept-invite?token=...` → sets username + password → account activated
- Already partially built (`/accept-invite` page exists)

**2. Direct Creation**
- Form: Name, Email, Username, Temporary password, Role
- Account created immediately as `active`
- Super Admin shares credentials manually

**3. Invite Code**
- Button: "Generate Invite Code"
- Generates a single-use code (8 chars, alphanumeric), stored in DB with expiry (7 days) and role
- Displayed in a modal with copy button
- User enters code at `/accept-invite?code=...` → sets name + username + password

### Backend
- `POST /users/invite` — email invite
- `POST /users/create` — direct creation
- `POST /users/invite-code` — generate code
- `GET /users` — list all users (super_admin only)
- `PATCH /users/:id/role` — change role
- `PATCH /users/:id/disable` — disable account
- `POST /users/:id/resend-invite` — resend invite email

---

## Settings Layout

**Shared component:** `SettingsLayout` wraps all settings sub-pages with a left nav.

```
/dashboard/settings/layout.tsx   — SettingsLayout with left nav
/dashboard/settings/page.tsx     — redirects to /settings/profile
/dashboard/settings/profile/page.tsx
/dashboard/settings/security/page.tsx   — already exists, move here
/dashboard/settings/appearance/page.tsx
/dashboard/settings/notifications/page.tsx
/dashboard/settings/team/page.tsx
```

Left nav groups:
- **Account:** Profile, Security, Appearance, Notifications
- **Admin** (super_admin only): Team & Users

---

## UI Standards (all pages)

- All inputs: `rounded-md border border-border bg-surface px-3 py-2 text-sm`
- All selects: `rounded-md appearance-none pr-8` + SVG arrow at `right 10px center`
- Icon buttons paired with inputs: plain `<button>` with `py-2 rounded-md border border-border` (not Button component)
- Colour swatches: styled div with `self-stretch` + hidden `<input type="color">`
- Toggle switches: custom styled, not native checkbox
- Save buttons: full-width gradient Button at bottom of each card

---

## Out of Scope (deferred)

- Audit Log (Section F) — deferred
- WhatsApp / push notifications — deferred
- Guest role — not included
- Changing username post-registration — not allowed
