import type { Db } from "./db.js";

const DAY = 864e5;
const mondayOf = (d: Date) => new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);

// Counts only. Never returns a client name or email.
export async function loadStats(db: Db, adminEmail: string, now = new Date()) {
  const one = async <T>(sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).first<T>())!;
  const iso = now.toISOString();
  const since = new Date(now.getTime() - 8 * 7 * DAY).toISOString();

  const weekly = await db.prepare(
    `SELECT strftime('%Y-%m-%d', created_at, 'weekday 0', '-6 days') AS week, COUNT(*) AS n
     FROM waitlist WHERE created_at >= ? GROUP BY week`,
  ).bind(since).all<{ week: string; n: number }>();
  const byWeek = new Map(weekly.results.map((r) => [r.week, r.n]));
  const signupsPerWeek = Array.from({ length: 8 }, (_, i) => {
    const week = mondayOf(new Date(now.getTime() - (7 - i) * 7 * DAY));
    return { week, signups: byWeek.get(week) ?? 0 };
  });

  const wl = await db.prepare("SELECT status, COUNT(*) AS n FROM waitlist GROUP BY status").all<{ status: string; n: number }>();
  const waitlist = Object.fromEntries(wl.results.map((r) => [r.status, r.n]));
  const approved = (await one<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE email != ?", adminEmail)).n;
  const active = (await one<{ n: number }>(
    `SELECT COUNT(DISTINCT b.user_id) AS n FROM quotes q JOIN businesses b ON b.id = q.business_id
     JOIN users u ON u.id = b.user_id WHERE u.email != ?`, adminEmail)).n;
  const threePlus = (await one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (SELECT b.user_id FROM quotes q JOIN businesses b ON b.id = q.business_id
       JOIN users u ON u.id = b.user_id WHERE u.email != ? GROUP BY b.user_id HAVING COUNT(*) >= 3)`, adminEmail)).n;
  const emails = await one<{ sent: number; test: number }>(
    `SELECT COALESCE(SUM(type = 'email_sent'),0) AS sent, COALESCE(SUM(type = 'dry_run'),0) AS test FROM events`);
  const won = await one<{ n: number; pence: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(amount_pence),0) AS pence FROM quotes
     WHERE status = 'won' AND EXISTS (SELECT 1 FROM events e WHERE e.quote_id = quotes.id AND e.type = 'email_sent')`);
  const week3 = await one<{ eligible: number; active: number }>(
    `SELECT COUNT(*) AS eligible,
       COALESCE(SUM(CASE WHEN EXISTS (
         SELECT 1 FROM quotes q JOIN businesses b ON b.id = q.business_id
         WHERE b.user_id = u.id AND julianday(q.created_at) - julianday(u.created_at) BETWEEN 14 AND 21) THEN 1 ELSE 0 END),0) AS active
     FROM users u WHERE u.email != ? AND julianday(?) - julianday(u.created_at) >= 21`, adminEmail, iso);

  return {
    signupsPerWeek, waitlist: { pending: waitlist.pending ?? 0, approved: waitlist.approved ?? 0, rejected: waitlist.rejected ?? 0 },
    users: { approved, active, threePlus },
    emails: { sent: emails.sent, testMode: emails.test },
    wonAfterFollowUp: { count: won.n, pence: won.pence },
    weekThree: { eligible: week3.eligible, active: week3.active },
  };
}
