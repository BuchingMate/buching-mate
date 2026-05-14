# Shared Contracts

## Goals

- Keep API payloads and domain enums shared between web and server.
- Avoid duplicating hand-written request/response types across apps.
- Keep contracts dependency-light.

## Package Location

Use `packages/contracts/src/index.ts` and split later only when it grows too large.

## Exports

### Enums as Type Unions

- `OrgRole`.
- `OrgPlan`.
- `ResourceType`.
- `EventStatus`.
- `EventVisibility`.
- `RegistrationStatus`.
- `PaymentStatus`.
- `WebhookDeliveryStatus`.

### Domain DTOs

- `OrganizationDto`.
- `OrgSettingsDto`.
- `MemberDto`.
- `ResourceDto`.
- `EventDto`.
- `EventResourceDto`.
- `AttendeeDto`.
- `RegistrationDto`.
- `PaymentConnectionDto`.
- `WebhookDeliveryDto`.

### Request Types

- `CreateResourceRequest`, `UpdateResourceRequest`.
- `CreateEventRequest`, `UpdateEventRequest`.
- `CreateAttendeeRequest`, `UpdateAttendeeRequest`.
- `CreateRegistrationRequest`, `UpdateRegistrationRequest`.
- `PublicRegistrationRequest`.
- `UpdateOrgSettingsRequest`.

### Response Types

- `ApiErrorResponse`.
- `ListEventsResponse`.
- `PublicOrgResponse`.
- `PublicEventResponse`.
- `DashboardSummaryResponse`.

## Validation

Server route validation can use Zod locally. Only move schemas into contracts if both client and server need runtime validation from the same source.
