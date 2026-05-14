# Onboarding and Invites

## Scope

Onboarding should get a new organization to first value quickly.

Included:

- Create organization.
- Configure categories.
- Optional first event.
- Optional team invites.
- Invite acceptance.

## Onboarding Steps

Initial path:

1. Organization name and slug.
2. Contact email and currency.
3. Land in dashboard with a clear next action to create the first event.

Follow-up path after event creation works:

4. Categories and category colors/icons.
5. Optional first event shortcut during onboarding.
6. Optional team invites.

## Invite Flow

- Admin/owner sends invite by email and role.
- Existing users can accept into the org.
- New users sign up and then accept/join.
- Invite route validates invitation status and expiry.

## Email

Use email templates for invite and registration emails once template system exists.

## Product Constraint

Single-org product UX means joining an invite should be handled carefully if the user already owns an organization. Initial behavior can block or ask them to choose, but multi-org switcher is deferred.
