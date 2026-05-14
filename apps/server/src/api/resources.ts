import { Hono } from "hono";
import type { Context } from "hono";
import type {
  CreateResourceRequest,
  ResourceType,
  UpdateResourceRequest,
} from "@workspace/contracts";
import { apiError } from "./errors";
import type { ApiEnv } from "./types";
import { requireAuth, requireOrg, requireRole } from "../middleware/auth";
import {
  archiveResource,
  createResource,
  deleteResource,
  getResource,
  listResources,
  listResourceUsages,
  unarchiveResource,
  updateResource,
} from "../services/resources";

const resourceTypes = ["instructor", "material", "location", "equipment", "custom"] as const;

function isResourceType(value: string): value is ResourceType {
  return resourceTypes.includes(value as ResourceType);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string"
    ? value
    : value === null || value === undefined
      ? null
      : undefined;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : value === null || value === undefined
      ? null
      : undefined;
}

function isNonNegativeNumericString(value: string) {
  if (!/^-?\d+(\.\d+)?$/.test(value)) return false;
  return Number.parseFloat(value) >= 0;
}

function costOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value.toFixed(2);
  }
  if (typeof value === "string" && isNonNegativeNumericString(value)) {
    return value;
  }
  return undefined;
}

function currencyOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().toUpperCase();
  if (trimmed.length === 0) return null;
  if (!/^[A-Z]{3}$/.test(trimmed)) return undefined;
  return trimmed;
}

function parseCreateResource(input: unknown): CreateResourceRequest | string {
  if (!isRecord(input)) return "Request body must be an object";
  if (typeof input.type !== "string" || !isResourceType(input.type))
    return "Resource type is invalid";
  if (typeof input.name !== "string" || input.name.trim().length === 0)
    return "Resource name is required";

  const description = stringOrNull(input.description);
  const email = stringOrNull(input.email);
  const phone = stringOrNull(input.phone);
  const capacity = numberOrNull(input.capacity);
  const url = stringOrNull(input.url);
  const notes = stringOrNull(input.notes);
  const cost = costOrNull(input.cost);
  const currency = currencyOrNull(input.currency);

  if (description === undefined) return "Description must be a string or null";
  if (email === undefined) return "Email must be a string or null";
  if (phone === undefined) return "Phone must be a string or null";
  if (capacity === undefined) return "Capacity must be an integer or null";
  if (url === undefined) return "URL must be a string or null";
  if (notes === undefined) return "Notes must be a string or null";
  if (cost === undefined) return "Cost must be a non-negative number or null";
  if (currency === undefined) return "Currency must be a 3-letter ISO code or null";
  if (input.metadata !== undefined && !isRecord(input.metadata))
    return "Metadata must be an object";

  return {
    type: input.type,
    name: input.name.trim(),
    description,
    email,
    phone,
    capacity,
    url,
    cost,
    currency,
    notes,
    metadata: input.metadata ?? {},
  };
}

function parseUpdateResource(input: unknown): UpdateResourceRequest | string {
  if (!isRecord(input)) return "Request body must be an object";

  const parsed: UpdateResourceRequest = {};

  if (input.type !== undefined) {
    if (typeof input.type !== "string" || !isResourceType(input.type))
      return "Resource type is invalid";
    parsed.type = input.type;
  }

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || input.name.trim().length === 0)
      return "Resource name is required";
    parsed.name = input.name.trim();
  }

  for (const field of ["description", "email", "phone", "url", "notes"] as const) {
    if (input[field] !== undefined) {
      const value = stringOrNull(input[field]);
      if (value === undefined) return `${field} must be a string or null`;
      parsed[field] = value;
    }
  }

  if (input.capacity !== undefined) {
    const capacity = numberOrNull(input.capacity);
    if (capacity === undefined) return "Capacity must be an integer or null";
    parsed.capacity = capacity;
  }

  if (input.cost !== undefined) {
    const cost = costOrNull(input.cost);
    if (cost === undefined) return "Cost must be a non-negative number or null";
    parsed.cost = cost;
  }

  if (input.currency !== undefined) {
    const currency = currencyOrNull(input.currency);
    if (currency === undefined) return "Currency must be a 3-letter ISO code or null";
    parsed.currency = currency;
  }

  if (input.metadata !== undefined) {
    if (!isRecord(input.metadata)) return "Metadata must be an object";
    parsed.metadata = input.metadata;
  }

  if (Object.keys(parsed).length === 0) return "At least one field is required";

  return parsed;
}

async function readJson(c: Context<ApiEnv>) {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

export const resourceRoutes = new Hono<ApiEnv>()
  .use("*", requireAuth, requireOrg)
  .get("/", async (c) => {
    const type = c.req.query("type") ?? null;
    const includeArchived = c.req.query("includeArchived") === "true";
    const eventIdsParam = c.req.query("eventIds");
    const eventTagsParam = c.req.query("eventTags");

    if (type !== null && !isResourceType(type)) {
      return apiError(c, 400, "invalid_resource_type", "Resource type is invalid");
    }

    const eventIds = eventIdsParam
      ? eventIdsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const eventTags = eventTagsParam
      ? eventTagsParam
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const resources = await listResources(c.var.orgId, type, includeArchived, {
      eventIds,
      eventTags,
    });
    return c.json({ resources });
  })
  .post("/", requireRole("manager"), async (c) => {
    const input = parseCreateResource(await readJson(c));

    if (typeof input === "string") {
      return apiError(c, 400, "invalid_resource", input);
    }

    const resource = await createResource(c.var.orgId, input);
    return c.json({ resource }, 201);
  })
  .get("/:resourceId", async (c) => {
    const resource = await getResource(c.var.orgId, c.req.param("resourceId"));

    if (!resource) {
      return apiError(c, 404, "resource_not_found", "Resource not found");
    }

    return c.json({ resource });
  })
  .patch("/:resourceId", requireRole("manager"), async (c) => {
    const input = parseUpdateResource(await readJson(c));

    if (typeof input === "string") {
      return apiError(c, 400, "invalid_resource", input);
    }

    const resource = await updateResource(c.var.orgId, c.req.param("resourceId"), input);

    if (!resource) {
      return apiError(c, 404, "resource_not_found", "Resource not found");
    }

    return c.json({ resource });
  })
  .delete("/:resourceId", requireRole("admin"), async (c) => {
    try {
      const deleted = await deleteResource(c.var.orgId, c.req.param("resourceId"));

      if (!deleted) {
        return apiError(c, 404, "resource_not_found", "Resource not found");
      }

      return c.json({ deleted: true });
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code: string }).code === "23503"
      ) {
        return apiError(
          c,
          409,
          "resource_in_use",
          "Resource is assigned to one or more events. Remove assignments before deleting, or archive instead.",
        );
      }
      throw err;
    }
  })
  .post("/:resourceId/archive", requireRole("manager"), async (c) => {
    const resource = await archiveResource(c.var.orgId, c.req.param("resourceId"));
    if (!resource) return apiError(c, 404, "resource_not_found", "Resource not found");
    return c.json({ resource });
  })
  .post("/:resourceId/unarchive", requireRole("manager"), async (c) => {
    const resource = await unarchiveResource(c.var.orgId, c.req.param("resourceId"));
    if (!resource) return apiError(c, 404, "resource_not_found", "Resource not found");
    return c.json({ resource });
  })
  .get("/:resourceId/events", async (c) => {
    const usages = await listResourceUsages(c.var.orgId, c.req.param("resourceId"));
    return c.json({ usages });
  });
