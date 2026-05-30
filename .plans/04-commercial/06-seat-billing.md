# Seat Billing & Plan Limits (implemented)

Authoritative description of the seat model as built. Supersedes the seat/member
parts of `01-plan-limits.md`.

## Seats

A **seat** is a privileged slot. Only **owner** and **admin** members consume a seat.
**manager** and **viewer** are unlimited and free on every plan. The owner counts
toward the seat total.

- `isSeatedRole(role)` and `SEATED_ROLES` — `apps/server/src/ee/billing/polar.ts`.
- Seat usage = count of owner/admin members: `countSeatedMembers(orgId)`.

## Plans & caps

| Plan | Seat cap | Source | Buy more? |
|------|----------|--------|-----------|
| Free | 3 (hard) | `FREE_SEAT_CAP` constant | No — upgrade to add more |
| Team | purchased seats, 5 included | Polar subscription `seat_count` | Yes, in Polar portal |
| Enterprise | contracted N (uncapped if unset) | `org_settings.enterprise_seat_limit` | No — set out-of-band |

- Cap resolution: `seatCapForPlan({ plan, teamSeats, enterpriseSeatLimit })` (pure) and
  `seatCapFor(orgId)` (async) in `polar.ts`.
- Free total membership is **uncapped** — only the 3 seats are limited; unlimited
  manager/viewer.

## Pricing (Polar)

- **Team:** `$10/seat/mo`, minimum 5 seats → `$50/mo` base covers seats 1–5, each
  seat beyond is `+$10/mo` (prorated). Configure the Team product as seat-based,
  `$10`/seat, and seed checkout with at least 5 seats.
- **Enterprise:** custom contract; seat count set out-of-band, not self-serve.
- No team price is hardcoded in the app; it lives entirely in Polar product config.
  `POLAR_PRODUCT_TEAM` points at the product.

## Enforcement

Seat caps are role-scoped, so they are **not** done via better-auth `membershipLimit`
(which caps total members). `membershipLimit` is set to unbounded. Instead, the org
hooks in `apps/server/src/auth.ts` call `assertSeatAvailableForRole(orgId, role)`:

- `beforeAddMember` — adding an owner/admin.
- `beforeAcceptInvitation` — accepting an invite whose role is owner/admin (seats are
  **not** reserved at invite time, so this re-checks at acceptance).
- `beforeUpdateMemberRole` — only when promoting an unseated role into a seat; a
  seated→seated change or any demotion is always allowed.

`assertSeatAvailableForRole` is a no-op for manager/viewer and throws when
`countSeatedMembers >= seatCapFor`.

## Seat ↔ Polar reconciliation

`syncSeatCount(orgId)` runs after every subscription webhook (`webhook.ts`,
`upsertSubscription`). `shouldSyncSeats` decides the target (pure, unit-tested):

- **Team:** customer owns the number; we only enforce a **floor** — push seats up to
  the seated count when it exceeds purchased seats (covers upgrading from a plan that
  already had more admins than seats bought). Never auto-lower.
- **Enterprise:** **pin** to the contracted limit, reverting any customer portal seat
  edit. Left alone when uncapped.
- **Free:** never seat-billed.

Loop-safe: our `subscriptions.update({ seats })` triggers `subscription.updated`,
which converges (target == stored → no sync).

## Enterprise lock

Customers can self-edit seats in the Polar portal (auto-prorated). Polar's
"Allow price changes" toggle is **org-wide**, so it cannot lock enterprise without
also blocking team resizing — therefore the enterprise lock is **code-only**: the
reconcile pins enterprise seats back to the contracted N.

## Edge cases

- **Free (N members) → Team:** Free caps seats at 3 but not total members, and a prior
  team/enterprise downgrade keeps existing members. On upgrade, the activation webhook
  floors purchased seats up to the current seated count, so the org never under-pays
  and no member is removed.
- **At cap, invites blocked:** the inviter sees the seat-limit error; they buy more
  seats (Team) or upgrade (Free), the webhook raises `seat_count`, the cap lifts.

## Schema

- `org_settings.enterprise_seat_limit` (nullable int) — migration `0016_same_redwing.sql`.

## Known limitation: seat-cap race

`assertSeatAvailableForRole` is not race-proof. better-auth adds members
non-transactionally (`countMembers` → `beforeAddMember` → `createMember`), so the
seat check and the insert are separate steps. Two simultaneous admin-adds to the same
org can both pass the check and exceed the cap by one or two. Accepted as a rare edge
(needs concurrent privileged-role adds to the same org); a read lock in the hook does
not help because the insert is outside our transaction. Covered by billing reconcile
and manual correction rather than a DB trigger.

## Ops / TODO

- Setting enterprise N is out-of-band: `bun run enterprise:seats <orgSlugOrId> <seats|null> [--plan]`
  (`apps/server/scripts/set-enterprise-seats.ts`). No admin UI yet.
- Sandbox-verify that `subscriptions.update({ seats })` works for the seat-based
  (member-model) product and that lowering seats is allowed (we never assign via
  `customer_seats`, so assigned = 0).
- **Checkout seat seeding not possible** via `@polar-sh/better-auth`: its
  `CheckoutParams` has no `seats`/`quantity` field. The Team product's 5-seat minimum
  plus the reconcile floor already start seats correctly; only a custom
  `polar.checkouts.create({ seats })` endpoint could seed an exact number.
- **BLOCKER — customer portal 500s for team customers.** `customer.portal()` and
  `customer.subscriptions.list()` from the plugin call `customerSessions.create` /
  list with only `externalCustomerId` and no `member_id`, which Polar's member model
  requires for team (seat-based) customers. This breaks "Manage subscription" and the
  "buy more seats" loop. Fix needs a server-side `customerSessions.create({
  externalCustomerId, externalMemberId | memberId })`, but the correct member id is
  unknown until the live customer/member structure is inspected in sandbox (we never
  assign members via `customer_seats`). Resolve in sandbox before building.
