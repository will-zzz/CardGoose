/** Minimal CSV parser: first row = headers, supports quoted fields. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && c === ',') {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).filter((h) => h.length > 0);
  if (headers.length === 0) return { headers: [], rows: [] };
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r]);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}
