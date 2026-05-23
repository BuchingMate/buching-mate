function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatIcsDate(d: Date): string {
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

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  while (remaining.length > 75) {
    parts.push(remaining.slice(0, 75));
    remaining = " " + remaining.slice(75);
  }
  parts.push(remaining);
  return parts.join("\r\n");
}

export function buildEventIcs(input: {
  uid: string;
  title: string;
  description: string | null;
  startUtc: Date;
  endUtc: Date;
  location: string | null;
  joinUrl: string | null;
  organizerEmail: string | null;
  organizerName: string | null;
}): string {
  const descriptionParts: string[] = [];
  if (input.description) descriptionParts.push(input.description);
  if (input.joinUrl) descriptionParts.push(`Join: ${input.joinUrl}`);
  const description = descriptionParts.join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//buchingmate//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeIcs(input.uid)}`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(input.startUtc)}`,
    `DTEND:${formatIcsDate(input.endUtc)}`,
    `SUMMARY:${escapeIcs(input.title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (input.location) lines.push(`LOCATION:${escapeIcs(input.location)}`);
  if (input.joinUrl) lines.push(`URL:${escapeIcs(input.joinUrl)}`);
  if (input.organizerEmail) {
    const cn = input.organizerName ? `;CN=${escapeIcs(input.organizerName)}` : "";
    lines.push(`ORGANIZER${cn}:mailto:${input.organizerEmail}`);
  }
  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n");
}
