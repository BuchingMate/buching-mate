import { api } from "./api";

export type ImportRow = { name: string; email: string; phone?: string | null };

export type ImportOutcome = {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; email: string; reason: string }>;
};

export function importRegistrations(eventId: string, rows: ImportRow[]) {
  return api.post<ImportOutcome>(
    `/api/events/${eventId}/registrations/import`,
    { rows },
  );
}

export function parseAttendeeCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const headerCells = splitCsvLine(lines[0]!).map((c) => c.toLowerCase());
  const idxName = headerCells.indexOf("name");
  const idxEmail = headerCells.indexOf("email");
  const idxPhone = headerCells.indexOf("phone");
  if (idxName === -1 || idxEmail === -1) return [];

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const name = (cells[idxName] ?? "").trim();
    const email = (cells[idxEmail] ?? "").trim();
    if (!name && !email) continue;
    rows.push({
      name,
      email,
      phone: idxPhone >= 0 ? (cells[idxPhone] ?? null) : null,
    });
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
