import { Hono } from "hono";
import type {
  CreatePublicAssetUploadRequest,
  PublicAssetKind,
  PublicAssetRole,
} from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { isRecord, readJson } from "./validation";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import {
  clearOrgLogo,
  confirmPublicAsset,
  createPublicAssetUpload,
  deletePublicAsset,
} from "../services/assets";

const assetKinds: PublicAssetKind[] = ["org_logo", "event_image"];
const assetRoles: PublicAssetRole[] = ["cover", "detail"];

function isAssetKind(value: string): value is PublicAssetKind {
  return assetKinds.includes(value as PublicAssetKind);
}

function isAssetRole(value: string): value is PublicAssetRole {
  return assetRoles.includes(value as PublicAssetRole);
}

function parseUpload(input: unknown): CreatePublicAssetUploadRequest | string {
  if (!isRecord(input)) return "Request body must be an object";

  if (typeof input.kind !== "string" || !isAssetKind(input.kind)) return "Asset kind is invalid";
  if (typeof input.fileName !== "string" || input.fileName.trim().length === 0) {
    return "File name is required";
  }
  if (typeof input.contentType !== "string" || input.contentType.trim().length === 0) {
    return "Content type is required";
  }
  if (typeof input.size !== "number" || !Number.isInteger(input.size) || input.size <= 0) {
    return "File size must be a positive integer";
  }
  if (input.role !== undefined && (typeof input.role !== "string" || !isAssetRole(input.role))) {
    return "Asset role is invalid";
  }
  if (
    input.eventId !== undefined &&
    input.eventId !== null &&
    (typeof input.eventId !== "string" || input.eventId.trim().length === 0)
  ) {
    return "Event ID must be a string or null";
  }

  return {
    kind: input.kind,
    role: input.kind === "event_image" && input.role ? input.role : "cover",
    fileName: input.fileName.trim(),
    contentType: input.contentType.trim().toLowerCase(),
    size: input.size,
    eventId: typeof input.eventId === "string" ? input.eventId : null,
  };
}

function uploadError(error: string) {
  switch (error) {
    case "asset_config_missing":
      return ["asset_config_missing", "Public asset storage is not configured.", 503] as const;
    case "invalid_file_type":
      return ["invalid_file_type", "Upload a JPG, PNG, WebP, or GIF image.", 400] as const;
    case "file_too_large":
      return ["file_too_large", "The image is too large.", 400] as const;
    case "event_required":
      return ["event_required", "Event images require an event ID.", 400] as const;
    case "event_not_found":
      return ["event_not_found", "Event not found.", 404] as const;
    default:
      return ["invalid_asset", "Asset upload is invalid.", 400] as const;
  }
}

function confirmError(error: string) {
  switch (error) {
    case "asset_config_missing":
      return ["asset_config_missing", "Public asset storage is not configured.", 503] as const;
    case "asset_not_found":
      return ["asset_not_found", "Asset not found.", 404] as const;
    case "upload_not_found":
      return ["upload_not_found", "Uploaded file not found.", 404] as const;
    case "invalid_file_type":
      return ["invalid_file_type", "Uploaded file type does not match.", 400] as const;
    case "file_too_large":
      return ["file_too_large", "Uploaded file is too large.", 400] as const;
    default:
      return ["invalid_asset", "Asset confirmation is invalid.", 400] as const;
  }
}

export const assetRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .post("/upload-url", requireRole("manager"), async (c) => {
    const input = parseUpload(await readJson(c));
    if (typeof input === "string") return apiError(c, 400, "invalid_asset", input);

    const result = await createPublicAssetUpload(c.var.orgId, input);
    if (typeof result === "string") {
      const [code, message, status] = uploadError(result);
      return apiError(c, status, code, message);
    }

    return c.json(result, 201);
  })
  .post("/:assetId/confirm", requireRole("manager"), async (c) => {
    const result = await confirmPublicAsset(c.var.orgId, c.req.param("assetId"));
    if (typeof result === "string") {
      const [code, message, status] = confirmError(result);
      return apiError(c, status, code, message);
    }

    return c.json({ asset: result });
  })
  .delete("/org-logo", requireRole("admin"), async (c) => {
    await clearOrgLogo(c.var.orgId);
    return c.json({ cleared: true });
  })
  .delete("/:assetId", requireRole("manager"), async (c) => {
    const result = await deletePublicAsset(c.var.orgId, c.req.param("assetId"));
    if (result === "asset_not_found") {
      return apiError(c, 404, "asset_not_found", "Asset not found.");
    }

    return c.json({ deleted: true });
  });
