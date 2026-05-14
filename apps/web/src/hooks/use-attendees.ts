import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateAttendeeRequest } from "@workspace/contracts";
import { createAttendee, updateAttendee } from "@/lib/attendees";
import { attendeeKeys } from "@/queries/attendees";

export function useCreateAttendee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAttendee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendeeKeys.lists() });
    },
  });
}

export function useUpdateAttendee(attendeeId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAttendeeRequest) => updateAttendee(attendeeId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: attendeeKeys.lists() });
    },
  });
}
