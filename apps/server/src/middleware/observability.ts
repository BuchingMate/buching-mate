import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import { logger as rootLogger } from "../observability/logger";
import { als } from "../observability/request-context";
import { BUSINESS_SLUG } from "../branding";

const tracer = trace.getTracer(`${BUSINESS_SLUG}-server`);

const PLATFORM_HOST_SUFFIXES = (
  process.env.PLATFORM_HOST_SUFFIXES ?? ".lvh.me,.localhost,localhost"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isCustomDomain(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.split(":")[0]!;
  for (const suffix of PLATFORM_HOST_SUFFIXES) {
    if (suffix.startsWith(".")) {
      if (hostname.endsWith(suffix) || hostname === suffix.slice(1)) return false;
    } else if (hostname === suffix) {
      return false;
    }
  }
  return true;
}

export const observability: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
  c.header("x-request-id", requestId);

  const tenantHost = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? null;
  const customDomain = isCustomDomain(tenantHost);
  const method = c.req.method;
  const path = c.req.path;

  const span = tracer.startSpan(`${method} ${path}`, {
    attributes: {
      "http.method": method,
      "http.target": path,
      "http.request_id": requestId,
      "http.host": tenantHost ?? "",
      "http.custom_domain": customDomain,
    },
  });

  const requestLogger = rootLogger.child({ requestId, method, path, tenantHost, customDomain });
  const start = performance.now();

  try {
    await als.run({ logger: requestLogger, requestId, span }, () => next());
    const status = c.res.status;
    span.setAttribute("http.status_code", status);
    if (status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    requestLogger.error({ err }, "request failed");
    throw err;
  } finally {
    const durationMs = Math.round(performance.now() - start);
    requestLogger.info({ status: c.res?.status, durationMs }, "request");
    span.end();
  }
};
