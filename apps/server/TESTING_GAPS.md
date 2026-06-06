# Server Test Gaps & Findings

Snapshot of `bun:test` coverage for `apps/server`, framed by point-of-view and case type, plus findings surfaced while adding coverage (2026-06-06).

## How to run locally

The local harness has an env-loading quirk: Bun loads the **monorepo-root `.env`** (remote DB, real Stripe/Zoom creds) and it overrides `--env-file=.env.test`. Source `.env.test` into the process env first so it wins:

```bash
cd apps/server
bun run db:up            # from repo root: local Postgres on :5433
bun run test:db:setup    # create buching_test DB + role
set -a && . ./.env.test && set +a && bun test
```

> The `bun --env-file=.env.test test` package script is **not reliable locally** because Bun loads the monorepo-root `.env` over it. CI is unaffected (no root `.env` present); `.github/workflows/test.yml` runs this suite against a Postgres service.

## Newly added (this pass)

| Area                  | File                                | POV   | Cases                                                                                 |
| --------------------- | ----------------------------------- | ----- | ------------------------------------------------------------------------------------- |
| Attendee CRUD         | `src/api/attendees.test.ts`         | Admin | create/list/search/get/patch + 401/403/400/404, org-isolation, dup-email              |
| Registration mutation | `src/api/registrations-api.test.ts` | Admin | create/patch/delete + role gates, 409 duplicate, invalid status, org-isolation        |
| Org member mgmt       | `src/api/org-members.test.ts`       | Admin | list/role-change/remove + admin gate, cannot_remove_owner, 501 invites, org-isolation |

Helper fix (`test/helpers/auth.ts`): signups now mark the user verified and sign in, so `signUpAndCreateOrg` yields a real session. Without it every org-based test 401s, because `requireEmailVerification: true` means `signUpEmail` issues no session.

## Findings (surfaced + fixed this pass)

1. **Duplicate attendee create returned 500, now 409 (fixed).** `(orgId, email)` is unique; `POST /api/attendees` now catches the `23505` violation and returns `duplicate_attendee` / 409, matching how registrations handle duplicates.
2. **10 pre-existing failures from event-model rot (fixed).** `events.test.ts`, `plan-gating.test.ts`, the import test in `video.test.ts`, and `broadcasts/send.test.ts` built event fixtures missing the now-required `videoProvider` (`'zoom'` or `null`). They were masked because the broken auth helper made them 401 first, and no CI ran them. Fixtures updated; the broadcast count failures were the root-`.env` `RESEND_API_KEY` leak (blanked in `.env.test` to force the dev mailer).
3. **No CI ran `apps/server` tests (fixed).** Added `.github/workflows/test.yml` running the suite against a Postgres service on push/PR.

Full suite now: **283 pass, 0 fail.**

## Remaining gaps (untested, by POV)

### Customer / attendee

- Public pages: org profile, event listing, event detail (no-auth) — covered by E2E now, no server test
- Magic-link attendee login
- Public register endpoint input validation at the API edge (bad email, missing name)

### Admin / staff

- Broadcast CRUD — only `send` (service) is tested; create/list/edit/preview/delete routes untested
- Org settings PATCH (name/logo/contact/timezone) and email-domain routes
- Account: password change, 2FA enable/disable
- Billing portal / checkout endpoints
- Assets upload (R2)

### Edge cases worth adding

- Registration: promote from waitlist when a confirmed spot frees up
- Bulk registration import: partial-failure reporting, duplicate rows
- Seat-limit enforcement at the (future) invite endpoint once `/invites` is implemented (currently 501)
