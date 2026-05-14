import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import type { ApiErrorResponse } from "@workspace/contracts";

const readCookieHeader = createIsomorphicFn()
  .client((): string | null => null)
  .server((): string | null => getRequestHeader("cookie") ?? null);

const API_BASE_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3456";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestBody = object | unknown[] | null;

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  unauthorizedHandler = handler;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler();
    const apiError = data as ApiErrorResponse | null;
    throw new ApiError(
      response.status,
      apiError?.error?.code ?? "request_failed",
      apiError?.error?.message ?? (text || response.statusText || "Request failed"),
    );
  }

  return data as T;
}

function getHeaders(body: RequestBody | undefined) {
  const headers = new Headers();
  let hasHeaders = false;
  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    hasHeaders = true;
  }

  const cookie = readCookieHeader();
  if (cookie) {
    headers.set("cookie", cookie);
    hasHeaders = true;
  }

  return hasHeaders ? headers : undefined;
}

async function request<T>(method: string, path: string, body?: RequestBody): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: getHeaders(body),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return parseResponse<T>(response);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: RequestBody) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: RequestBody) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: RequestBody) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
