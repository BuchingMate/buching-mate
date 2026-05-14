# Subdomains and Custom Domains

## Scope

Public booking pages should support slug routes, subdomains, and custom domains.

The intended production model is a single multi-tenant app that resolves the
organization from the request host. Each organization can have the default
Buching subdomain, and Pro organizations can add one or more custom
domains.

## Recommended Architecture

- Use Coolify or Dokploy to deploy the app, server, workers, and database on a
  VPS.
- Use Cloudflare DNS for `buching.app`.
- Use Cloudflare for SaaS / SSL for SaaS for Pro custom domains.
- Keep tenant routing inside the app by reading the `Host` header.
- Do not create one app deployment per tenant.

Request flow:

```txt
Visitor
  -> org1.buching.app or events.customer.com
  -> Cloudflare
  -> VPS origin
  -> Hono server / React app
  -> resolve tenant from Host header
```

Cloudflare should handle public DNS, edge TLS, custom hostname validation, and
certificate renewal. Coolify or Dokploy should be treated as the deployment
layer, not as the full custom-domain product.

## Free Plan Domains

Free organizations use Buching-owned subdomains:

```txt
org1.buching.app
coffee-shop.buching.app
```

DNS:

```txt
*.buching.app -> origin.buching.app or VPS/load balancer IP
```

The app should parse the subdomain slug and resolve the organization:

```txt
org1.buching.app -> organization.slug = org1
```

## Pro Custom Domains

Pro organizations can add custom subdomains:

```txt
events.customer.com
booking.customer.com
register.customer.com
```

The onboarding flow should:

1. Accept a custom hostname from the organization settings page.
2. Create a Cloudflare custom hostname through the Cloudflare API.
3. Store the hostname as pending in the database.
4. Show the DNS record the customer needs to add.
5. Poll or webhook-sync Cloudflare status until the hostname is active.
6. Resolve requests for the custom hostname to the owning organization.

Example customer DNS instruction:

```txt
Type: CNAME
Name: events
Value: cname.buching.app
```

Cloudflare keeps the original host on the request, so the app can resolve:

```txt
events.customer.com -> tenant_domains.hostname = events.customer.com
```

## Root Domain Caveat

Do not make root domains the first supported custom-domain path:

```txt
customer.com
```

Root domains are harder because standard DNS does not allow a normal CNAME at
the zone apex. Some DNS providers support ALIAS, ANAME, or CNAME flattening, but
the behavior is provider-specific. Start with customer subdomains and add root
domain support later if customers ask for it.

## Data Model

Custom and platform domains should be modeled separately from the organization
slug so the app can support multiple hostnames per organization.

Suggested table:

```txt
tenant_domains
- id
- organization_id
- hostname
- kind: platform_subdomain | custom_domain
- status: pending | active | failed | disabled
- verification_token
- cloudflare_hostname_id
- created_at
- updated_at
```

Rules:

- `hostname` must be globally unique.
- Custom domains require a Pro plan.
- Disabled domains should not resolve to a tenant.
- Keep `organization.slug` as the source for the default platform subdomain.

## App Routing

The server should resolve tenant context early from the request host:

1. Normalize the host by removing port and lowercasing it.
2. If host matches `*.buching.app`, resolve by organization slug.
3. Otherwise, resolve by `tenant_domains.hostname`.
4. If no tenant is found, return a public 404 or unknown-domain page.
5. Attach the tenant context before loading public events or registration pages.

This keeps public pages, API handlers, SEO metadata, and CORS decisions aligned
around the same tenant lookup.

## Phases

### Phase 1: Slug Routes

- `/book/:slug`.
- Works locally and in all environments.
- Source of truth for initial public booking URLs.

### Phase 2: Subdomains

- `{orgSlug}.buching.app`.
- Detect host on web app.
- Resolve org by subdomain slug.
- Keep path fallback for local development.

### Phase 3: Custom Domains

- Store custom domains in `tenant_domains`, not as a single field on the
  organization.
- Resolve org by request host.
- Gate behind Pro plan.
- Use Cloudflare for SaaS / SSL for SaaS for certificate management.
- Add operational docs for DNS setup, pending status, failed verification, and
  customer support steps.

## CORS

Server CORS must allow trusted wildcard subdomains and configured custom domains without opening credentials to arbitrary origins.

## SEO

Canonical URL should prefer the custom domain if configured, otherwise subdomain, otherwise slug route.

## Deployment Notes

- Coolify and Dokploy are acceptable deployment layers for the VPS.
- The reverse proxy should route the app's own hostnames and the Cloudflare
  origin hostname to the app.
- Avoid relying on the VPS reverse proxy as the primary certificate manager for
  all customer custom domains.
- Caddy On-Demand TLS is a possible lower-cost alternative, but it requires
  owning certificate issuance, abuse protection, rate-limit handling, and a fast
  internal allowlist endpoint. Prefer Cloudflare unless cost forces the
  alternative.
