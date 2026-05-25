import { useStore } from "@tanstack/react-form";
import type { EventFormState } from "@/lib/events";

// Bridges a TanStack form to the plain { value, onChange } shape the shared
// field components (ScheduleFields, LocationField, ScheduleSection) expect:
// live `values` for rendering and a string `setField` for writes.
export function useEventFormFields(form: {
  store: Parameters<typeof useStore>[0];
  setFieldValue: (field: keyof EventFormState, value: never) => void;
}) {
  const values = useStore(form.store, (s) => s.values as EventFormState);
  const setField = (field: keyof EventFormState, value: string) =>
    form.setFieldValue(field, value as never);
  return { values, setField };
}
