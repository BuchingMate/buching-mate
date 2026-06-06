// "Add to calendar" deep links for confirmation emails. The .ics attachment
// stays as the universal fallback; these links are the one-click path for the
// two dominant web calendars.

export interface CalendarLinkInput {
  title: string;
  description: string | null;
  startUtc: Date;
  endUtc: Date;
  location: string | null;
  joinUrl: string | null;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

// Google's TEMPLATE URL wants UTC basic format: YYYYMMDDTHHMMSSZ.
function googleDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function details(input: CalendarLinkInput): string {
  const parts: string[] = [];
  if (input.description) parts.push(input.description);
  if (input.joinUrl) parts.push(`Join: ${input.joinUrl}`);
  return parts.join("\n\n");
}

export function googleCalendarUrl(input: CalendarLinkInput): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${googleDate(input.startUtc)}/${googleDate(input.endUtc)}`,
  });
  const body = details(input);
  if (body) params.set("details", body);
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(input: CalendarLinkInput): string {
  const params = new URLSearchParams({
    rru: "addevent",
    subject: input.title,
    startdt: input.startUtc.toISOString(),
    enddt: input.endUtc.toISOString(),
  });
  const body = details(input);
  if (body) params.set("body", body);
  if (input.location) params.set("location", input.location);
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}
