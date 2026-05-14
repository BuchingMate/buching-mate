import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <AppShell title={title} description={description}>
      <Card className="relative max-w-2xl overflow-hidden rounded-xl shadow-sm">
        <div className="pointer-events-none absolute -right-3 -top-12 select-none font-heading text-[9rem] font-semibold leading-none tracking-[-0.08em] text-muted">
          00
        </div>
        <CardHeader className="border-b">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Planned workspace
          </p>
          <CardTitle className="text-2xl tracking-tight">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <p className="max-w-lg text-sm leading-6 text-muted-foreground">
            This domain area is visible now so navigation can grow around the product model. The
            feature implementation will land in its planned milestone.
          </p>
        </CardContent>
      </Card>
    </AppShell>
  );
}
