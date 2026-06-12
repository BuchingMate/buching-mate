import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { CalendarPlus } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { subscribeToOrgCalendar } from "@/lib/public";

// Public "Subscribe to Calendar" entry on an org's events page, for people who
// aren't booking right now. Opt-in marketing consent: an email + explicit click.
export function CalendarSubscribe({ slug, orgName }: { slug: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useMutation({
    mutationFn: () => subscribeToOrgCalendar(slug, { email: email.trim() }),
    onSuccess: () => setDone(true),
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : "Couldn't subscribe. Try again."),
  });

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setEmail("");
      setDone(false);
      setError(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    subscribe.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CalendarPlus className="size-4" />
        Subscribe to Calendar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Subscribe to {orgName}'s Calendar</DialogTitle>
          <DialogDescription>
            Get an email when {orgName} announces a new event. Unsubscribe anytime.
          </DialogDescription>
        </DialogHeader>
        {done ? (
          <Alert>
            <AlertDescription>
              You're subscribed. We'll email {email} about upcoming events.
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cal-sub-email">Email</Label>
              <Input
                id="cal-sub-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={subscribe.isPending}>
                {subscribe.isPending ? "Subscribing…" : "Subscribe"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
