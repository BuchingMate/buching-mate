# Plan Limits

## Scope

Use plan limits without SaaS subscription checkout.

Do not implement Polar billing in the current scope.

## Plans

Start with:

- Free.
- Pro.

Plan can be manually set in the database or admin tooling until SaaS billing is introduced.

## Candidate Limits

Free:

- 1 published event.
- 2 team members.
- No custom domains.
- No org webhooks.
- Basic resources.

Pro:

- Unlimited published events.
- More team members or unlimited.
- Custom domains.
- Org webhooks.
- Advanced payment/provider features if needed.

## Enforcement Points

- Publishing event.
- Inviting team members.
- Enabling custom domain.
- Enabling webhook URL.

## UI

- Show upgrade prompts but do not wire checkout.
- Make copy clear: plan upgrades are not self-serve yet.
- Avoid dead checkout buttons.
