# Customer Accounts

## Scope

Customer accounts let a client-facing user manage bookings across tenants.

Important terms:

- `organization`: backend tenant boundary.
- `customer`: logged-in person who owns and manages bookings.
- `attendee`: person attending an event. This can be different from the customer.
- `booking`: customer-facing word for a registration.

Included:

- [ ] Global customer login using the existing Better Auth `user` table.
- [ ] Tenant-scoped customer profiles.
- [ ] Customer-owned registrations.
- [ ] One attendee/participant per booking.
- [ ] Organization search for opt-in listed tenants.
- [ ] Customer portal with bookings, profile, and cancellation when allowed.

Not included in v1:

- [ ] Group or family bookings with multiple attendees.
- [ ] Payment management.
- [ ] Automatic claiming of old guest bookings by email.
- [ ] Renaming admin attendee/registration APIs.

## Data Model

Keep Better Auth as the source of truth for identity.

Add `customers`:

- [ ] `id`.
- [ ] `orgId`, references `organization.id`.
- [ ] `userId`, references `user.id`.
- [ ] `name`.
- [ ] `email`.
- [ ] `phone`.
- [ ] `createdAt`.
- [ ] `updatedAt`.
- [ ] Unique index on `(orgId, userId)`.
- [ ] Index on `userId`.
- [ ] Index on `orgId`.

Update `registrations`:

- [ ] Add nullable `customerId`, references `customers.id`.
- [ ] Keep `attendeeId` required.
- [ ] Existing guest registrations keep `customerId = null`.
- [ ] Customer bookings set `customerId` to the booker profile.

Update `org_settings`:

- [ ] Add `isListed`, default `false`.
- [ ] Add `allowCustomerCancellation`, default `false`.

Do not link customer accounts directly to `attendees`. A customer can book for someone else, so the customer is the owner and the attendee is the participant.

## API

Public organization search:

- [ ] `GET /api/public/orgs?search=...`.
- [ ] Return only organizations with `org_settings.isListed = true`.
- [ ] Match organization name or slug.
- [ ] Limit to 10 results.
- [ ] Return public-safe org data only.

Customer routes use the session user and do not require organization membership:

- [ ] `GET /api/customer/me`.
- [ ] `PATCH /api/customer/me`.
- [ ] `GET /api/customer/bookings`.
- [ ] `POST /api/customer/orgs/:slug/events/:eventId/book`.
- [ ] `PATCH /api/customer/bookings/:registrationId/cancel`.

Booking flow:

1. [ ] Resolve organization by slug.
2. [ ] Require an authenticated user.
3. [ ] Create or update the tenant-scoped customer row for the session user.
4. [ ] Create or update the attendee row for the participant details.
5. [ ] Create registration linked to both `customerId` and `attendeeId`.
6. [ ] Apply existing duplicate, capacity, waitlist, and payment-status rules.

Cancellation rules:

- [ ] Customer can cancel only registrations they own.
- [ ] Tenant must have `allowCustomerCancellation = true`.
- [ ] Registration must belong to an upcoming event.
- [ ] Cancellation sets registration status to `cancelled`.
- [ ] Cancellation keeps the registration visible in customer history.

## Web App

Add customer-facing routes:

- [ ] `/account/login`.
- [ ] `/account/signup`.
- [ ] `/account`.

Customer auth must not trigger admin onboarding. Admin routes still require organization membership through the existing `/admin` guard.

Customer portal v1:

- [ ] Search listed organizations.
- [ ] Open public tenant/event pages from search results.
- [ ] View bookings across tenants.
- [ ] Show event, tenant, participant, status, and payment status.
- [ ] Edit basic customer profile/contact details.
- [ ] Cancel owned bookings only when tenant settings allow it.

Admin settings:

- [ ] Add "Show in customer search" toggle.
- [ ] Add "Allow customer cancellations" toggle.

Public booking page:

- [ ] Keep guest booking working.
- [ ] If customer is signed in, offer to use their customer profile.
- [ ] Let the customer enter participant details when booking for someone else.

## Data Rules

- [ ] Tenants remain isolated by `orgId`.
- [ ] Customer profile rows are tenant-scoped even though login identity is global.
- [ ] A customer can have profiles in many organizations.
- [ ] Staff users can also be customers, but admin access still requires a `member` row.
- [ ] Search does not expose unlisted organizations.
- [ ] Customer booking lists must not leak other customers' registrations.
- [ ] Guest registrations remain manageable only by staff until a dedicated claim flow exists.

## Test Plan

- [ ] Typecheck the monorepo.
- [ ] Build the monorepo.
- [ ] Verify guest public booking still creates `customerId = null`.
- [ ] Verify customer signup/login works without organization membership.
- [ ] Verify customer login does not redirect to admin onboarding.
- [ ] Verify listed organization search returns only opted-in organizations.
- [ ] Verify customer can book for a different attendee.
- [ ] Verify customer can view only their own bookings across tenants.
- [ ] Verify customer cancellation respects ownership, event timing, and tenant setting.
- [ ] Verify admin event registration views still show attendee details correctly.
