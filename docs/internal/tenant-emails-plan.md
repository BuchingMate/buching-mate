# Tenant Emails — Product Development Plan

Status: Built — slices 1, 2, 3, 6, 5 all implemented and verified. Server + web
typecheck clean, lint clean, 149 server tests pass (24 new "should" tests).
Migrations 0010 (org_email_domains) and 0011 (broadcasts) generated. Slice 4
(editable templates) is the only remaining item, deferred to a separate PR.
Branch: `claude/tenant-emails` (rebased on `development` @ 5ed40d8)
Owner: Peter Qian

## 1. Problem

Every email the platform sends today goes out from one global address
(`RESEND_FROM_EMAIL`) with platform branding. Recipients see the platform, not
the organization that actually invited or booked them. Organizations on paid
plans expect mail to look like it comes from *them*.

We also want the email identity model to match the plan tiers we already sell:

- **Free** — organization runs on a platform subdomain only. Owns no DNS.
- **Team** — organization may use a custom domain. Owns DNS.

## 2. Current state (verified in code)

Email sending:

- 5 send sites, each with a duplicated `getResend()` and a hardcoded
  `from: RESEND_FROM_EMAIL`:
  - `apps/server/src/auth/email.ts` — org invite
  - `apps/server/src/auth/attendee.ts` — attendee magic link
  - `apps/server/src/services/reminders/index.ts` — event reminder
  - `apps/server/src/services/registrations/email.ts` — booking resume + confirmation (2 sends)
- `orgName` is passed into the body as text only; the FROM address is always the platform.

Data model already present:

- `org_settings.plan` — enum `free | team | enterprise`.
- `org_settings.contactEmail` — usable as reply-to.
- `org_settings.emailTemplates` — jsonb, validated in `api/org.ts` but never read at send time.
- `organization.name` / `organization.slug` — display name + subdomain.

Plan gating already exists for the web custom subdomain:

- `auth.ts:82` — free tier blocked from setting a custom slug ("Custom subdomain requires Team plan").
- `middleware/observability.ts` — `isCustomDomain(host)` already classifies platform vs custom host.

Video integration (recently merged) is relevant:

- Confirmation and reminder emails already render a "Join meeting" button from
  `getJoinUrlForRegistration(orgId, regId)`. The mailer must keep threading
  `joinUrl`; no new content work.
- `video_connections` provides a proven per-org integration pattern (org +
  provider + status enum, encrypted tokens via `lib/crypto`, `registry`/`adapter`,
  `oauth-state`). The team custom-domain feature should mirror this shape rather
  than invent a new one.

## 3. Key constraint: email domain ≠ web domain

Owning `acme.com` for the web app does **not** authorize sending mail from it.
Resend requires its own DKIM/SPF/DMARC verification per sending domain. So:

- Free tenants own no DNS → cannot send from their own domain. Best achievable:
  platform address + branded display name + reply-to.
- Team tenants must still complete a **separate** email-domain verification flow
  even if they already run a custom web domain.

This is the main reason custom sending domains are a distinct, heavier slice.

## 4. Tier behaviour (target)

| Tier | From address | Reply-To | DNS work |
|------|--------------|----------|----------|
| Free | `"<Org Name>" <noreply@platform>` | org contactEmail | none |
| Team (no verified domain yet) | same as free | org contactEmail | none |
| Team (verified domain) | `noreply@<org-domain>` | org contactEmail | DKIM/SPF/DMARC |

Team falls back to platform-with-display-name until its domain verifies.

## 4a. Decisions (locked)

- **Resend model:** one platform Resend account registers each org's domain via
  the Domains API. No per-org API keys stored.
- **Verification trigger:** manual "Verify" button in settings calls Resend verify
  and refreshes status on demand. No background poller.
- **Delivery:** single branch / single PR for slices 1 + 2 + 3 + 5 + 6.
- **Email billing (Luma-aligned — corrected):**
  - **Never metered (free, unlimited):** all transactional + system mail — booking
    confirmation, booking resume, event reminders, attendee magic-link, org invite.
    Charging for the core booking flow is wrong; these stay free at any volume.
  - **Counted (billed):** the only email types an org can *compose and send itself*
    are **newsletters** and **invitations**. An **all-attendee** blast counts toward
    the weekly cap; a send to an **event's own guests** is always free and uncounted
    (matches Luma's "unlimited blasts to event guests").
  - **Quota period:** **weekly** (matches Luma). Base allowance: free 500/week,
    Team 5,000/week, enterprise unlimited.
  - **Cap:** hard stop. A blast that would cross the org's effective weekly cap is
    blocked with a `broadcast_cap_exceeded` 402 + upgrade prompt.
  - **Pricing model (Luma-style tiers, NOT metered):** capacity add-ons are flat
    monthly recurring Polar products bought on top of Team. Each tier is the *total*
    weekly cap (10k/$50, 25k/$200, 50k/$400, 75k/$600, 100k/$800). Defined once in
    `BROADCAST_TIERS` (contracts). There is no per-send metering or usage meter.
  - **Mechanism:** the add-on subscription itself is the charge. `POLAR_BROADCAST_TIERS`
    maps each tier product id to its slug; the Polar webhook routes a tier
    subscription to `org_settings.broadcast_weekly_cap` (set while active, cleared on
    cancel) without touching the Team subscription. `subscription_usage` (weekly
    period) counts billable sends and enforces the cap. Requires the Polar org to
    allow multiple subscriptions, and checkout to carry `metadata.orgId`.
  - **Two product lines:** platform plan (Team / Enterprise) vs email plan (broadcast
    tiers). The webhook resolves a platform plan from `metadata.plan` first, then the
    known Team product id; unrecognized products are ignored (no plan clobber).
    Enterprise is always a custom per-customer deal (bespoke or ad-hoc checkout
    price), so it carries `metadata.plan = "enterprise"` rather than a fixed product
    id, keeping the catalog from blowing up.

## 5. Scope — sequenced slices

### Slice 1 — Tenant-aware mailer foundation (must)
- New module `apps/server/src/services/email/mailer.ts`:
  - one `getResend()`,
  - `sendTenantEmail({ orgId, to, subject, html })` for single transactional sends,
  - `resolveSender(orgId)` → `{ from, replyTo }`.
- Rewire all 5 existing send sites through it; delete duplicated `getResend()`.
  All 5 are transactional/system → **never metered**.
- Dev fallback (no API key) logs, matching today's behaviour.
- Expected schema change: none.
- Note: metering does **not** live here. Only the broadcast send pipeline
  (slice 6) meters; see slice 5.

### Slice 2 — Free-tier branding (must)
- Display name = `organization.name`; reply-to = `org_settings.contactEmail`.
- Applies to all tiers as the default identity.
- Expected schema change: none (reuses existing columns).

### Slice 3 — Team custom sending domain (in scope for first delivery)
- New table `org_email_domains`, mirroring `video_connections`:
  - org id, domain, `resend_domain_id`, status enum
    (`pending | verifying | active | failed`), dns records, timestamps.
- Resend Domains API: create → fetch DNS records → verify → poll status.
- Plan gate identical to `auth.ts:82` subdomain gate (Team+ only).
- Settings UI: show DNS records + verification status.
- Sender resolver upgraded: use verified org domain when `active`, else fall back.

### Slice 6 — Newsletters & invitations (in scope for first delivery)
The billable surface. The only email an org composes and sends itself. Two kinds,
both metered identically:
- **Newsletter** — broadcast to a contact list / past attendees.
- **Invitation** — broadcast inviting recipients to register for an event.

- **Schema (new):**
  - `broadcasts` — id, orgId, optional eventId, kind (`newsletter | invitation`),
    subject, html/body, status (`draft | sending | sent | failed`), audience
    selector, recipient/sent counts, timestamps.
  - `broadcast_recipients` — broadcast id, email, attendee/contact ref, per-send
    status. Used for dedupe and resend safety.
- **Audience selection:** event guests, past attendees, or an org contact list.
  Reuse existing attendee/registration data; CSV import already exists.
- **Send pipeline:** server service that resolves recipients, chunk-batches through
  the slice-1 mailer (tenant sender + verified domain), records per-recipient status,
  partial-failure safe.
- **Composer UI:** admin route to pick kind, write subject + body, choose audience,
  preview, send. Lives under the admin area per route conventions.
- An all-attendee blast counts toward the weekly cap; a send to an event's own
  guests is free and uncounted.

### Slice 5 — Broadcast capacity tiers & cap (in scope for first delivery)
Weekly cap enforcement for the slice-6 pipeline, billed by flat add-on tiers (no
per-send metering).

- **Count at the broadcast send pipeline** (not the transactional mailer). When a
  *billable* blast (all-attendee) sends, `incrementUsage(db, orgId,
  "broadcast_sends", weekStart(), n)` for the `n` sent. Event-guest sends are not
  counted.
- **Usage metric:** `"broadcast_sends"`, weekly period via `weekStart()`.
- **Effective cap:** `org_settings.broadcast_weekly_cap` (set by an active add-on)
  or the plan base (`baseWeeklySends`: free 500, team 5,000, enterprise unlimited).
  Before a billable blast, if `used + recipients > cap`, block with a
  `broadcast_cap_exceeded` 402 + upgrade prompt. Checked at send time.
- **Tiers (`BROADCAST_TIERS`):** flat monthly Polar products, one per capacity tier,
  bought on top of Team. `POLAR_BROADCAST_TIERS` maps product id → slug.
- **Webhook:** a tier subscription sets/clears `org_settings.broadcast_weekly_cap`
  (active → cap, canceled → null) without touching the Team subscription. No meter,
  no ingested events. Needs `allowMultipleSubscriptions` on the Polar org and
  `metadata.orgId` on checkout.

### Slice 4 — Editable templates (done)
- Per-org email brand stored in the `emailTemplates` jsonb (accent color, logo URL,
  footer). Typed as `EmailBranding`; surfaced on `OrgSettingsDto.emailBranding`,
  updated through the org settings endpoint.
- A shared pure `renderBroadcastEmail` (in contracts) wraps every newsletter and
  invitation in the org's brand. The server uses it to send; the web composer uses
  the same function for a live preview, so preview equals what sends.
- Composer redesigned as a split pane: editor on the left, true-to-life email
  preview (rendered in a sandboxed iframe) on the right, with inline brand controls.

### Code/UI review notes (post-build)
- Fixed: broadcast send now claims the draft atomically (conditional update) so a
  double send can't happen; per-recipient status updates batched into one query
  instead of one-per-recipient.
- UI: the original stacked-card composer was replaced to match the "Quiet Workshop"
  doctrine (no card mosaic, one accent, density + spacing first).

## 6. Risks

- Deliverability: a custom display name over the platform domain can hurt SPF
  alignment if done wrong — keep envelope/from on the platform domain for free tier.
- Per-site `orgId` availability — must confirm each send site can resolve an org
  (attendee magic-link path especially).
- Resend domain limits / API quota for slice 3.
- Resend batch/rate limits for large blasts (slice 6) — pipeline must chunk and
  handle partial failure without double-counting the meter.
- Billing accuracy: a blast that sends at Resend but fails to ingest to Polar
  drifts the count. Meter only confirmed sends; tolerate Polar ingest failures by
  logging and reconciling from `subscription_usage`.

## 7. Sequencing & success criteria

Build order (one branch, stacked phases — verify each before the next):

1. Slice 1 → all 5 sites send through one mailer; `bun run typecheck` + `bun test` green.
2. Slice 2 → emails show org name + reply-to; unit test on `resolveSender`.
3. Slice 3 → Team org adds a domain, sees DNS records, reaches `active`, mail sends
   from the org domain; falls back when not verified.
4. Slice 6 → org composes a broadcast, picks an audience, sends; per-recipient
   status recorded; transactional mail unaffected.
5. Slice 5 → a blast increments weekly `broadcast_sends` + ingests to Polar; a free
   org over its weekly allowance is hard-capped with a 402; transactional never
   meters. Unit tests cover the weekly cap + meter increment.
6. Slice 4 → org-edited subject/copy renders (separate PR).

First delivery target: **Slice 1 + 2 + 3 + 6 + 5** (one branch / single PR).
Slice 4 (editable templates) follows separately.

> Scope note: slice 6 (newsletter composer + send pipeline + recipient model) is the
> largest single piece and roughly doubles the effort of the email-domain work.
> Tracked here as one delivery per decision, but it is effectively two features
> (tenant email identity, and broadcasts) shipped together.
