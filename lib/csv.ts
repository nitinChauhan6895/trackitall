// CSV generation for data export.
//
// Everything is quoted and internal quotes doubled (RFC 4180), so names
// containing commas, quotes or newlines survive the round trip into Excel or
// Sheets intact.

export function csvCell(value: unknown): string {
  if (value == null) return '""';
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  // CRLF is what Excel expects.
  return lines.join("\r\n");
}
