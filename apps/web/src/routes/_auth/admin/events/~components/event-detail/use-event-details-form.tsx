import { useForm } from "@tanstack/react-form";
import { eventFormSchema, eventToForm, type EventFormState } from "@/lib/events";
import type { EventDto } from "@workspace/contracts";
import type { useUpdateEvent } from "@/hooks/use-events";
import { useOrgCurrency } from "@/hooks/use-org";

export function useEventDetailsForm({
  event,
  saveMutation,
  onError,
}: {
  event: EventDto;
  saveMutation: ReturnType<typeof useUpdateEvent>;
  onError: (message: string) => void;
}) {
  const currency = useOrgCurrency();
  return useForm({
    defaultValues: eventToForm(event, currency),
    validators: {
      onChange: eventFormSchema,
      onSubmit: eventFormSchema,
    },
    onSubmit: ({
      value,
      formApi,
    }: {
      value: EventFormState;
      formApi: { reset: (v: EventFormState) => void };
    }) => {
      saveMutation.mutate(value, {
        onSuccess: (data) => formApi.reset(eventToForm(data.event, currency)),
        onError: (err) => onError(err instanceof Error ? err.message : "Unable to save event"),
      });
    },
  });
}
