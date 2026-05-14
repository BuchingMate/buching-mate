export function getPublicAssetBaseUrl() {
  return Bun.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "") ?? null;
}

export function publicUrlForKey(key: string) {
  const baseUrl = getPublicAssetBaseUrl();
  return baseUrl ? `${baseUrl}/${key}` : null;
}

export function rewritePublicAssetUrl(url: string | null) {
  if (!url) return null;

  const marker = "/orgs/";
  const orgPathIndex = url.indexOf(marker);
  if (orgPathIndex === -1) return url;

  return publicUrlForKey(url.slice(orgPathIndex + 1)) ?? url;
}
