import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ICON_NAMES, getIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";

export function IconPicker({
  value,
  onChange,
  size = "md",
}: {
  value: string | null | undefined;
  onChange: (name: string | null) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const Selected = getIcon(value);
  const trigger = size === "sm" ? "size-7" : "size-9";

  const matches = filter
    ? ICON_NAMES.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))
    : ICON_NAMES;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Pick icon"
            className={cn(
              "flex shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent",
              trigger,
            )}
          />
        }
      >
        {Selected ? <Selected className="size-4" /> : <Plus className="size-4" />}
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search icons"
              className="h-8 text-sm"
            />
            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                aria-label="Clear icon"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          <div className="grid max-h-56 grid-cols-7 gap-1 overflow-y-auto pr-1">
            {matches.map((name) => {
              const Icon = getIcon(name);
              if (!Icon) return null;
              const active = value === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  title={name}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    active && "bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  <Icon className="size-4" />
                </button>
              );
            })}
            {matches.length === 0 && (
              <p className="col-span-7 py-4 text-center text-xs text-muted-foreground">
                No icons match
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
