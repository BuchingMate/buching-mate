# Security

What ships in BuchingMate today and what you, the operator, need to set up
yourself before going live. Written for someone deploying the project, not for
end users.

If you're self-hosting for a single team that all knows each other, you can
skip most of this — the abuse vectors below assume strangers can reach your
signup page. If you're hosting BuchingMate as a multi-tenant SaaS on a public
domain, read all of it.

## Threat model in one paragraph

BuchingMate is a project-and-event tool with a verified email-sending domain,
open signup, and an invite endpoint that mails arbitrary recipients with your
DKIM signature. Three legitimate features — signup, org creation, invite —
chain into a phishing primitive in the wrong hands. The attacker we care about
fills out signup with throwaway email, names the org something like
`Banking Operations 3.4 BTC receipt · click craftum.io`, and fans out invites
to a bought recipient list. No exploit, no CVE, just our reputation borrowed
to launder a scam. See the
[Kaneo incident, May 2026](https://blog.kaneo.app/post/phishing-attack/) for
the playbook.

## What is on by default

These run with no configuration and protect you out of the box.

### Email verification gate

New password signups land with `emailVerified=false`. Better-Auth refuses
sign-in until the user clicks the verification link mailed to them. Google
social signup is auto-verified (Google already confirmed the address).

- Wired: `emailAndPassword.requireEmailVerification` + `emailVerification`
  block in `apps/server/src/auth.ts`.
- Template: `sendVerifyEmail` in `apps/server/src/auth/email.ts`, sent via
  `sendPlatformEmail` (system mailer, not tenant).

### Invite guard on unverified inviters

Belt-and-braces on top of the email-verification gate. Even if a session ever
reaches the invite endpoint without a verified address, the org plugin's
`beforeCreateInvitation` hook throws `"Verify your email before inviting
others"`.

Source: `organizationHooks.beforeCreateInvitation` in `auth.ts`.

### Disposable email blocklist

Signup is rejected for ~3,500 throwaway-email providers (yomail.info,
dropmail.me, spymail.one, etc.) via the
[`disposable-email-domains`](https://github.com/disposable-email-domains/disposable-email-domains)
npm list. Pure local lookup, no API call, no rate limit.

- Source: `apps/server/src/auth/disposable.ts`.
- Wired: `databaseHooks.user.create.before` in `auth.ts`.
- To update the list: `bun update disposable-email-domains` in `apps/server`.

### Organization-name sanitization

Org names land in outbound email subject lines, which is what makes them a
phishing vector. On create and on rename, names are:

- NFKC-normalized.
- Stripped of zero-width and right-to-left override characters.
- Rejected if they contain an explicit URL (`https?://` or `www.`).
- Length-capped at 64 characters.
- Rejected if empty after normalization.

Source: `apps/server/src/auth/org-name.ts`. Enforced in
`organizationHooks.beforeCreateOrganization` and `beforeUpdateOrganization`.

The earlier bare-domain heuristic (rejecting any `word.tld`-shaped token) was
dropped because it flagged legitimate brands (`Acme.io`, `Vue.js`,
`Next.js Berlin`). Bare-domain phishing payloads still slip through this layer
— captcha, the disposable-email blocklist, the verify-email gate, and the
rate-limits below are the other layers that catch them.

### Auth fundamentals

- Better-Auth with password, social (Google, when configured), passkey, and 2FA.
- Cookies `sameSite=lax`, `secure=true` when `COOKIE_DOMAIN` is set.
- Org membership and role enforcement on every tenant-scoped query
  (`apps/server/src/api/org-isolation.test.ts` is the regression net).
- Per-role seat caps by plan (Free 3, Team 5+addons, Enterprise contracted).

### Rate limits

In-process token-bucket limiter (`apps/server/src/middleware/rate-limit.ts`)
applied to two abuse-prone endpoints:

| Endpoint | Key | Capacity | Refill |
| --- | --- | --- | --- |
| `POST /api/auth/send-verification-email` | source IP | 3 | 1 / 5 min |
| `POST /api/auth/organization/invite-member` | inviter user id | 20 | 1 / 3 min (~480/day) |

The invite limit runs inside the `beforeCreateInvitation` hook so it
composes with the verify-email + seat-cap checks. State resets on process
restart; see "Nice to have" below for the multi-instance story.

## What you should configure

Off until you set the relevant env vars. The first three are strongly
recommended for any public-internet deployment.

### Cloudflare Turnstile (CAPTCHA)

Off when `TURNSTILE_SECRET_KEY` is empty. On for `/sign-up/email`,
`/sign-in/email`, and `/request-password-reset` when set.

Steps:

1. dash.cloudflare.com → Turnstile → Add Site. Mode: **Managed**.
2. Hostnames: every domain you serve the widget on. For BuchingMate:
   - `buchingmate.com` (covers `app.`, `admin.`, all subdomains)
   - `lvh.me` (covers `*.lvh.me:5678` for local org-subdomain dev)
   - `localhost` (only if you also hit `http://localhost:5678` directly)
3. Copy the site key and secret key into `.env`:

   ```bash
   TURNSTILE_SECRET_KEY=...
   VITE_TURNSTILE_SITE_KEY=...
   ```

4. Restart the server.

Test keys (no Cloudflare account needed, ship with the repo for local dev):

| Purpose | Site key | Secret key |
| --- | --- | --- |
| Always pass | `1x00000000000000000000AA` | `1x0000000000000000000000000000000AA` |
| Always fail | `2x00000000000000000000AB` | `2x0000000000000000000000000000000AA` |
| Force challenge | `3x00000000000000000000FF` | — |

The site key ships in your web bundle and is hostname-bound at Cloudflare. The
secret key never ships.

Hostname-binding is the real control against token-replay from other origins:
a scraped site key won't mint valid tokens on `phish.example`. Cloudflare's
`siteverify` also returns a `hostname` field we could strict-check as
belt-and-braces, but Better-Auth's captcha plugin ignores it and the hostname
allowlist already blocks the attack. Considered, skipped.

### Staff email-domain allowlist

Useful for staging or internal-only deployments.

```bash
ALLOWED_EMAIL_DOMAINS=yourcompany.com,partner.example
VITE_ALLOWED_EMAIL_DOMAINS=yourcompany.com,partner.example
```

Empty (the default) is unrestricted. Checked in `user.create.before` and
`session.create.before` in `auth.ts`.

### Custom cookie domain

```bash
COOKIE_DOMAIN=.buchingmate.com
```

Required for org subdomain login (`{slug}.buchingmate.com`) to share a session
with the apex.

### Resend (transactional email)

```bash
RESEND_API_KEY=...
RESEND_FROM_EMAIL=invites@buchingmate.com
RESEND_WEBHOOK_SECRET=whsec_...
```

You must verify your sending domain in Resend and add DKIM, SPF, and DMARC
records before live sending. See `docs/integrations/`.

`RESEND_WEBHOOK_SECRET` activates the bounce/complaint webhook ingestion
described under "Resend webhook ingestion" below. Until it is set, the
endpoint at `/api/webhooks/resend` returns 503 and no auto-suspension fires.

### Resend webhook ingestion

Records every `email.sent`, `email.bounced`, `email.complained`, and
`email.delivery_delayed` event into the `email_event` table, tagged with the
originating `org_id` and `kind` (invite, broadcast, etc) via Resend tags set
at send time. Auto-suspends a tenant's sending when complaint rate exceeds
threshold over a rolling window. Platform mail (verification, password reset)
is not tagged and is never blocked.

Setup:

1. Set `RESEND_WEBHOOK_SECRET` in `.env` (the signing secret Resend gives you
   on the next step).
2. In the Resend dashboard → Webhooks → Add endpoint:
   - URL: `https://api.buchingmate.com/api/webhooks/resend`
   - Events: `email.sent`, `email.bounced`, `email.complained`,
     `email.delivery_delayed`.
3. Copy the signing secret into `RESEND_WEBHOOK_SECRET`. Restart.

Auto-suspension rule (`apps/server/src/api/webhooks/resend.ts`):

| Metric | Threshold |
| --- | --- |
| Rolling window | 24 hours |
| Min sends before rule applies | 20 |
| Complaint rate that flips the flag | > 1 % |

When the flag flips, `sendTenantEmail` logs and returns silently — callers
(payment confirmations, invites, reminders) keep flowing without throwing.
`sendBroadcastEmails` returns every recipient as `failed`. The user-visible
effect is that confirmation/invite/reminder mail is dropped on the floor for
that org until the flag is cleared. Operator unsuspends by setting
`org_settings.sending_suspended = false` via Drizzle Studio
(`bun run db:studio`) after reviewing the events. There is no admin UI yet.

## What you must set up outside the app

DNS and account-level setup that the code can't do for you.

- **Domain verification at Resend**, plus SPF
  (`v=spf1 include:_spf.resend.com ~all`), DKIM (records Resend gives you), and
  DMARC (start with `p=none rua=mailto:...`, tighten to `quarantine` once
  you've verified your sources).
- **Cloudflare Turnstile widget**, as above. Hostname list is enforced by
  Cloudflare, not by us.
- **Postgres backups.** The app does not run them. Use managed Postgres or
  `pg_dump` on a schedule. Verify restores; an untested backup is no backup.
- **TLS termination.** Bun does not terminate TLS in production. Put Caddy,
  Nginx, or your platform's load balancer in front.
- **Polar webhook secret.** `POLAR_WEBHOOK_SECRET` in `.env`. The endpoint
  verifies signatures and rejects unsigned bodies.
- **Secrets management.** `.env` is gitignored. Use a secret manager in prod
  (1Password, AWS Secrets Manager, Doppler). Never commit production keys.

## Nice to have

Future improvements. Not blocking. Each is a self-contained todo: problem,
fix, rough size.

### Sending subdomain split

**Problem.** All outbound mail goes through one Resend identity today. If a
tenant burns reputation (spam complaints), password resets and billing
receipts go to spam with it. Single fate-share. The complaint-rate
auto-suspend (above) reduces blast radius but doesn't isolate system mail.

**Fix.** Two DNS subdomains, two Resend API keys.

- `tx.buchingmate.com` — system mail (verify, password reset, billing).
  Stable, low volume, trusted.
- `invites.buchingmate.com` — user-triggered (invites, broadcasts). Volatile,
  can be burned without nuking system.

Code split: two `Resend` client instances in
`apps/server/src/services/email/mailer.ts`. `sendPlatformEmail` uses system
key; `sendTenantEmail` uses tenant key. Add envs:

```bash
RESEND_SYSTEM_API_KEY=...
RESEND_TENANT_API_KEY=...
RESEND_SYSTEM_FROM=system@tx.buchingmate.com
RESEND_TENANT_FROM=noreply@invites.buchingmate.com
```

Keep `RESEND_API_KEY` + `RESEND_FROM_EMAIL` as fallbacks during migration;
remove after both new keys are in place.

**Lift.** ~half day end-to-end: DNS records + Resend domain verify + two API
keys + code split + production cutover.

### Multi-instance rate limiter

**Problem.** The `rateLimit` middleware uses an in-process `Map`. It resets
on every server restart. With two Bun replicas behind a load balancer, an
attacker gets `2 × capacity`.

**Fix.** Swap the `Map` for Redis or Cloudflare KV. Same interface
(`TokenBucketStore.consume(key)`), different backing store. Call sites
unchanged.

**Lift.** ~half day, once you actually run more than one process. No urgency
at one instance.

### Admin UI for suspended-sending flag

**Problem.** Operator currently clears `org_settings.sending_suspended` via
Drizzle Studio. Works but is friction during an incident.

**Fix.** A staff-only admin route listing suspended orgs with a button to
unsuspend after review.

**Lift.** ~2 hours.

### Replay of dropped emails after unsuspend

**Problem.** When `sending_suspended=true`, `sendTenantEmail` silently drops
the message. There is no queue and no retry after unsuspend; the email is
lost. Booking confirmations and reminders that happened during the suspension
window never reach the customer.

**Fix.** Queue dropped sends to a table (`pending_tenant_email`) when
suspended, replay on unsuspend.

**Lift.** ~half day. Defer unless dropped sends become a real support
problem.

## Operator-side items (not code)

### Postgres backups + restore drill

**Problem.** Code can't run backups for you. Without backups + a tested
restore, a corruption or fat-finger `DROP` is unrecoverable.

**Fix.** Managed Postgres with point-in-time recovery (Neon, Supabase, RDS)
OR `pg_dump` on cron → S3 + lifecycle policy. Do a restore drill once: spin
a fresh DB, restore from yesterday's backup, point a staging server at it,
sign in.

**Lift.** Depends on hosting. Managed = ~1 hour. Self-rolled = ~1 day.

### TLS termination

**Problem.** Bun speaks HTTP. Production needs HTTPS — browser cookies
require `Secure`, auth tokens can't be on the wire in cleartext.

**Fix.** Caddy or Nginx reverse-proxy with automatic Let's Encrypt cert. Or
use a platform LB (Fly, Render, Cloudflare Tunnel, ALB) that terminates TLS
for you.

**Lift.** ~half day first time, near-zero after.

### Secrets manager for production

**Problem.** `.env` is fine for dev but in prod you don't want secrets in
plaintext on disk, in CI logs, or on one engineer's laptop.

**Fix.** 1Password Secrets Automation, AWS Secrets Manager, Doppler,
Infisical, or platform-built-in (Fly secrets, Cloudflare env). Inject at
deploy time.

**Lift.** ~half day to set up, depends on platform.

### DMARC tighten to `p=quarantine`

**Status (2026-05-30).** DMARC is now live at `p=none` (monitor only). SPF and
DKIM were already active; DMARC was the missing piece. Record published in
Cloudflare DNS at `_dmarc.buchingmate.com`:

```
v=DMARC1; p=none; rua=mailto:dmarc@buchingmate.com; fo=1; adkim=s; aspf=s
```

| Tag | Meaning |
|-----|---------|
| `p=none` | Monitor only — failing mail still delivered, no enforcement. |
| `rua=mailto:dmarc@buchingmate.com` | Aggregate reports go here. |
| `fo=1` | Report on any auth failure. |
| `adkim=s; aspf=s` | Strict alignment — auth domain must exactly match the From. |

**Problem.** `p=none` only watches; it does not stop spoofing yet. Spammers can
still spoof the domain and recipients have no signal it's fake.

**Fix (the ramp).** Run `p=none` for 2–4 weeks, confirm via the `rua=` mailbox
that all legit mail is SPF + DKIM aligned, then:

```
p=none → p=quarantine (add pct=25 to ramp) → p=reject
```

`p=quarantine` sends spoofed mail to spam; `p=reject` drops it. Each step is one
Cloudflare DNS edit: change the `p=` value, keep the rest.

**Before tightening:**

- [ ] Confirm `dmarc@buchingmate.com` inbox exists, or reports bounce → blind.
- [ ] Point `rua=` at a report parser (Postmark DMARC / dmarcian free tier);
      raw XML is unreadable by hand.
- [ ] Watch reports ~2–4 weeks. Target review: ~2026-06-13.
- [ ] Flip `p=none` → `p=quarantine` (with `pct=25`), then later → `p=reject`.

**Lift.** One DNS record edit per step. Risk: if any legit sender (HR tool,
marketing app) sends as you without DKIM, that mail starts bouncing at
quarantine/reject. Hence the monitor period first.

> Note: initial publish had a name typo (`_dmrac`); corrected to `_dmarc` and
> confirmed live on all resolvers 2026-05-30.

### `security@buchingmate.com` alias

**Problem.** This doc tells researchers to report to
`security@buchingmate.com`, but the alias doesn't exist yet.

**Fix.** Configure as a forwarding alias to whoever triages. Cloudflare Email
Routing, Google Workspace group, or whatever your mail provider supports.

**Lift.** ~10 min.

## Production checklist

Before you make BuchingMate reachable from the public internet:

- [ ] `TURNSTILE_SECRET_KEY` and `VITE_TURNSTILE_SITE_KEY` set to real
      (non-test) Cloudflare keys.
- [ ] Cloudflare Turnstile hostname list contains exactly the production
      domains.
- [ ] `RESEND_API_KEY` set, `RESEND_FROM_EMAIL` uses a domain whose
      DKIM/SPF/DMARC are verified at Resend.
- [ ] `COOKIE_DOMAIN` set to your apex (e.g. `.buchingmate.com`).
- [ ] `BETTER_AUTH_SECRET` rotated from the example value, at least 32 random
      bytes.
- [ ] `POLAR_WEBHOOK_SECRET` set if billing is live.
- [ ] `RESEND_WEBHOOK_SECRET` set and the Resend dashboard webhook subscribed
      to `email.sent`/`bounced`/`complained`/`delivery_delayed`.
- [ ] Postgres backups scheduled and a restore tested at least once.
- [ ] TLS terminates in front of the Bun server (Caddy/Nginx/platform LB).
- [ ] Logs leave the server; you can grep them during an incident.
- [ ] You know how to revoke the Resend API key in under a minute.

## Verifying controls work

Quick smoke tests for the controls above.

**Disposable email blocked**

```bash
curl -i -X POST http://localhost:3456/api/auth/sign-up/email \
  -H "content-type: application/json" \
  -H "x-captcha-response: <valid-token>" \
  -d '{"name":"x","email":"x@yomail.info","password":"Passw0rd!"}'
# expect 400 "Please use a permanent email address"
```

**Captcha enforced**

```bash
curl -i -X POST http://localhost:3456/api/auth/sign-up/email \
  -H "content-type: application/json" \
  -d '{"name":"x","email":"x@example.com","password":"Passw0rd!"}'
# expect 403 (no x-captcha-response header)
```

**Captcha actually verifies (not just header-present)**

Set `TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA`
(always-fail test key), restart, confirm signup returns 403 even when the
widget produces a token.

**Org-name sanitizer**

```bash
curl -i -X POST http://localhost:3456/api/auth/organization/create \
  -H "cookie: <session>" \
  -H "content-type: application/json" \
  -d '{"name":"Receipt at craftum.io now","slug":"test"}'
# expect 400 "Organization name cannot contain URLs"
```

**Org-name zero-width strip**

Unit-tested in `apps/server/src/auth/org-name.test.ts`. Run
`bun test src/auth/org-name.test.ts` from `apps/server` (requires Postgres
up; the test preload connects to the DB even though this test doesn't touch
it).

**Email verification gate**

```bash
# Sign up a fresh user. With requireEmailVerification on, sign-in should fail
# until the verification link is clicked.
curl -i -X POST http://localhost:3456/api/auth/sign-up/email \
  -H "content-type: application/json" \
  -H "x-captcha-response: <valid-token>" \
  -d '{"name":"x","email":"x@example.com","password":"Passw0rd!"}'
# then
curl -i -X POST http://localhost:3456/api/auth/sign-in/email \
  -H "content-type: application/json" \
  -H "x-captcha-response: <valid-token>" \
  -d '{"email":"x@example.com","password":"Passw0rd!"}'
# expect 403 / "email not verified"
```

## Incident playbook

If you see a mass-signup or mass-invite pattern that looks like the Kaneo
attack:

1. **Revoke the Resend API key** in the Resend dashboard. This stops outbound
   mail before you do anything else.
2. **Disable signup.** There is no built-in flag for this yet; the fastest
   workaround is to set `ALLOWED_EMAIL_DOMAINS=internal.invalid` and restart
   — every new signup is now rejected at `user.create.before`.
3. **Dump the bot accounts to CSV** for forensics and to hand to Resend if
   they ask:

   ```sql
   COPY (
     SELECT u.id, u.email, u.created_at, o.id AS org_id, o.name AS org_name
     FROM "user" u
     LEFT JOIN member m ON m.user_id = u.id
     LEFT JOIN organization o ON o.id = m.organization_id
     WHERE u.created_at > NOW() - INTERVAL '24 hours'
     ORDER BY u.created_at
   ) TO STDOUT WITH CSV HEADER;
   ```

4. **Clean up in one transaction.** Run with `ROLLBACK` first to verify
   counts, then re-run with `COMMIT`. Foreign-key cascades handle invites.
5. **Rotate** `RESEND_API_KEY` and `BETTER_AUTH_SECRET`. Re-enable signup.
6. **Write up what happened** and update this doc with whatever new control
   you wished you'd had.

## Reporting a vulnerability

Email `security@buchingmate.com` (TODO: set up this alias). Please don't open
public GitHub issues for security bugs; we'll credit you in the release notes
if you'd like.
