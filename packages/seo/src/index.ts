export interface SocialImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface SeoDefaults {
  siteName: string;
  description: string;
  image: SocialImage;
  twitterCard: "summary" | "summary_large_image";
  twitterSite?: string;
}

export interface SeoInput {
  title: string;
  description?: string | null;
  baseUrl?: string | null;
  path?: string | null;
  url?: string | null;
  image?: string | SocialImage | null;
  imageAlt?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
  siteName?: string;
  twitterSite?: string | null;
}

type HeadMeta =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

type HeadLink = { rel: string; href: string };

export interface SeoHead {
  meta: HeadMeta[];
  links: HeadLink[];
}

export const bookingMateSeo: SeoDefaults = {
  siteName: "Buching",
  description:
    "Self-hostable event booking and registration for small teams, schools, studios, nonprofits, and service businesses.",
  image: {
    url: "/og-default.png",
    alt: "Buching event booking and registration platform",
    width: 1200,
    height: 630,
  },
  twitterCard: "summary_large_image",
};

export function makeUrl(baseUrl: string | null | undefined, path: string | null | undefined) {
  if (!path) return null;

  try {
    return new URL(path).toString();
  } catch {
    if (!baseUrl) return null;
  }

  try {
    return new URL(path, normalizeBaseUrl(baseUrl)).toString();
  } catch {
    return null;
  }
}

export function makeHead(input: SeoInput, defaults: SeoDefaults = bookingMateSeo): SeoHead {
  const siteName = input.siteName ?? defaults.siteName;
  const title = formatTitle(input.title, siteName);
  const description = clean(input.description) ?? defaults.description;
  const canonicalUrl = input.url ?? makeUrl(input.baseUrl, input.path);
  const image = normalizeImage(input.image, defaults.image, input.imageAlt);
  const imageUrl = makeUrl(input.baseUrl, image.url);
  const imageAlt = clean(image.alt) ?? `${input.title} on ${siteName}`;
  const twitterSite = clean(input.twitterSite) ?? defaults.twitterSite;

  const meta: HeadMeta[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: input.type ?? "website" },
    { property: "og:site_name", content: siteName },
    { name: "twitter:card", content: defaults.twitterCard },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  if (input.noIndex) meta.push({ name: "robots", content: "noindex, nofollow" });
  if (canonicalUrl) meta.push({ property: "og:url", content: canonicalUrl });
  if (imageUrl) {
    meta.push(
      { property: "og:image", content: imageUrl },
      { property: "og:image:alt", content: imageAlt },
      { name: "twitter:image", content: imageUrl },
      { name: "twitter:image:alt", content: imageAlt },
    );
  }
  if (image.width) meta.push({ property: "og:image:width", content: String(image.width) });
  if (image.height) meta.push({ property: "og:image:height", content: String(image.height) });
  if (twitterSite) meta.push({ name: "twitter:site", content: twitterSite });

  return {
    meta,
    links: canonicalUrl ? [{ rel: "canonical", href: canonicalUrl }] : [],
  };
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatTitle(title: string, siteName: string) {
  const cleanTitle = clean(title) ?? siteName;
  return cleanTitle === siteName || cleanTitle.endsWith(`| ${siteName}`)
    ? cleanTitle
    : `${cleanTitle} | ${siteName}`;
}

function normalizeImage(
  image: string | SocialImage | null | undefined,
  fallback: SocialImage,
  imageAlt: string | null | undefined,
): SocialImage {
  if (!image) return fallback;
  if (typeof image === "string")
    return { ...fallback, url: image, alt: clean(imageAlt) ?? fallback.alt };
  return { ...fallback, ...image, alt: clean(image.alt) ?? clean(imageAlt) ?? fallback.alt };
}
