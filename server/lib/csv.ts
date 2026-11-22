// A cell starting with = + - @ can run as a formula in Excel, so it gets a leading quote mark.
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (rows: unknown[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
