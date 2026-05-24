import { eq } from "drizzle-orm";
import { auth } from "../../src/auth";
import { db } from "../../src/db";
import { member, organization, user as userTable } from "../../src/db/schema";
import type { OrgRole } from "@workspace/contracts";

function uniqueId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function extractCookieHeader(res: Response): string {
  const cookies =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : ((res.headers.get("set-cookie") ?? "")
          .split(/,(?=\s*[^;\s]+=)/g)
          .filter(Boolean) as string[]);
  return cookies
    .map((c) => c.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

export interface SignedUpUser {
  userId: string;
  email: string;
  cookie: string;
}

export async function signUpUser(): Promise<SignedUpUser> {
  const email = `test-${uniqueId()}@example.com`;
  const password = "password1234";
  const name = "Test User";

  const res = await auth.api.signUpEmail({
    body: { email, password, name },
    asResponse: true,
  });

  if (!res.ok) {
    throw new Error(`signUpEmail failed: ${res.status} ${await res.text()}`);
  }

  const cookie = extractCookieHeader(res);
  const rows = await db.select().from(userTable).where(eq(userTable.email, email)).limit(1);
  const userId = rows[0]?.id;
  if (!userId) throw new Error("user not found after signup");

  return { userId, email, cookie };
}

export interface OrgFixture extends SignedUpUser {
  orgId: string;
}

export async function signUpAndCreateOrg(): Promise<OrgFixture> {
  const owner = await signUpUser();
  const slug = `test-org-${uniqueId()}`;

  const org = await auth.api.createOrganization({
    body: { name: "Test Org", slug, userId: owner.userId },
    headers: new Headers({ cookie: owner.cookie }),
  });

  if (!org) throw new Error("createOrganization returned null");
  return { ...owner, orgId: org.id };
}

export async function addUserToOrg(orgId: string, role: OrgRole = "viewer"): Promise<SignedUpUser> {
  const u = await signUpUser();
  await db.insert(member).values({
    id: crypto.randomUUID(),
    userId: u.userId,
    organizationId: orgId,
    role,
    createdAt: new Date(),
  });
  return u;
}

export async function getOrgSlug(orgId: string): Promise<string> {
  const rows = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, orgId))
    .limit(1);
  return rows[0]?.slug ?? "";
}
