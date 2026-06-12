import { describe, expect, test } from "bun:test";
import { signUpAndCreateOrg } from "../test/helpers/auth";
import { req } from "../test/helpers/request";
import { createCustomDomain, removeCustomDomain } from "./services/domains";

function preflight(origin: string) {
  return req("/api/public/events", {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
    },
  });
}

describe("CORS for custom domains", () => {
  test("main-domain suffix allowlist still works", async () => {
    const res = await preflight("http://anything.lvh.me:5678");
    expect(res.headers.get("access-control-allow-origin")).toBe("http://anything.lvh.me:5678");
  });

  test("unknown origin gets no ACAO header", async () => {
    const res = await preflight("https://stranger.example.com");
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("active custom-domain origin is allowed; removed again after deletion", async () => {
    const org = await signUpAndCreateOrg();
    const hostname = `cors-${Date.now()}.example.com`;
    await createCustomDomain(org.orgId, hostname); // dev mode → active + cache invalidated

    const allowed = await preflight(`https://${hostname}`);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(`https://${hostname}`);

    await removeCustomDomain(org.orgId);
    const denied = await preflight(`https://${hostname}`);
    expect(denied.headers.get("access-control-allow-origin")).toBeNull();
  });
});
