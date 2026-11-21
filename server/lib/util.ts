export const nowIso = () => new Date().toISOString();

export function addMonths(months: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!,
  );
}

const EMAIL_RE = /^[^\s@<>()",;:\\]{1,64}@[^\s@<>()",;:\\]+\.[^\s@<>()",;:\\]{2,}$/;
export function cleanEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export function cleanText(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

export const clientIp = (c: { req: { header(n: string): string | undefined } }) =>
  c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

// 32 symbols, no 0/O/1/I, so codes are easy to read out loud.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function referralCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (x) => ALPHABET[x % 32]).join("");
}

// Keeps line breaks (for message templates) but strips other control characters.
export function cleanMultiline(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

// "1,250.50", "£1250" and "300" all work. Returns pence, or null if not a sensible amount.
export function parsePounds(v: unknown): number | null {
  const s = String(v ?? "").replace(/[£,\s]/g, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}
