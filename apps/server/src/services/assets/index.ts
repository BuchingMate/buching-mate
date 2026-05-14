import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  CreatePublicAssetUploadRequest,
  CreatePublicAssetUploadResponse,
  PublicAssetDto,
  PublicAssetKind,
  PublicAssetRole,
} from "@workspace/contracts";
import { and, eq } from "drizzle-orm";
import { db } from "../../db";
import { events, organization, publicAssets } from "../../db/schema";
import { getPublicAssetBaseUrl, publicUrlForKey } from "./public-url";

const UPLOAD_EXPIRES_SECONDS = 5 * 60;
const MAX_SIZE: Record<PublicAssetKind, number> = {
  org_logo: 2 * 1024 * 1024,
  event_image: 8 * 1024 * 1024,
};
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const assetRoles: PublicAssetRole[] = ["cover", "detail"];

type UploadError =
  | "asset_config_missing"
  | "invalid_asset_kind"
  | "invalid_file_type"
  | "file_too_large"
  | "event_required"
  | "event_not_found";

type ConfirmError =
  | "asset_config_missing"
  | "asset_not_found"
  | "upload_not_found"
  | "invalid_file_type"
  | "file_too_large";

type DeleteError = "asset_not_found";

function toPublicAssetDto(asset: typeof publicAssets.$inferSelect): PublicAssetDto {
  return {
    id: asset.id,
    orgId: asset.orgId,
    eventId: asset.eventId,
    kind: asset.kind,
    role: asset.assetRole as PublicAssetRole,
    key: asset.key,
    publicUrl: publicUrlForKey(asset.key) ?? asset.publicUrl,
    contentType: asset.contentType,
    size: asset.size,
    status: asset.status,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}

function getConfig() {
  const accountId = Bun.env.R2_ACCOUNT_ID;
  const accessKeyId = Bun.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = Bun.env.R2_SECRET_ACCESS_KEY;
  const bucket = Bun.env.R2_BUCKET;
  const publicBaseUrl = getPublicAssetBaseUrl();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return null;
  }

  return {
    bucket,
    publicBaseUrl,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function extFor(contentType: string) {
  return EXTENSIONS[contentType.toLowerCase()] ?? null;
}

function maxSizeFor(kind: PublicAssetKind) {
  return MAX_SIZE[kind];
}

function isAssetKind(value: string): value is PublicAssetKind {
  return value === "org_logo" || value === "event_image";
}

function cleanKind(kind: string): PublicAssetKind | null {
  return isAssetKind(kind) ? kind : null;
}

function cleanRole(role: unknown): PublicAssetRole {
  if (typeof role !== "string") return "cover";
  return assetRoles.includes(role as PublicAssetRole) ? (role as PublicAssetRole) : "cover";
}

async function eventExists(orgId: string, eventId: string) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1);
  return rows.length > 0;
}

function makeKey(input: {
  orgId: string;
  eventId: string | null;
  assetId: string;
  kind: PublicAssetKind;
  ext: string;
}) {
  if (input.kind === "org_logo") {
    return `orgs/${input.orgId}/logo/${input.assetId}.${input.ext}`;
  }

  return `orgs/${input.orgId}/events/${input.eventId}/${input.assetId}.${input.ext}`;
}

export async function createPublicAssetUpload(
  orgId: string,
  input: CreatePublicAssetUploadRequest,
): Promise<CreatePublicAssetUploadResponse | UploadError> {
  const config = getConfig();
  if (!config) return "asset_config_missing";

  const kind = cleanKind(input.kind);
  if (!kind) return "invalid_asset_kind";

  const ext = extFor(input.contentType);
  if (!ext) return "invalid_file_type";

  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > maxSizeFor(kind)) {
    return "file_too_large";
  }

  const eventId = input.eventId ?? null;
  const role = kind === "event_image" ? cleanRole(input.role) : "cover";
  if (kind === "event_image") {
    if (!eventId) return "event_required";
    if (!(await eventExists(orgId, eventId))) return "event_not_found";
  }

  const assetId = crypto.randomUUID();
  const key = makeKey({ orgId, eventId, assetId, kind, ext });
  const publicUrl = publicUrlForKey(key);
  if (!publicUrl) return "asset_config_missing";

  await db.insert(publicAssets).values({
    id: assetId,
    orgId,
    eventId,
    kind,
    assetRole: role,
    key,
    publicUrl,
    contentType: input.contentType,
    size: input.size,
    status: "pending",
  });

  const uploadUrl = await getSignedUrl(
    config.client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: input.contentType,
    }),
    { expiresIn: UPLOAD_EXPIRES_SECONDS },
  );

  return {
    assetId,
    uploadUrl,
    publicUrl,
    expiresAt: new Date(Date.now() + UPLOAD_EXPIRES_SECONDS * 1000).toISOString(),
  };
}

function isValidHead(asset: typeof publicAssets.$inferSelect, head: HeadObjectCommandOutput) {
  if (head.ContentType !== asset.contentType) return false;
  const size = head.ContentLength ?? 0;
  return size > 0 && size <= asset.size && size <= maxSizeFor(asset.kind);
}

export async function confirmPublicAsset(
  orgId: string,
  assetId: string,
): Promise<PublicAssetDto | ConfirmError> {
  const config = getConfig();
  if (!config) return "asset_config_missing";

  const rows = await db
    .select()
    .from(publicAssets)
    .where(and(eq(publicAssets.orgId, orgId), eq(publicAssets.id, assetId)))
    .limit(1);
  const asset = rows[0];
  if (!asset) return "asset_not_found";

  let head: HeadObjectCommandOutput;
  try {
    head = await config.client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: asset.key }),
    );
  } catch {
    return "upload_not_found";
  }

  if (!isValidHead(asset, head)) {
    if (head.ContentType !== asset.contentType) return "invalid_file_type";
    return "file_too_large";
  }

  const publicUrl = publicUrlForKey(asset.key) ?? asset.publicUrl;
  const updatedRows = await db
    .update(publicAssets)
    .set({ publicUrl, status: "ready", updatedAt: new Date() })
    .where(and(eq(publicAssets.orgId, orgId), eq(publicAssets.id, assetId)))
    .returning();
  const updated = updatedRows[0];

  if (asset.kind === "org_logo") {
    await db.update(organization).set({ logo: publicUrl }).where(eq(organization.id, orgId));
  } else if (asset.eventId && asset.assetRole === "cover") {
    await db
      .update(events)
      .set({ imageUrl: publicUrl, updatedAt: new Date() })
      .where(and(eq(events.orgId, orgId), eq(events.id, asset.eventId)));
  }

  return toPublicAssetDto(updated);
}

export async function clearOrgLogo(orgId: string) {
  await db.update(organization).set({ logo: null }).where(eq(organization.id, orgId));
}

export async function deletePublicAsset(
  orgId: string,
  assetId: string,
): Promise<true | DeleteError> {
  const rows = await db
    .delete(publicAssets)
    .where(and(eq(publicAssets.orgId, orgId), eq(publicAssets.id, assetId)))
    .returning({ id: publicAssets.id });

  if (rows.length === 0) return "asset_not_found";
  return true;
}
