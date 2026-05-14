import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  archiveResource,
  createResource,
  deleteResource,
  replaceEventResources,
  unarchiveResource,
  updateResource,
} from "@/lib/resources";
import type {
  CreateResourceRequest,
  UpdateEventResourcesRequest,
  UpdateResourceRequest,
} from "@workspace/contracts";
import { resourceKeys } from "@/queries/resources";

function useInvalidateResources() {
  const queryClient = useQueryClient();
  return async (resourceId?: string) => {
    await queryClient.invalidateQueries({ queryKey: resourceKeys.lists() });
    if (resourceId) {
      await queryClient.invalidateQueries({ queryKey: resourceKeys.detail(resourceId) });
      await queryClient.invalidateQueries({ queryKey: resourceKeys.usages(resourceId) });
    }
  };
}

export function useCreateResource() {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (input: CreateResourceRequest) => createResource(input),
    onSuccess: async () => {
      await invalidate();
    },
  });
}

export function useUpdateResource(resourceId: string) {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (input: UpdateResourceRequest) => updateResource(resourceId, input),
    onSuccess: async () => {
      await invalidate(resourceId);
    },
  });
}

export function useDeleteResource() {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (resourceId: string) => deleteResource(resourceId),
    onSuccess: async (_data, resourceId) => {
      await invalidate(resourceId);
    },
  });
}

export function useArchiveResource() {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (resourceId: string) => archiveResource(resourceId),
    onSuccess: async (_data, resourceId) => {
      await invalidate(resourceId);
    },
  });
}

export function useUnarchiveResource() {
  const invalidate = useInvalidateResources();
  return useMutation({
    mutationFn: (resourceId: string) => unarchiveResource(resourceId),
    onSuccess: async (_data, resourceId) => {
      await invalidate(resourceId);
    },
  });
}

export function useReplaceEventResources(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEventResourcesRequest) => replaceEventResources(eventId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: resourceKeys.eventList(eventId),
      });
    },
  });
}
