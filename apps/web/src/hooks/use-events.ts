import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createEvent,
  deleteEvent,
  duplicateEvent,
  updateEvent,
  type EventFormState,
  formToEventRequest,
} from "@/lib/events";
import { eventKeys } from "@/queries/events";
import type { UpdateEventRequest } from "@workspace/contracts";

export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

export function useUpdateEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: EventFormState) => updateEvent(eventId, formToEventRequest(input)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
      ]);
    },
  });
}

export function usePatchEvent(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEventRequest) => updateEvent(eventId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
      ]);
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

export function useDuplicateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: duplicateEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}
