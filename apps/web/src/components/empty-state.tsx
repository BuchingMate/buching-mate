import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  size?: "default" | "compact";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed bg-muted/30 text-center",
        size === "compact" ? "p-10" : "p-12",
        className,
      )}
    >
      {icon && <div className="mx-auto text-muted-foreground/60 [&>svg]:mx-auto">{icon}</div>}
      <h2 className={cn("text-lg font-semibold tracking-tight", icon && "mt-3")}>{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
