import "./observability/otel";
import { app } from "./app";
import { logger } from "./observability/logger";

const port = Number(Bun.env.SERVER_PORT ?? 3456);

Bun.serve({
  port,
  fetch: app.fetch,
});

logger.info({ port }, "server started");
