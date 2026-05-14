import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AccessDenied({
  title = "Access denied",
  message,
  onBack,
}: {
  title?: string;
  message: string;
  onBack?: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onBack && (
        <CardContent>
          <Button variant="outline" onClick={onBack}>
            Back to dashboard
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
