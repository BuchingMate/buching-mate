import { eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eventResources, events, organization, resources } from "./schema";
import * as schema from "./schema";

const SEED_ORG_SLUG_PREFIX = process.env.SEED_ORG_SLUG_PREFIX ?? "acme-inc";
const SEED_PREFIX = "seed-";
const LEGACY_SEED_ORG_ID = "seed-org-demo";
const resetOnly = process.argv.includes("--reset-only");
const shouldReset = resetOnly || process.argv.includes("--reset");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client, { schema });

const resourceStories = [
  {
    id: `${SEED_PREFIX}resource-instructor`,
    type: "instructor" as const,
    name: "Seed: Instructor - Maya Chen",
    description: "Lead facilitator for practical workshops and small-group sessions.",
    email: "maya.seed@example.com",
    phone: "+1 555 0101",
    capacity: 24,
    url: "https://example.com/team/maya-chen",
    cost: "150.00",
    currency: "USD",
    notes: "Best for workshop, webinar, and onboarding event stories.",
  },
  {
    id: `${SEED_PREFIX}resource-location`,
    type: "location" as const,
    name: "Seed: Location - Studio A",
    description: "Bright training room with flexible seating and presentation setup.",
    capacity: 40,
    url: "https://maps.example.com/studio-a",
    cost: "300.00",
    currency: "USD",
    notes: "Use for in-person event stories.",
  },
  {
    id: `${SEED_PREFIX}resource-equipment`,
    type: "equipment" as const,
    name: "Seed: Equipment - Streaming Kit",
    description: "Camera, microphone, lights, and capture card for online sessions.",
    capacity: 1,
    cost: "75.00",
    currency: "USD",
  },
  {
    id: `${SEED_PREFIX}resource-material`,
    type: "material" as const,
    name: "Seed: Material - Participant Workbook",
    description: "Printed workbook and exercises for hands-on training.",
    capacity: 100,
    cost: "12.00",
    currency: "USD",
  },
  {
    id: `${SEED_PREFIX}resource-custom`,
    type: "custom" as const,
    name: "Seed: Custom - Hospitality Package",
    description: "Coffee, snacks, signage, and front-desk setup.",
    cost: "220.00",
    currency: "USD",
  },
  {
    id: `${SEED_PREFIX}resource-archived`,
    type: "location" as const,
    name: "Seed: Archived - Old Downtown Room",
    description: "Archived resource retained to test filtering and historical views.",
    archivedAt: new Date("2026-01-15T12:00:00Z"),
  },
  {
    id: `${SEED_PREFIX}resource-paid`,
    type: "equipment" as const,
    name: "Seed: Paid - Translation Headsets",
    description: "Rental equipment with explicit cost and currency fields.",
    capacity: 30,
    cost: "95.00",
    currency: "USD",
  },
  {
    id: `${SEED_PREFIX}resource-minimal`,
    type: "custom" as const,
    name: "Seed: Minimal Resource",
  },
  {
    id: `${SEED_PREFIX}resource-long-content`,
    type: "material" as const,
    name: "Seed: Long Content Resource With A Deliberately Verbose Name For Layout Testing",
    description:
      "A deliberately long resource description used to exercise wrapping, truncation, responsive layouts, and detail-page readability without requiring duplicate resources.",
    notes:
      "This note is intentionally long so resource tables, cards, and forms can be checked for overflow and spacing issues across desktop and mobile layouts.",
  },
];

type TargetOrg = {
  id: string;
  slug: string | null;
};

const eventStories = [
  {
    id: `${SEED_PREFIX}event-published-free`,
    title: "Seed: Published Free Event",
    description: "A normal public event that does not require payment.",
    category: "Workshop",
    tags: ["free", "published"],
    date: "2026-06-05",
    time: "10:00:00",
    duration: 60,
    maxCapacity: 30,
    location: "Studio A",
    locationLat: 40.7128,
    locationLng: -74.006,
    status: "upcoming" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-published-paid`,
    title: "Seed: Published Paid Event",
    description: "A public paid event without seeded registrations or Stripe payment records.",
    category: "Masterclass",
    tags: ["paid", "published"],
    date: "2026-06-12",
    time: "13:00:00",
    duration: 120,
    maxCapacity: 18,
    location: "Studio A",
    status: "upcoming" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 4900,
  },
  {
    id: `${SEED_PREFIX}event-draft`,
    title: "Seed: Draft Event",
    description: "An unpublished event draft for editing and preview flows.",
    category: "Training",
    tags: ["draft"],
    date: "2026-06-18",
    time: "09:30:00",
    duration: 90,
    status: "upcoming" as const,
    visibility: "unpublished" as const,
    reviewStatus: "none" as const,
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-completed`,
    title: "Seed: Completed Event",
    description: "A past event for completed-state filtering and detail views.",
    category: "Orientation",
    tags: ["completed"],
    date: "2026-02-20",
    time: "15:00:00",
    duration: 45,
    maxCapacity: 25,
    location: "Community Hall",
    status: "completed" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-cancelled`,
    title: "Seed: Cancelled Event",
    description: "A cancelled event to test status labels and filtering.",
    category: "Community",
    tags: ["cancelled"],
    date: "2026-07-02",
    time: "11:00:00",
    duration: 60,
    status: "cancelled" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-review-pending`,
    title: "Seed: Review Pending Event",
    description: "An event waiting for approval before publication.",
    category: "Webinar",
    tags: ["review"],
    date: "2026-07-10",
    time: "14:00:00",
    duration: 60,
    status: "upcoming" as const,
    visibility: "unpublished" as const,
    reviewStatus: "pending" as const,
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-review-rejected`,
    title: "Seed: Review Rejected Event",
    description: "An event with reviewer feedback for rejection-state UI.",
    category: "Workshop",
    tags: ["review", "rejected"],
    date: "2026-07-16",
    time: "16:00:00",
    duration: 75,
    status: "upcoming" as const,
    visibility: "unpublished" as const,
    reviewStatus: "rejected" as const,
    reviewNote: "Please add a clearer agenda and update the cover image before publishing.",
    reviewedAt: new Date("2026-05-12T16:00:00Z"),
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-recurring`,
    title: "Seed: Recurring Event",
    description: "A weekly recurring event with recurrence fields populated.",
    category: "Class",
    tags: ["recurring"],
    date: "2026-08-03",
    time: "08:30:00",
    duration: 45,
    status: "upcoming" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    recurring: true,
    recurrenceFrequency: "weekly",
    recurrenceDays: ["monday", "wednesday"],
    recurrenceInterval: 1,
    recurrenceEndDate: "2026-09-30",
    price: 1500,
  },
  {
    id: `${SEED_PREFIX}event-online`,
    title: "Seed: Online Event",
    description: "An online event without video provider records yet.",
    category: "Webinar",
    tags: ["online"],
    date: "2026-08-14",
    time: "12:00:00",
    duration: 60,
    maxCapacity: 100,
    location: "Online",
    status: "upcoming" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 0,
  },
  {
    id: `${SEED_PREFIX}event-in-person`,
    title: "Seed: In-Person Event",
    description: "An in-person event with coordinates and assigned location resources.",
    category: "Training",
    tags: ["in-person"],
    date: "2026-08-21",
    time: "10:30:00",
    duration: 180,
    maxCapacity: 35,
    location: "Studio A, 123 Market Street",
    locationLat: 37.7749,
    locationLng: -122.4194,
    status: "upcoming" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 2500,
  },
  {
    id: `${SEED_PREFIX}event-minimal`,
    title: "Seed: Minimal Event",
    date: "2026-09-01",
    time: "09:00:00",
    duration: 30,
  },
  {
    id: `${SEED_PREFIX}event-long-content`,
    title: "Seed: Long Content Event With A Deliberately Verbose Title For Layout Testing",
    description:
      "A deliberately long event description used to validate card layouts, detail pages, responsive line wrapping, and editing forms without creating duplicate seed events. It should be long enough to exercise overflow-prone UI while still being realistic content.",
    notes:
      "Internal note for seeded UI testing. This is intentionally verbose to make sure notes fields remain readable and do not break layout constraints.",
    category: "Operations",
    tags: ["long-content", "layout-test"],
    date: "2026-09-12",
    time: "17:15:00",
    duration: 120,
    maxCapacity: 12,
    status: "upcoming" as const,
    visibility: "published" as const,
    reviewStatus: "approved" as const,
    price: 0,
  },
];

const eventResourceStories = [
  {
    id: `${SEED_PREFIX}event-resource-instructor`,
    eventId: `${SEED_PREFIX}event-published-free`,
    resourceId: `${SEED_PREFIX}resource-instructor`,
    role: "lead instructor",
    quantity: 1,
  },
  {
    id: `${SEED_PREFIX}event-resource-location`,
    eventId: `${SEED_PREFIX}event-in-person`,
    resourceId: `${SEED_PREFIX}resource-location`,
    role: "venue",
    quantity: 1,
  },
  {
    id: `${SEED_PREFIX}event-resource-equipment`,
    eventId: `${SEED_PREFIX}event-online`,
    resourceId: `${SEED_PREFIX}resource-equipment`,
    role: "streaming kit",
    quantity: 1,
  },
  {
    id: `${SEED_PREFIX}event-resource-multi-instructor`,
    eventId: `${SEED_PREFIX}event-published-paid`,
    resourceId: `${SEED_PREFIX}resource-instructor`,
    role: "facilitator",
    quantity: 1,
  },
  {
    id: `${SEED_PREFIX}event-resource-multi-location`,
    eventId: `${SEED_PREFIX}event-published-paid`,
    resourceId: `${SEED_PREFIX}resource-location`,
    role: "room",
    quantity: 1,
  },
  {
    id: `${SEED_PREFIX}event-resource-multi-material`,
    eventId: `${SEED_PREFIX}event-published-paid`,
    resourceId: `${SEED_PREFIX}resource-material`,
    role: "workbook",
    quantity: 18,
  },
  {
    id: `${SEED_PREFIX}event-resource-recurring`,
    eventId: `${SEED_PREFIX}event-recurring`,
    resourceId: `${SEED_PREFIX}resource-paid`,
    role: "translation support",
    quantity: 12,
  },
  {
    id: `${SEED_PREFIX}event-resource-long-content`,
    eventId: `${SEED_PREFIX}event-long-content`,
    resourceId: `${SEED_PREFIX}resource-long-content`,
    role: "layout test material",
    quantity: 1,
  },
];

function scopedId(orgId: string, id: string) {
  return `${SEED_PREFIX}${orgId}-${id.slice(SEED_PREFIX.length)}`;
}

function storyIds(orgId: string, stories: { id: string }[]) {
  return stories.map((story) => scopedId(orgId, story.id));
}

async function getTargetOrgs() {
  return await db
    .select({ id: organization.id, slug: organization.slug })
    .from(organization)
    .where(like(organization.slug, `${SEED_ORG_SLUG_PREFIX}%`));
}

async function resetSeedData(org: TargetOrg) {
  await db
    .delete(eventResources)
    .where(inArray(eventResources.id, storyIds(org.id, eventResourceStories)));
  await db.delete(resources).where(inArray(resources.id, storyIds(org.id, resourceStories)));
  await db.delete(events).where(inArray(events.id, storyIds(org.id, eventStories)));
}

async function resetLegacySeedOrg() {
  await db.delete(eventResources).where(eq(eventResources.orgId, LEGACY_SEED_ORG_ID));
  await db.delete(resources).where(eq(resources.orgId, LEGACY_SEED_ORG_ID));
  await db.delete(events).where(eq(events.orgId, LEGACY_SEED_ORG_ID));
  await db.delete(organization).where(eq(organization.id, LEGACY_SEED_ORG_ID));
}

async function seedData(org: TargetOrg) {
  await db.insert(resources).values(
    resourceStories.map((resource) => ({
      ...resource,
      id: scopedId(org.id, resource.id),
      orgId: org.id,
    })),
  );

  await db
    .insert(events)
    .values(
      eventStories.map((event) => ({ ...event, id: scopedId(org.id, event.id), orgId: org.id })),
    );

  await db.insert(eventResources).values(
    eventResourceStories.map((eventResource) => ({
      ...eventResource,
      id: scopedId(org.id, eventResource.id),
      eventId: scopedId(org.id, eventResource.eventId),
      resourceId: scopedId(org.id, eventResource.resourceId),
      orgId: org.id,
    })),
  );
}

async function main() {
  const targetOrgs = await getTargetOrgs();

  if (targetOrgs.length === 0) {
    throw new Error(`No organizations found with slug starting '${SEED_ORG_SLUG_PREFIX}'.`);
  }

  if (shouldReset) {
    await resetLegacySeedOrg();

    for (const org of targetOrgs) {
      await resetSeedData(org);
    }
  }

  if (!resetOnly) {
    if (!shouldReset) {
      for (const org of targetOrgs) {
        const existing = await db
          .select({ id: events.id })
          .from(events)
          .where(inArray(events.id, storyIds(org.id, eventStories)))
          .limit(1);

        if (existing[0]) {
          throw new Error(
            `Seed data already exists for org '${org.slug ?? org.id}'. Run \`bun run db:seed:reset\` to recreate it.`,
          );
        }
      }
    }

    for (const org of targetOrgs) {
      await seedData(org);
    }
  }

  const targetSlugs = targetOrgs.map((org) => org.slug ?? org.id).join(", ");

  console.log(
    resetOnly
      ? `Seed data removed from orgs: ${targetSlugs}.`
      : `Seeded ${eventStories.length} event stories, ${resourceStories.length} resource stories, and ${eventResourceStories.length} event-resource links into orgs: ${targetSlugs}.`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
