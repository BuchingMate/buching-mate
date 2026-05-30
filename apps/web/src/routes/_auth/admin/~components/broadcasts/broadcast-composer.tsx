import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  EMPTY_EMAIL_BRANDING,
  renderBroadcastEmail,
  type BroadcastAudience,
  type BroadcastKind,
} from "@workspace/contracts";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmailPreviewFrame } from "../email-preview-frame";
import { createBroadcast } from "@/lib/broadcasts";
import { broadcastKeys } from "@/queries/broadcasts";
import { currentOrgQueryOptions } from "@/queries/auth";
import { eventsQueryOptions } from "@/queries/events";
import { orgSettingsQueryOptions } from "@/queries/org";

type AudienceChoice = BroadcastAudience["type"];

// A compact two-option toggle. Quieter and more tactile than a dropdown for a
// binary choice, and the active option carries the one accent.
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-muted/40 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "h-7 rounded-[0.3rem] px-3 text-xs font-medium transition-colors",
            value === option.value
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function BroadcastComposer({ onCreated }: { onCreated?: () => void } = {}) {
  const queryClient = useQueryClient();
  const orgQuery = useQuery(currentOrgQueryOptions);
  const settingsQuery = useQuery(orgSettingsQueryOptions);
  const eventsQuery = useQuery(eventsQueryOptions);
  const events = eventsQuery.data?.events ?? [];
  const orgName = orgQuery.data?.org.name ?? "Your organization";

  const [kind, setKind] = useState<BroadcastKind>("newsletter");
  const [audienceChoice, setAudienceChoice] = useState<AudienceChoice>("all_attendees");
  const [eventId, setEventId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  // Narrow widths show one pane at a time; wide widths show both side by side.
  const [pane, setPane] = useState<"compose" | "preview">("compose");

  // The brand is org-wide config, edited in Settings. Read it here for the preview.
  const branding = settingsQuery.data?.settings.emailBranding ?? EMPTY_EMAIL_BRANDING;
  const orgSlug = orgQuery.data?.org.slug ?? "";

  const audience: BroadcastAudience | null =
    audienceChoice === "all_attendees"
      ? { type: "all_attendees" }
      : eventId
        ? { type: "event_guests", eventId }
        : null;

  // The preview renders the exact email the server will send.
  const previewHtml = useMemo(
    () =>
      renderBroadcastEmail({
        subject: subject.trim() || "Your subject line",
        bodyHtml: bodyHtml.trim() || "<p>Start writing to see your message here.</p>",
        orgName,
        branding,
      }),
    [subject, bodyHtml, orgName, branding],
  );

  const audienceLabel =
    audienceChoice === "all_attendees"
      ? "All past attendees"
      : (events.find((e) => e.id === eventId)?.title ?? "an event's guests");

  const createMutation = useMutation({
    mutationFn: createBroadcast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: broadcastKeys.all });
      setSubject("");
      setBodyHtml("");
      onCreated?.();
    },
  });

  const canSubmit =
    Boolean(subject.trim() && bodyHtml.trim() && audience) && !createMutation.isPending;

  return (
    <section className="@container space-y-4">
      {/* Below the split breakpoint, toggle between the two panes */}
      <div className="@3xl:hidden">
        <Segmented
          value={pane}
          onChange={setPane}
          options={[
            { value: "compose", label: "Compose" },
            { value: "preview", label: "Preview" },
          ]}
        />
      </div>

      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Editor */}
        <div className={cn("space-y-6", pane === "compose" ? "block" : "hidden", "@3xl:block")}>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Type</Label>
              <Segmented
                value={kind}
                onChange={setKind}
                options={[
                  { value: "newsletter", label: "Newsletter" },
                  { value: "invitation", label: "Invitation" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Audience</Label>
              <Segmented
                value={audienceChoice}
                onChange={setAudienceChoice}
                options={[
                  { value: "all_attendees", label: "All attendees" },
                  { value: "event_guests", label: "Event guests" },
                ]}
              />
            </div>
            {audienceChoice === "event_guests" && (
              <div className="min-w-48 flex-1 space-y-1.5">
                <Label className="text-muted-foreground">Event</Label>
                <Select value={eventId} onValueChange={(v) => setEventId(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-subject" className="text-muted-foreground">
              Subject
            </Label>
            <Input
              id="broadcast-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="broadcast-body" className="text-muted-foreground">
              Message
            </Label>
            <Textarea
              id="broadcast-body"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={10}
              placeholder="Write your message. Basic HTML is supported."
              className="resize-y font-mono text-xs leading-relaxed"
            />
          </div>

          <p className="border-t border-border pt-5 text-xs text-muted-foreground">
            The brand below (logo, accent, footer) is set once in{" "}
            {orgSlug ? (
              <Link
                to="/admin/$orgSlug/settings"
                params={{ orgSlug }}
                search={{ tab: "general" }}
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                Settings → General
              </Link>
            ) : (
              <span className="text-foreground">Settings → Email</span>
            )}
            .
          </p>

          <div className="flex flex-col items-start gap-3 border-t border-border pt-5 sm:flex-row sm:items-center">
            <Button
              className="w-full sm:w-auto"
              disabled={!canSubmit}
              onClick={() => {
                if (audience)
                  createMutation.mutate({ kind, subject: subject.trim(), bodyHtml, audience });
              }}
            >
              Save draft
            </Button>
            <span className="text-xs text-muted-foreground">
              {createMutation.isError ? (
                "Could not save. Check the fields and retry."
              ) : (
                <>
                  Goes to <span className="text-foreground">{audienceLabel}</span> when you send.
                </>
              )}
            </span>
          </div>
        </div>

        {/* Live preview */}
        <div
          className={cn(
            pane === "preview" ? "block" : "hidden",
            "@3xl:block @3xl:sticky @3xl:top-6",
          )}
        >
          <EmailPreviewFrame
            title="Email preview"
            srcDoc={previewHtml}
            className="h-[34rem] @3xl:h-[46rem]"
            header={
              <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {subject.trim() || "Your subject line"}
                  </p>
                  <p className="truncate text-2xs text-muted-foreground">
                    From {orgName} · To {audienceLabel}
                  </p>
                </div>
                <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                  Live preview
                </span>
              </div>
            }
          />
        </div>
      </div>
    </section>
  );
}
