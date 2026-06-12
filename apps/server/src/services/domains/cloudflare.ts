import { env } from "../../env";

// Cloudflare for SaaS custom hostname shapes. Only the fields we read.
export interface CfSslValidationRecord {
  txt_name?: string;
  txt_value?: string;
}

export interface CfCustomHostname {
  id: string;
  hostname: string;
  status?: string;
  ssl?: {
    status?: string;
    validation_records?: CfSslValidationRecord[];
  };
  ownership_verification?: {
    name?: string;
    type?: string;
    value?: string;
  };
}

interface CfApiResponse<T> {
  success: boolean;
  result: T;
  errors?: { code: number; message: string }[];
}

function cfBase(): string {
  return `https://api.cloudflare.com/client/v4/zones/${env.CLOUDFLARE_ZONE_ID}/custom_hostnames`;
}

function cfHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function cfRequest<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: cfHeaders() });
  const body = (await res.json().catch(() => null)) as CfApiResponse<T> | null;
  if (!res.ok || !body?.success) {
    const message = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`cloudflare_api_error: ${message}`);
  }
  return body.result;
}

export async function cfCreateCustomHostname(hostname: string): Promise<CfCustomHostname> {
  return cfRequest<CfCustomHostname>(cfBase(), {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    }),
  });
}

export async function cfGetCustomHostname(id: string): Promise<CfCustomHostname> {
  return cfRequest<CfCustomHostname>(`${cfBase()}/${id}`, { method: "GET" });
}

export async function cfDeleteCustomHostname(id: string): Promise<void> {
  await cfRequest<{ id: string }>(`${cfBase()}/${id}`, { method: "DELETE" });
}
