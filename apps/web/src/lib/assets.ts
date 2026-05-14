import type {
  CreatePublicAssetUploadRequest,
  CreatePublicAssetUploadResponse,
  PublicAssetDto,
} from "@workspace/contracts";
import { api } from "./api";

export function createPublicAssetUpload(input: CreatePublicAssetUploadRequest) {
  return api.post<CreatePublicAssetUploadResponse>("/api/assets/upload-url", input);
}

export function confirmPublicAsset(assetId: string) {
  return api.post<{ asset: PublicAssetDto }>(`/api/assets/${assetId}/confirm`, {});
}

export function clearOrgLogo() {
  return api.delete<{ cleared: true }>("/api/assets/org-logo");
}

export function deletePublicAsset(assetId: string) {
  return api.delete<{ deleted: true }>(`/api/assets/${assetId}`);
}

export async function uploadPublicAsset(input: {
  file: File;
  kind: CreatePublicAssetUploadRequest["kind"];
  eventId?: string | null;
  role?: CreatePublicAssetUploadRequest["role"];
}) {
  const upload = await createPublicAssetUpload({
    kind: input.kind,
    role: input.role,
    fileName: input.file.name,
    contentType: input.file.type,
    size: input.file.size,
    eventId: input.eventId ?? null,
  });

  const response = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": input.file.type },
    body: input.file,
  });

  if (!response.ok) {
    throw new Error("Unable to upload image");
  }

  const confirmed = await confirmPublicAsset(upload.assetId);
  return confirmed.asset;
}
