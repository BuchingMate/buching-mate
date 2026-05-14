/* eslint-disable react/no-children-prop */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ResourceType } from "@workspace/contracts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fieldVisibilityFor,
  resourceTypeDescriptions,
  resourceTypeLabels,
  resourceTypes,
} from "@/lib/resource-form";

function FieldError({ field }: { field: any }) {
  const error = field.state.meta.errors[0];
  if (!error) return null;
  return (
    <p className="text-xs text-destructive">
      {String((error as { message?: string }).message ?? error)}
    </p>
  );
}

export function ResourceFormFields({ form, lockType = false }: { form: any; lockType?: boolean }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-3"
    >
      <form.Field
        name="type"
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Type</Label>
            <select
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value as ResourceType)}
              onBlur={field.handleBlur}
              disabled={lockType}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resourceTypes.map((type) => (
                <option key={type} value={type}>
                  {resourceTypeLabels[type]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {resourceTypeDescriptions[field.state.value as ResourceType]}
            </p>
          </div>
        )}
      />

      <form.Field
        name="name"
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Name</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              required
            />
            <FieldError field={field} />
          </div>
        )}
      />

      <form.Field
        name="description"
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Description</Label>
            <Textarea
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Optional"
              rows={2}
            />
          </div>
        )}
      />

      <form.Subscribe
        selector={(state: any) => state.values.type as ResourceType}
        children={(type: ResourceType) => {
          const visibility = fieldVisibilityFor(type);
          return (
            <div className="space-y-3">
              {visibility.email && (
                <form.Field
                  name="email"
                  children={(field: any) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Email</Label>
                      <Input
                        id={field.name}
                        type="email"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Optional"
                      />
                    </div>
                  )}
                />
              )}

              {visibility.phone && (
                <form.Field
                  name="phone"
                  children={(field: any) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>Phone</Label>
                      <Input
                        id={field.name}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Optional"
                      />
                    </div>
                  )}
                />
              )}

              {visibility.capacity && (
                <form.Field
                  name="capacity"
                  children={(field: any) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>{visibility.capacityLabel}</Label>
                      <Input
                        id={field.name}
                        type="number"
                        min={0}
                        step={1}
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Optional"
                      />
                    </div>
                  )}
                />
              )}

              {visibility.url && (
                <form.Field
                  name="url"
                  children={(field: any) => (
                    <div className="space-y-2">
                      <Label htmlFor={field.name}>{visibility.urlLabel}</Label>
                      <Input
                        id={field.name}
                        type="url"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        placeholder="Optional"
                      />
                    </div>
                  )}
                />
              )}

              {visibility.cost && (
                <div className="grid grid-cols-2 gap-3">
                  <form.Field
                    name="cost"
                    children={(field: any) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>{visibility.costLabel}</Label>
                        <Input
                          id={field.name}
                          type="number"
                          min={0}
                          step="0.01"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          onBlur={field.handleBlur}
                          placeholder="0.00"
                        />
                      </div>
                    )}
                  />
                  <form.Field
                    name="currency"
                    children={(field: any) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name}>Currency</Label>
                        <Input
                          id={field.name}
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value.toUpperCase())}
                          onBlur={field.handleBlur}
                          placeholder="USD"
                          maxLength={3}
                        />
                      </div>
                    )}
                  />
                </div>
              )}
            </div>
          );
        }}
      />

      <form.Field
        name="notes"
        children={(field: any) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Internal notes</Label>
            <Textarea
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
              placeholder="Only visible to your team"
              rows={2}
            />
          </div>
        )}
      />
    </form>
  );
}
