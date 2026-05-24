import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The framed, sandboxed shell both the composer and the brand editor render
// their live email preview into. Callers pass their own header chrome and the
// iframe height that suits their layout.
export function EmailPreviewFrame({
  title,
  srcDoc,
  header,
  className,
}: {
  title: string;
  srcDoc: string;
  header: ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/40">
      {header}
      <iframe
        title={title}
        srcDoc={srcDoc}
        sandbox=""
        className={cn("w-full border-0 bg-white", className)}
      />
    </div>
  );
}
