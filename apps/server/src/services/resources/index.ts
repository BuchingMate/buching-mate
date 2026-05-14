import type {
  CreateResourceRequest,
  ResourceDto,
  ResourceType,
  ResourceUsageDto,
  UpdateResourceRequest,
} from "@workspace/contracts";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../db";
import { eventResources, events, resources } from "../../db/schema";

export function toResourceDto(resource: typeof resources.$inferSelect): ResourceDto {
  return {
    id: resource.id,
    orgId: resource.orgId,
    type: resource.type,
    name: resource.name,
    description: resource.description,
    email: resource.email,
    phone: resource.phone,
    capacity: resource.capacity,
    url: resource.url,
    cost: resource.cost,
    currency: resource.currency,
    notes: resource.notes,
    archivedAt: resource.archivedAt ? resource.archivedAt.toISOString() : null,
    metadata: resource.metadata,
    createdAt: resource.createdAt.toISOString(),
    updatedAt: resource.updatedAt.toISOString(),
  };
}

export interface ListResourceFilters {
  eventIds?: string[];
  eventTags?: string[];
}

export async function listResources(
  orgId: string,
  type: ResourceType | null,
  includeArchived = false,
  filters: ListResourceFilters = {},
): Promise<ResourceDto[]> {
  const conditions = [eq(resources.orgId, orgId)];
  if (type) conditions.push(eq(resources.type, type));
  if (!includeArchived) conditions.push(isNull(resources.archivedAt));

  const eventIds = filters.eventIds?.filter((id) => id.length > 0) ?? [];
  const eventTags = filters.eventTags?.filter((t) => t.length > 0) ?? [];

  if (eventIds.length === 0 && eventTags.length === 0) {
    const rows = await db
      .select()
      .from(resources)
      .where(and(...conditions))
      .orderBy(desc(resources.updatedAt));

    return rows.map(toResourceDto);
  }

  const matchedResourceIds = await db
    .selectDistinct({ resourceId: eventResources.resourceId })
    .from(eventResources)
    .innerJoin(events, eq(eventResources.eventId, events.id))
    .where(
      and(
        eq(eventResources.orgId, orgId),
        eventIds.length > 0 ? inArray(events.id, eventIds) : undefined,
        eventTags.length > 0
          ? sql`${events.tags} ?| array[${sql.join(
              eventTags.map((t) => sql`${t}`),
              sql`, `,
            )}]::text[]`
          : undefined,
      ),
    );

  const ids = matchedResourceIds.map((r) => r.resourceId);
  if (ids.length === 0) return [];

  conditions.push(inArray(resources.id, ids));

  const rows = await db
    .select()
    .from(resources)
    .where(and(...conditions))
    .orderBy(desc(resources.updatedAt));

  return rows.map(toResourceDto);
}

export async function getResource(orgId: string, resourceId: string): Promise<ResourceDto | null> {
  const rows = await db
    .select()
    .from(resources)
    .where(and(eq(resources.orgId, orgId), eq(resources.id, resourceId)))
    .limit(1);

  return rows[0] ? toResourceDto(rows[0]) : null;
}

export async function createResource(
  orgId: string,
  input: CreateResourceRequest,
): Promise<ResourceDto> {
  const rows = await db
    .insert(resources)
    .values({
      orgId,
      type: input.type,
      name: input.name,
      description: input.description ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      capacity: input.capacity ?? null,
      url: input.url ?? null,
      cost: input.cost ?? null,
      currency: input.currency ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  return toResourceDto(rows[0]);
}

export async function updateResource(
  orgId: string,
  resourceId: string,
  input: UpdateResourceRequest,
): Promise<ResourceDto | null> {
  const rows = await db
    .update(resources)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(resources.orgId, orgId), eq(resources.id, resourceId)))
    .returning();

  return rows[0] ? toResourceDto(rows[0]) : null;
}

export async function deleteResource(orgId: string, resourceId: string): Promise<boolean> {
  const rows = await db
    .delete(resources)
    .where(and(eq(resources.orgId, orgId), eq(resources.id, resourceId)))
    .returning({ id: resources.id });

  return rows.length > 0;
}

export async function archiveResource(
  orgId: string,
  resourceId: string,
): Promise<ResourceDto | null> {
  const rows = await db
    .update(resources)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(resources.orgId, orgId), eq(resources.id, resourceId)))
    .returning();

  return rows[0] ? toResourceDto(rows[0]) : null;
}

export async function unarchiveResource(
  orgId: string,
  resourceId: string,
): Promise<ResourceDto | null> {
  const rows = await db
    .update(resources)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(resources.orgId, orgId), eq(resources.id, resourceId)))
    .returning();

  return rows[0] ? toResourceDto(rows[0]) : null;
}

export async function listResourceUsages(
  orgId: string,
  resourceId: string,
): Promise<ResourceUsageDto[]> {
  const rows = await db
    .select({
      eventResourceId: eventResources.id,
      eventId: events.id,
      eventTitle: events.title,
      eventDate: events.date,
      eventStatus: events.status,
      role: eventResources.role,
      quantity: eventResources.quantity,
    })
    .from(eventResources)
    .innerJoin(events, eq(eventResources.eventId, events.id))
    .where(and(eq(eventResources.orgId, orgId), eq(eventResources.resourceId, resourceId)))
    .orderBy(desc(events.date));

  return rows;
}
