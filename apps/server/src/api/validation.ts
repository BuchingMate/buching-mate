import type { Context } from "hono";

export async function readJson(c: Context) {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringOrNull(value: unknown) {
  return typeof value === "string"
    ? value
    : value === null || value === undefined
      ? null
      : undefined;
}

export function integerOrNull(value: unknown) {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : value === null || value === undefined
      ? null
      : undefined;
}

export function optionalString(value: unknown) {
  return typeof value === "string" ? value : value === undefined ? undefined : null;
}

export function optionalInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : value === undefined
      ? undefined
      : null;
}
