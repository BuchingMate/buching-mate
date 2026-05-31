# Routing

How requests get split between staff (admins) and attendees (customers).

## TL;DR

One app, one `/login` route. **Hostname** decides who sees what.

| Host shape | Audience | Login UI |
|---|---|---|
| Root (`buchingmate.com`) | Staff | Email + password |
| `<slug>.buchingmate.com` | Attendee of that org | Magic link |

No separate `/admin/login` or `/customer/login` path. Same component, branches on the request host.

## How it works

1. `apps/web/src/lib/public.ts:128` — `extractPublicSlug(hostname)` reads the label before the public root.
   - Public root = `VITE_PUBLIC_SITE_URL`'s hostname (e.g. `buchingmate.com`).
   - `acme.buchingmate.com` → slug `acme`.
   - `buchingmate.com` → `null`.
2. `apps/web/src/routes/login.tsx:22-25` — loader sets `isAttendee = slug !== null`.
3. Component picks `<StaffLogin>` or `<AttendeeLogin>` based on that flag.

After login:
- Staff land at `/admin/*` (tenant chosen from session's org membership).
- Attendees land at `/me` (their account on the org they signed in to).

## Domain setup

You need **one root domain** + **wildcard DNS** + **wildcard TLS cert**.

| Env | Local | Prod |
|---|---|---|
| `WEB_URL` | `http://localhost:5678` | `https://buchingmate.com` |
| `VITE_PUBLIC_SITE_URL` | `http://lvh.me:5678` | `https://buchingmate.com` |
| `PUBLIC_HOST_ALLOWLIST` | `.lvh.me,.localhost,localhost` | `.buchingmate.com` (optional; auto-derived from VITE_PUBLIC_SITE_URL) |

Staging: set `VITE_PUBLIC_SITE_URL = WEB_URL = https://staging.buchingmate.com`. Wildcard A record `*.staging.buchingmate.com` → server.

`lvh.me` works in dev because it's a public DNS hack: `*.lvh.me` resolves to `127.0.0.1`. So `http://acme.lvh.me:5678` hits your local Vite without editing `/etc/hosts`.

## Cookies + sessions

Staff session cookie must work across root + subdomains so an admin signed in at `buchingmate.com` stays signed in if they hop to `<their-slug>.buchingmate.com`.

- Cookie domain: `.buchingmate.com` (leading dot).
- Passkey RP ID: same root (`buchingmate.com`) — see `apps/server/src/auth.ts:55` `passkeyRpId()` and `docs/internal/security.md`.

## Attendee auth is separate

Attendees use a different better-auth client (`attendeeAuthClient`) backed by magic links, not the staff email/password flow. Their sessions are scoped to the org subdomain. Email-domain allowlist (`ALLOWED_EMAIL_DOMAINS`) only gates **staff** signup — attendees can use any email.

## Common gotchas

- **Forgot the wildcard cert.** Org subdomain shows a TLS warning. Fix: include `*.buchingmate.com` SAN on the cert.
- **`PUBLIC_HOST_ALLOWLIST` not set for a custom staging domain.** Server rejects the request before the React app loads. Add the suffix (`.staging.buchingmate.com`).
- **`VITE_PUBLIC_SITE_URL` mismatches `WEB_URL` host root.** Then `extractPublicSlug` returns null on what looks like a subdomain — attendees get the staff login UI. Keep them on the same root.
