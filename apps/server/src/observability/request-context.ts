import { AsyncLocalStorage } from "node:async_hooks";
import type { Span } from "@opentelemetry/api";
import type { Logger } from "pino";
import { logger as rootLogger } from "./logger";

type RequestStore = {
  logger: Logger;
  requestId: string;
  span: Span;
};

export const als = new AsyncLocalStorage<RequestStore>();

export function getLogger(): Logger {
  return als.getStore()?.logger ?? rootLogger;
}

export function getRequestId(): string | null {
  return als.getStore()?.requestId ?? null;
}

export function enrichLogger(fields: Record<string, unknown>): void {
  const store = als.getStore();
  if (!store) return;
  store.logger = store.logger.child(fields);
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    store.span.setAttribute(
      `app.${key}`,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    );
  }
}
