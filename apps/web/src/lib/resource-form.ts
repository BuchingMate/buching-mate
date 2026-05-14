import type { CreateResourceRequest, ResourceDto, ResourceType } from "@workspace/contracts";
import { z } from "zod";

export const resourceTypes: ResourceType[] = [
  "instructor",
  "material",
  "location",
  "equipment",
  "custom",
];

export const resourceTypeLabels: Record<ResourceType, string> = {
  instructor: "Instructor",
  material: "Material",
  location: "Location",
  equipment: "Equipment",
  custom: "Custom",
};

export const resourceTypeDescriptions: Record<ResourceType, string> = {
  instructor: "People who lead, teach, or assist at events.",
  material: "Consumable items handed out or used up at events.",
  location: "Physical or virtual spaces where events happen.",
  equipment: "Reusable durables reserved per event.",
  custom: "Anything else — vendors, services, licenses.",
};

export interface ResourceFieldVisibility {
  email: boolean;
  phone: boolean;
  capacity: boolean;
  capacityLabel: string;
  url: boolean;
  urlLabel: string;
  cost: boolean;
  costLabel: string;
}

export function fieldVisibilityFor(type: ResourceType): ResourceFieldVisibility {
  switch (type) {
    case "instructor":
      return {
        email: true,
        phone: true,
        capacity: false,
        capacityLabel: "Capacity",
        url: false,
        urlLabel: "URL",
        cost: true,
        costLabel: "Fee per event",
      };
    case "material":
      return {
        email: false,
        phone: false,
        capacity: true,
        capacityLabel: "Stock on hand",
        url: true,
        urlLabel: "Reference URL",
        cost: true,
        costLabel: "Unit cost",
      };
    case "location":
      return {
        email: false,
        phone: false,
        capacity: true,
        capacityLabel: "Max guests",
        url: true,
        urlLabel: "Map or meeting URL",
        cost: false,
        costLabel: "Cost",
      };
    case "equipment":
      return {
        email: false,
        phone: false,
        capacity: true,
        capacityLabel: "Pool size",
        url: true,
        urlLabel: "Reference URL",
        cost: true,
        costLabel: "Rental cost",
      };
    case "custom":
      return {
        email: true,
        phone: true,
        capacity: true,
        capacityLabel: "Capacity",
        url: true,
        urlLabel: "URL",
        cost: true,
        costLabel: "Cost",
      };
  }
}

export const resourceFormSchema = z.object({
  type: z.enum(["instructor", "material", "location", "equipment", "custom"]),
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  notes: z.string(),
  email: z.string(),
  phone: z.string(),
  capacity: z.string(),
  url: z.string(),
  cost: z.string(),
  currency: z.string(),
});

export type ResourceFormState = z.infer<typeof resourceFormSchema>;

export function emptyResourceForm(type: ResourceType = "instructor"): ResourceFormState {
  return {
    type,
    name: "",
    description: "",
    notes: "",
    email: "",
    phone: "",
    capacity: "",
    url: "",
    cost: "",
    currency: "",
  };
}

export function resourceToForm(resource: ResourceDto): ResourceFormState {
  return {
    type: resource.type,
    name: resource.name,
    description: resource.description ?? "",
    notes: resource.notes ?? "",
    email: resource.email ?? "",
    phone: resource.phone ?? "",
    capacity: resource.capacity == null ? "" : String(resource.capacity),
    url: resource.url ?? "",
    cost: resource.cost ?? "",
    currency: resource.currency ?? "",
  };
}

function trimmedOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function formToResourceRequest(form: ResourceFormState): CreateResourceRequest {
  const visibility = fieldVisibilityFor(form.type);
  const capacityRaw = visibility.capacity ? form.capacity.trim() : "";
  const capacity = capacityRaw === "" ? null : Number.parseInt(capacityRaw, 10);
  const costRaw = visibility.cost ? form.cost.trim() : "";

  return {
    type: form.type,
    name: form.name.trim(),
    description: trimmedOrNull(form.description),
    notes: trimmedOrNull(form.notes),
    email: visibility.email ? trimmedOrNull(form.email) : null,
    phone: visibility.phone ? trimmedOrNull(form.phone) : null,
    capacity: capacity != null && Number.isFinite(capacity) ? capacity : null,
    url: visibility.url ? trimmedOrNull(form.url) : null,
    cost: costRaw === "" ? null : costRaw,
    currency: visibility.cost ? (trimmedOrNull(form.currency)?.toUpperCase() ?? null) : null,
  };
}

export function formatCost(resource: ResourceDto) {
  if (!resource.cost) return "—";
  const currency = resource.currency ? ` ${resource.currency}` : "";
  return `${resource.cost}${currency}`;
}
