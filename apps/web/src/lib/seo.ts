import { bookingMateSeo, makeHead, type SeoInput } from "@workspace/seo";
import { BUSINESS_NAME } from "./branding";

const appSeoDefaults = {
  ...bookingMateSeo,
  siteName: BUSINESS_NAME,
  image: {
    ...bookingMateSeo.image,
    alt: `${BUSINESS_NAME} event booking and registration platform`,
  },
};

export function makeAppHead(input: SeoInput) {
  return makeHead({ siteName: BUSINESS_NAME, ...input }, appSeoDefaults);
}

export function pageHead(title: string) {
  return { meta: [{ title: `${title} | ${BUSINESS_NAME}` }] };
}
