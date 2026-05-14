import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createRegistration, deleteRegistration, updateRegistration } from "@/lib/registrations";
import type {
  CreateRegistrationRequest,
  UpdateRegistrationRequest,
  RegistrationWithAttendeeDto,
} from "@workspace/contracts";
import { registrationKeys } from "@/queries/registrations";
import { eventKeys } from "@/queries/events";

export function useCreateRegistration(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRegistrationRequest) => createRegistration(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: registrationKeys.list(eventId) }),
        queryClient.invalidateQueries({ queryKey: eventKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
      ]);
    },
  });
}

export function useUpdateRegistration(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRegistrationRequest }) =>
      updateRegistration(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({
        queryKey: registrationKeys.list(eventId),
      });

      const previousRegistrations = queryClient.getQueryData<{
        registrations: RegistrationWithAttendeeDto[];
      }>(registrationKeys.list(eventId));

      if (previousRegistrations) {
        queryClient.setQueryData(registrationKeys.list(eventId), {
          registrations: previousRegistrations.registrations.map((r) =>
            r.id === id ? { ...r, ...input } : r,
          ),
        });
      }

      return { previousRegistrations };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousRegistrations) {
        queryClient.setQueryData(registrationKeys.list(eventId), context.previousRegistrations);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: registrationKeys.list(eventId),
      });
      await queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}

export function useDeleteRegistration(eventId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteRegistration,
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: registrationKeys.list(eventId),
      });

      const previousRegistrations = queryClient.getQueryData<{
        registrations: RegistrationWithAttendeeDto[];
      }>(registrationKeys.list(eventId));

      if (previousRegistrations) {
        queryClient.setQueryData(registrationKeys.list(eventId), {
          registrations: previousRegistrations.registrations.filter((r) => r.id !== id),
        });
      }

      return { previousRegistrations };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousRegistrations) {
        queryClient.setQueryData(registrationKeys.list(eventId), context.previousRegistrations);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: registrationKeys.list(eventId),
      });
      await queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      await queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
    },
  });
}
