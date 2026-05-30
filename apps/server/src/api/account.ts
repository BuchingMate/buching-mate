import { Hono } from "hono";
import { auth } from "../auth";
import { requireAuth } from "../middleware/auth";
import { apiError } from "./errors";
import { isRecord, readJson } from "./validation";
import type { ApiEnv } from "./types";

// Lets a user who signed up via a social provider (no password credential) set an
// initial password. better-auth's setPassword is server-only; the request's session
// proves identity, so no current password is required.
export const accountRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth)
  .post("/set-password", async (c) => {
    const body = await readJson(c);
    const newPassword =
      isRecord(body) && typeof body.newPassword === "string" ? body.newPassword : undefined;

    if (!newPassword || newPassword.length < 8) {
      return apiError(c, 400, "invalid_password", "Password must be at least 8 characters");
    }

    try {
      await auth.api.setPassword({ body: { newPassword }, headers: c.req.raw.headers });
    } catch (err) {
      console.error("setPassword failed", err);
      const message = err instanceof Error ? err.message : "Unable to set password";
      return apiError(c, 400, "set_password_failed", message);
    }

    return c.json({ set: true });
  });
