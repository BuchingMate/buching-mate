import "./observability/otel";
import { app } from "./app";
import { logger } from "./observability/logger";
import { startReminderScheduler } from "./services/reminders";

const port = Number(Bun.env.SERVER_PORT ?? 3456);

Bun.serve({
  port,
  fetch: app.fetch,
});

if (Bun.env.NODE_ENV !== "test") {
  startReminderScheduler();
}

logger.info({ port }, "server started");
