import type { EventStatus, EventVisibility } from "@workspace/contracts";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: EventStatus }) {
  const styles: Record<EventStatus, { variant: "default" | "destructive"; className: string }> = {
    upcoming: {
      variant: "default",
      className:
        "h-5 px-1.5 text-3xs capitalize bg-info text-info-foreground hover:bg-info/90 border-transparent",
    },
    completed: {
      variant: "default",
      className:
        "h-5 px-1.5 text-3xs capitalize bg-success text-success-foreground hover:bg-success/90 border-transparent",
    },
    cancelled: {
      variant: "destructive",
      className: "h-5 px-1.5 text-3xs capitalize",
    },
  };
  const { variant, className } = styles[status];
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}

export function VisibilityBadge({ visibility }: { visibility: EventVisibility }) {
  const variants: Record<
    EventVisibility,
    "default" | "secondary" | "destructive" | "outline" | "success"
  > = {
    unpublished: "outline",
    published: "success",
  };
  return (
    <Badge variant={variants[visibility]} className="h-5 px-1.5 text-3xs capitalize">
      {visibility}
    </Badge>
  );
}
