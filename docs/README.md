# Docs

Source for the Buching user manual, integrator reference, and internal support runbooks. Markdown lives here in the repo; a public help site can render from this tree later.

## Categories

- [User guide](./user-guide/) — for org owners, admins, managers, and viewers using the dashboard.
- [Integrations](./integrations/) — for developers and tenants building against webhooks and APIs.
- [Support](./support/) — internal runbooks for triaging customer issues.

## Background

- [Product description](./product-description.md) — what Buching is and who it's for.
- [Design philosophy](./design-philosophy.md) — UX and product principles.
- [Best practices](./best-practices.md) — engineering conventions.

## Conventions

- One topic per file. Keep filenames lowercase with hyphens (`payments-setup.md`).
- Lead each doc with a one-sentence summary so a search result preview is useful on its own.
- Link between docs using relative paths so the tree works both in GitHub and in a future static site.
- Put screenshots under `docs/<category>/images/` and reference with relative paths.
