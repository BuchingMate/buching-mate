import { app } from "../../src/app";

export interface ReqOpts {
  method?: string;
  body?: unknown;
  cookie?: string;
  orgId?: string;
  headers?: Record<string, string>;
}

export async function req(path: string, opts: ReqOpts = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(opts.headers ?? {}),
  };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.orgId) headers["X-Org-Id"] = opts.orgId;

  const init: RequestInit = {
    method: opts.method ?? "GET",
    headers,
  };
  if (opts.body !== undefined) {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  return app.fetch(new Request(`http://localhost${path}`, init));
}

export async function asJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
