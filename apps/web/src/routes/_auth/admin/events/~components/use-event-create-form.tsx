import { useForm } from "@tanstack/react-form";
import { defaultEventForm, eventFormSchema, type EventFormState } from "@/lib/events";

export function useEventCreateForm(onSubmit: (value: EventFormState) => void | Promise<void>) {
  return useForm({
    defaultValues: defaultEventForm(),
    validators: { onChange: eventFormSchema, onSubmit: eventFormSchema },
    onSubmit: ({ value }: { value: EventFormState }) => onSubmit(value),
  });
}
