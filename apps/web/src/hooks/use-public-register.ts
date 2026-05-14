import { useMutation } from "@tanstack/react-query";
import type { PublicRegistrationRequest } from "@workspace/contracts";
import { publicRegister } from "@/lib/public";

export function usePublicRegister(slug: string, eventId: string) {
  return useMutation({
    mutationFn: (input: PublicRegistrationRequest) => publicRegister(slug, eventId, input),
  });
}
