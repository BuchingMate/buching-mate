import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FilterChipProps {
  label: string;
  value: string;
  onClear: () => void;
}

export function FilterChip({ label, value, onClear }: FilterChipProps) {
  return (
    <Badge variant="outline" className="h-5 gap-1 px-1.5 text-3xs">
      {label}: {value}
      <button
        type="button"
        aria-label={`Clear ${label.toLowerCase()} filter ${value}`}
        onClick={onClear}
        className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-2.5" />
      </button>
    </Badge>
  );
}
