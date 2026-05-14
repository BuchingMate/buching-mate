import { useState } from "react";
import type { CategoryConfigs } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/color-picker";
import { IconPicker } from "@/components/icon-picker";
import { getIcon } from "@/lib/icons";

export function CategoriesEditor({
  categories,
  configs,
  onChange,
  disabled,
}: {
  categories: string[];
  configs: CategoryConfigs;
  onChange: (next: { categories: string[]; configs: CategoryConfigs }) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name || categories.includes(name)) return;
    onChange({ categories: [...categories, name], configs });
    setDraft("");
  };

  const setColor = (category: string, color: string) => {
    onChange({
      categories,
      configs: { ...configs, [category]: { ...configs[category], color } },
    });
  };

  const setIconName = (category: string, icon: string | null) => {
    const next = { ...configs[category], icon: icon ?? undefined };
    if (icon === null) delete next.icon;
    onChange({ categories, configs: { ...configs, [category]: next } });
  };

  const remove = (category: string) => {
    const { [category]: _drop, ...rest } = configs;
    onChange({ categories: categories.filter((c) => c !== category), configs: rest });
  };

  return (
    <div className="space-y-4">
      {categories.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No categories yet. Add one below to assign a color and icon.
        </p>
      )}

      <div className="space-y-3">
        {categories.map((category) => {
          const cfg = configs[category];
          const Icon = getIcon(cfg?.icon);
          return (
            <div key={category} className="flex flex-wrap items-center gap-3 rounded-md border p-3">
              <div className="flex min-w-32 items-center gap-2">
                <span
                  className="flex size-6 items-center justify-center rounded-full ring-1 ring-border"
                  style={{ backgroundColor: cfg?.color ?? "#cbd5e1" }}
                >
                  {Icon && <Icon className="size-3.5 text-white" />}
                </span>
                <span className="text-sm font-medium">{category}</span>
              </div>
              <IconPicker
                size="sm"
                value={cfg?.icon}
                onChange={(name) => setIconName(category, name)}
              />
              <ColorPicker
                value={cfg?.color}
                onChange={(color) => setColor(category, color)}
                ariaLabelPrefix={`Set ${category} to`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-xs text-muted-foreground"
                onClick={() => remove(category)}
                disabled={disabled}
              >
                Remove
              </Button>
            </div>
          );
        })}
      </div>

      <form onSubmit={add} className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New category name"
          className="h-9 max-w-xs text-sm"
          disabled={disabled}
        />
        <Button type="submit" size="sm" disabled={!draft.trim() || disabled}>
          Add
        </Button>
      </form>
    </div>
  );
}
