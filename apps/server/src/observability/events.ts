import { getLogger } from "./request-context";

type EventName =
  | `event.${"created" | "updated" | "cancelled" | "deleted"}`
  | `registration.${"created" | "statusChanged" | "capacityRejected" | "duplicate" | "cancelled"}`
  | `payment.${"intentCreated" | "succeeded" | "failed" | "refunded"}`
  | `webhook.${"received" | "rejected" | "duplicate"}`
  | `email.${"sent" | "failed"}`
  | `auth.${"loginSucceeded" | "loginFailed" | "inviteCreated" | "inviteAccepted"}`
  | `tenant.${"resolved" | "notFound" | "customDomainHit"}`
  | (string & {});

export function logEvent(name: EventName, fields: Record<string, unknown> = {}): void {
  getLogger().info({ event: name, ...fields }, name);
}

export function logEventError(
  name: EventName,
  err: unknown,
  fields: Record<string, unknown> = {},
): void {
  getLogger().error({ event: name, err, ...fields }, name);
}
