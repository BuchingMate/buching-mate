import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorResponse } from "@workspace/contracts";

export function apiError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json<ApiErrorResponse>({ error: { code, message } }, status);
}
