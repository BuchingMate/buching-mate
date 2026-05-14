import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const COLOR_SWATCHES = [
  "#7986cb",
  "#33b679",
  "#8e24aa",
  "#e67c73",
  "#f6bf26",
  "#f4511e",
  "#039be5",
  "#616161",
  "#3f51b5",
  "#0b8043",
  "#d50000",
  "#ad1457",
];

export function ColorPicker({
  value,
  onChange,
  ariaLabelPrefix,
}: {
  value: string | null | undefined;
  onChange: (color: string) => void;
  ariaLabelPrefix?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_SWATCHES.map((color) => {
        const active = value === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            aria-label={ariaLabelPrefix ? `${ariaLabelPrefix} ${color}` : color}
            style={{ backgroundColor: color }}
            className={cn(
              "relative size-6 rounded-full transition-transform hover:scale-110",
              active && "ring-2 ring-primary ring-offset-2",
            )}
          >
            {active && <Check className="absolute inset-0 m-auto size-3.5 text-white" />}
          </button>
        );
      })}
    </div>
  );
}
