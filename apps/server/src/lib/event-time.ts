// Timezone-aware conversion of an event's wall-clock date/time (interpreted in
// the event's IANA timezone) into a UTC instant. Uses Intl offset math — no deps.
// When timezone is "UTC" the offset is 0, so results are byte-for-byte identical
// to the previous naive `new Date(`${date}T${hh:mm}:00Z`)` behavior.

function offsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - instant.getTime();
}

function normalizeTime(time: string): [number, number] {
  const hhmm = time.length >= 5 ? time.slice(0, 5) : "00:00";
  const [h, m] = hhmm.split(":").map(Number);
  return [Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0];
}

/** Interpret `date` (YYYY-MM-DD) + `time` (HH:MM) as wall-clock in `timezone`, return the UTC instant. */
export function zonedWallClockToUtc(date: string, time: string, timezone: string): Date {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = normalizeTime(time);
  const naive = Date.UTC(y, mo - 1, d, h, mi, 0);
  // Two-pass: offset can differ across the DST transition the naive guess lands in.
  const guess = naive - offsetMs(new Date(naive), timezone);
  const offset = offsetMs(new Date(guess), timezone);
  return new Date(naive - offset);
}

export function eventStartUtc(date: string, time: string, timezone: string): Date {
  return zonedWallClockToUtc(date, time, timezone);
}

export function eventEndUtc(
  endDate: string | null,
  endTime: string | null,
  timezone: string,
): Date | null {
  if (!endDate || !endTime) return null;
  return zonedWallClockToUtc(endDate, endTime, timezone);
}

export function durationMinutes(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

/** Inverse of zonedWallClockToUtc: a UTC instant → wall-clock date/time strings in `timezone`. */
export function utcToZonedWallClock(
  instant: Date,
  timezone: string,
): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${hour}:${parts.minute}` };
}
