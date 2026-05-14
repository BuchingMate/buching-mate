import { useEffect, useState } from "react";
import type { EventDto } from "@workspace/contracts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateEvent } from "@/hooks/use-events";
import { emptyEventForm, formToEventRequest, type EventFormState } from "@/lib/events";

export interface InlineCreateFormProps {
  prefill: { date?: string; time?: string; duration?: string } | null;
  onCreated: (event: EventDto) => void;
}

export function InlineCreateForm({ prefill, onCreated }: InlineCreateFormProps) {
  const [form, setForm] = useState<EventFormState>(emptyEventForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const createMutation = useCreateEvent();

  useEffect(() => {
    if (!prefill) return;
    setForm((current) => ({
      ...current,
      date: prefill.date ?? current.date,
      time: prefill.time ?? current.time,
      duration: prefill.duration ?? current.duration,
    }));
    setSuccess("");
  }, [prefill]);

  const update = (field: keyof EventFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      const result = await createMutation.mutateAsync(formToEventRequest(form));
      onCreated(result.event);
      setSuccess(`Created “${result.event.title}”`);
      setForm({ ...emptyEventForm, date: form.date, time: "", duration: "60" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create event");
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-3">
      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-success dark:bg-success/15">
          {success}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ic-title" className="text-xs text-muted-foreground">
          Title
        </Label>
        <Input
          id="ic-title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          required
          className="h-8 text-sm"
          placeholder="Morning yoga"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={form.allDay === "true"}
          onChange={(e) => update("allDay", e.target.checked ? "true" : "false")}
          className="size-3.5"
        />
        All-day event
      </label>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="ic-date" className="text-xs text-muted-foreground">
            Date
          </Label>
          <DatePicker
            id="ic-date"
            value={form.date}
            onChange={(value) => update("date", value)}
            required
            className="h-8 text-sm"
          />
        </div>
        {form.allDay === "false" && (
          <div className="space-y-1.5">
            <Label htmlFor="ic-time" className="text-xs text-muted-foreground">
              Time
            </Label>
            <Input
              id="ic-time"
              type="time"
              value={form.time}
              onChange={(e) => update("time", e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {form.allDay === "false" && (
          <div className="space-y-1.5">
            <Label htmlFor="ic-duration" className="text-xs text-muted-foreground">
              Duration (min)
            </Label>
            <Input
              id="ic-duration"
              type="number"
              min="1"
              value={form.duration}
              onChange={(e) => update("duration", e.target.value)}
              required
              className="h-8 text-sm"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="ic-capacity" className="text-xs text-muted-foreground">
            Capacity
          </Label>
          <Input
            id="ic-capacity"
            type="number"
            min="1"
            value={form.maxCapacity}
            onChange={(e) => update("maxCapacity", e.target.value)}
            className="h-8 text-sm"
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ic-category" className="text-xs text-muted-foreground">
          Category
        </Label>
        <Input
          id="ic-category"
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          className="h-8 text-sm"
          placeholder="Workshop, class, meeting…"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ic-tags" className="text-xs text-muted-foreground">
          Tags
        </Label>
        <Input
          id="ic-tags"
          value={form.tags}
          onChange={(e) => update("tags", e.target.value)}
          className="h-8 text-sm"
          placeholder="urgent, vip (comma separated)"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ic-notes" className="text-xs text-muted-foreground">
          Internal notes
        </Label>
        <Textarea
          id="ic-notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          className="min-h-16 text-sm"
          placeholder="Setup, AV, dietary…"
        />
      </div>

      <Button type="submit" disabled={createMutation.isPending} size="sm" className="mt-1">
        {createMutation.isPending ? "Creating…" : "Add to calendar"}
      </Button>

      <p className="text-2xs text-muted-foreground leading-relaxed">
        Add the basics here, then open the event to set capacity, resources, and recurrence.
      </p>
    </form>
  );
}
