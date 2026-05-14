/* eslint-disable react/no-children-prop */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { EventImageDto } from "@workspace/contracts";
import { orgSettingsQueryOptions } from "@/queries/org";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicAssetUpload } from "@/components/public-asset-upload";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventFormState } from "@/lib/events";
import { deletePublicAsset } from "@/lib/assets";
import { eventKeys } from "@/queries/events";
import type { useEventDetailsForm } from "./use-event-details-form";

type FormApi = ReturnType<typeof useEventDetailsForm>;

export function EventDetailsForm({
  eventId,
  detailImages,
  form,
  canManage,
  onError,
}: {
  eventId: string;
  detailImages: EventImageDto[];
  form: FormApi;
  canManage: boolean;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [removingImageId, setRemovingImageId] = useState<string | null>(null);
  const [section, setSection] = useState<string>("basics");
  const { data: orgSettings } = useQuery(orgSettingsQueryOptions);
  const currency = orgSettings?.settings.currency ?? "USD";

  const refreshEvent = async () => {
    await queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
  };

  const removeDetailImage = async (imageId: string) => {
    setRemovingImageId(imageId);
    onError("");
    try {
      await deletePublicAsset(imageId);
      await refreshEvent();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to remove image");
    } finally {
      setRemovingImageId(null);
    }
  };

  return (
    <form
      id="event-details-form"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Tabs value={section} onValueChange={(value) => setSection(value as string)}>
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="basics">Basics</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="recurrence">Recurrence</TabsTrigger>
        </TabsList>

        <BasicsPanel active={section === "basics"}>
          <Card>
            <CardHeader>
              <CardTitle>Schedule & capacity</CardTitle>
              <CardDescription>When, where, how many.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <form.Field
                name="title"
                children={(field) => (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={field.name}>Title</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      required
                    />
                  </div>
                )}
              />

              <form.Field
                name="date"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Date</Label>
                    <DatePicker
                      id={field.name}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      required
                    />
                  </div>
                )}
              />
              <form.Field
                name="time"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Time</Label>
                    <Input
                      id={field.name}
                      type="time"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      required
                    />
                  </div>
                )}
              />

              <form.Field
                name="duration"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Duration</Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      required
                    />
                    <p className="text-xs text-muted-foreground">In minutes.</p>
                  </div>
                )}
              />
              <form.Field
                name="maxCapacity"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Capacity</Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      placeholder="Leave blank for unlimited"
                    />
                  </div>
                )}
              />

              <form.Field
                name="location"
                children={(field) => (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={field.name}>Location</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                    />
                  </div>
                )}
              />

              <form.Field
                name="status"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Status</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(value as EventFormState["status"])
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <form.Field
                name="visibility"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Visibility</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(value as EventFormState["visibility"])
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger id={field.name}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="unpublished">Unpublished</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <Collapsible className="mt-4 overflow-hidden rounded-xl border bg-card shadow-xs ring-1 ring-foreground/10">
            <CollapsibleTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30"
                />
              }
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-medium">Internal notes</span>
                <span className="text-xs text-muted-foreground">
                  Team-only. Setup, dietary, AV requirements.
                </span>
              </span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t px-6 pb-6 pt-4">
              <form.Field
                name="notes"
                children={(field) => (
                  <Textarea
                    id={field.name}
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                    disabled={!canManage}
                    className="min-h-24"
                    placeholder="Setup, dietary, AV requirements…"
                  />
                )}
              />
            </CollapsibleContent>
          </Collapsible>
        </BasicsPanel>

        <ContentPanel active={section === "content"}>
          <Card>
            <CardHeader>
              <CardTitle>Public copy</CardTitle>
              <CardDescription>Description, classification, pricing.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <form.Field
                name="category"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Category</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                    />
                  </div>
                )}
              />
              <form.Field
                name="price"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Price</Label>
                    <div className="flex h-9 w-full items-center rounded-md border bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
                      <span className="flex h-full select-none items-center border-r px-3 text-sm font-medium text-muted-foreground">
                        {currency}
                      </span>
                      <Input
                        id={field.name}
                        inputMode="decimal"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        disabled={!canManage}
                        required
                        placeholder="0.00"
                        className="h-full flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Currency set by org default. Change in Settings → General.
                    </p>
                  </div>
                )}
              />
              <form.Field
                name="tags"
                children={(field) => (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={field.name}>Tags</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      placeholder="urgent, vip, sponsor (comma separated)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Free-form labels for filtering and color hints. Comma separated.
                    </p>
                  </div>
                )}
              />
              <form.Field
                name="description"
                children={(field) => (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={field.name}>Description</Label>
                    <Textarea
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      className="min-h-28"
                    />
                    <p className="text-xs text-muted-foreground">Public-facing copy.</p>
                  </div>
                )}
              />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Media</CardTitle>
              <CardDescription>Cover image and gallery shown on the event page.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form.Field
                name="imageUrl"
                children={(field) => (
                  <div className="space-y-2">
                    <PublicAssetUpload
                      label="Cover image"
                      kind="event_image"
                      role="cover"
                      eventId={eventId}
                      value={field.state.value || null}
                      disabled={!canManage}
                      onChange={(url) => field.handleChange(url ?? "")}
                      onUploaded={() => void refreshEvent()}
                      onError={onError}
                    />
                    <p className="text-xs text-muted-foreground">
                      Shown on event cards and at the top of the event page.
                    </p>
                  </div>
                )}
              />
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Event detail images</Label>
                  <p className="text-xs text-muted-foreground">Shown in the event page gallery.</p>
                </div>
                <PublicAssetUpload
                  label="Add detail image"
                  kind="event_image"
                  role="detail"
                  eventId={eventId}
                  value={null}
                  disabled={!canManage}
                  onChange={() => {}}
                  onUploaded={() => void refreshEvent()}
                  onError={onError}
                />
                {detailImages.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {detailImages.map((image) => (
                      <div
                        key={image.id}
                        className="overflow-hidden rounded-lg border bg-muted/20 shadow-xs"
                      >
                        <div className="aspect-[16/9] bg-muted">
                          <img src={image.url} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate text-xs text-muted-foreground">
                            Gallery image
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!canManage || removingImageId === image.id}
                            onClick={() => void removeDetailImage(image.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </ContentPanel>

        <RecurrencePanel active={section === "recurrence"}>
          <Card>
            <CardHeader>
              <CardTitle>Recurrence</CardTitle>
              <CardDescription>
                Stored on the event for future recurrence expansion.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <form.Field
                name="recurring"
                children={(field) => (
                  <div className="space-y-2">
                    <Label>Repeats</Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) =>
                        field.handleChange(value as EventFormState["recurring"])
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="false">No</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <form.Field
                name="recurrenceFrequency"
                children={(field) => (
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={field.state.value || "none"}
                      onValueChange={(value) =>
                        field.handleChange(value === "none" || value === null ? "" : value)
                      }
                      disabled={!canManage}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Biweekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
              <form.Field
                name="recurrenceInterval"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>Interval</Label>
                    <Input
                      id={field.name}
                      type="number"
                      min="1"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                    />
                  </div>
                )}
              />
              <form.Field
                name="recurrenceEndDate"
                children={(field) => (
                  <div className="space-y-2">
                    <Label htmlFor={field.name}>End date</Label>
                    <DatePicker
                      id={field.name}
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                    />
                  </div>
                )}
              />
              <form.Field
                name="recurrenceDays"
                children={(field) => (
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={field.name}>Days of week</Label>
                    <Input
                      id={field.name}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      disabled={!canManage}
                      placeholder="monday, wednesday"
                    />
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </RecurrencePanel>
      </Tabs>
    </form>
  );
}

function BasicsPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <TabsContent value="basics" hidden={!active} keepMounted className="data-[hidden]:hidden">
      {children}
    </TabsContent>
  );
}

function ContentPanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <TabsContent value="content" hidden={!active} keepMounted className="data-[hidden]:hidden">
      {children}
    </TabsContent>
  );
}

function RecurrencePanel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <TabsContent value="recurrence" hidden={!active} keepMounted className="data-[hidden]:hidden">
      {children}
    </TabsContent>
  );
}
