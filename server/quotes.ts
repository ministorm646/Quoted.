import { Hono } from "hono";
import type { Context } from "hono";
import type { HC } from "./types.js";
import { guard, hit, readJson } from "./lib/security.js";
import { newId, randomToken } from "./lib/crypto.js";
import { cleanEmail, cleanText, nowIso, parsePounds } from "./lib/util.js";
import { DEFAULT_SCHEDULE } from "./lib/template.js";

export const quotes = new Hono<HC>();

// Every route below is scoped to the signed-in user's own business.
quotes.use("*", guard, async (c, next) => {
  const biz = await c.env.DB.prepare("SELECT id, schedule FROM businesses WHERE user_id = ?")
    .bind(c.get("user")!.id).first<{ id: string; schedule: string }>();
  if (!biz) return c.json({ error: "No business found" }, 404);
  c.set("biz", biz);
  await next();
});

const OPEN = ["waiting", "following_up", "paused", "question", "accepted"];
const DAY = 864e5;

function scheduleOf(json: string): number[] {
  try {
    const s = JSON.parse(json);
    if (Array.isArray(s) && s.length && s.every((n) => Number.isInteger(n) && n > 0)) return s;
  } catch { /* fall through */ }
  return DEFAULT_SCHEDULE;
}

quotes.get("/", async (c) => {
  const bid = c.get("biz")!.id;
  const [list, stats] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT id, client_name AS clientName, amount_pence AS amountPence, description, status,
              followups_sent AS followupsSent, next_followup_at AS nextFollowupAt, created_at AS createdAt
       FROM quotes WHERE business_id = ? ORDER BY created_at DESC LIMIT 300`,
    ).bind(bid),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN status IN ('waiting','following_up','paused') THEN amount_pence END),0) AS waitingPence,
              COALESCE(SUM(CASE WHEN status = 'won' THEN amount_pence END),0) AS wonPence,
              COALESCE(SUM(status = 'won'),0) AS won,
              COALESCE(SUM(status IN ('lost','declined')),0) AS lost
       FROM quotes WHERE business_id = ?`,
    ).bind(bid),
  ]);
  const s = stats.results[0] as { waitingPence: number; wonPence: number; won: number; lost: number };
  const closed = s.won + s.lost;
  return c.json({ quotes: list.results, stats: { ...s, winRate: closed ? Math.round((s.won / closed) * 100) : null } });
});

quotes.post("/", async (c) => {
  const user = c.get("user")!;
  const b = await readJson(c);
  if (!b) return c.json({ error: "Invalid request" }, 400);
  if (!(await hit(c.env, `qn:${user.id}`, 60, 3600))) return c.json({ error: "That is a lot of quotes in an hour. Try again shortly." }, 429);

  const clientName = cleanText(b.clientName, 80);
  const clientEmail = cleanEmail(b.clientEmail);
  const amountPence = parsePounds(b.amount);
  const description = cleanText(b.description, 140);
  if (!clientName) return c.json({ error: "Enter the client's name." }, 400);
  if (!clientEmail) return c.json({ error: "Enter a valid client email." }, 400);
  if (amountPence === null) return c.json({ error: "Enter the quote amount in pounds, for example 450 or 1250.50." }, 400);
  if (!description) return c.json({ error: "Add a one-line description of the job." }, 400);

  const biz = c.get("biz")!;
  const now = Date.now();
  const first = (await c.env.DB.prepare("SELECT 1 AS x FROM quotes WHERE business_id = ? LIMIT 1").bind(biz.id).first()) ? 0 : 1;
  const next = new Date(now + scheduleOf(biz.schedule)[0] * DAY).toISOString();
  const iso = new Date(now).toISOString();
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO quotes (id, business_id, client_name, client_email, amount_pence, description, sent_at, status,
        followups_sent, next_followup_at, response_token, first_quote, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?, 'waiting', 0, ?, ?, ?, ?, ?)`,
    ).bind(id, biz.id, clientName, clientEmail, amountPence, description, iso, next, randomToken(24), first, iso, iso),
    c.env.DB.prepare("INSERT INTO events (quote_id, type, created_at) VALUES (?, 'created', ?)").bind(id, iso),
  ]);
  const unsub = await c.env.DB.prepare("SELECT 1 AS x FROM unsubscribes WHERE email = ?").bind(clientEmail).first();
  return c.json({ ok: true, id, unsubscribed: !!unsub });
});

quotes.get("/:id", async (c) => {
  const bid = c.get("biz")!.id;
  const q = await c.env.DB.prepare(
    `SELECT id, client_name AS clientName, client_email AS clientEmail, amount_pence AS amountPence, description,
            status, followups_sent AS followupsSent, next_followup_at AS nextFollowupAt, created_at AS createdAt
     FROM quotes WHERE id = ? AND business_id = ?`,
  ).bind(c.req.param("id"), bid).first<{ clientEmail: string }>();
  if (!q) return c.json({ error: "Quote not found" }, 404);
  const [events, unsub] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT type, created_at AS createdAt FROM events WHERE quote_id = ? ORDER BY id").bind(c.req.param("id")),
    c.env.DB.prepare("SELECT 1 AS x FROM unsubscribes WHERE email = ?").bind(q.clientEmail),
  ]);
  return c.json({ quote: q, events: events.results, unsubscribed: unsub.results.length > 0 });
});

// One guarded status change. The event row is only written if the update changed a row.
async function change(c: Context<HC>, sql: string, binds: unknown[], event: string) {
  const id = c.req.param("id")!;
  const iso = nowIso();
  const [upd] = await c.env.DB.batch([
    c.env.DB.prepare(sql).bind(...binds, iso, id, c.get("biz")!.id),
    c.env.DB.prepare("INSERT INTO events (quote_id, type, created_at) SELECT ?, ?, ? WHERE changes() > 0").bind(id, event, iso),
  ]);
  return upd.meta.changes === 1;
}
const openList = OPEN.map((s) => `'${s}'`).join(",");

quotes.post("/:id/won", async (c) =>
  (await change(c, `UPDATE quotes SET status='won', next_followup_at=NULL, updated_at=? WHERE id=? AND business_id=? AND status IN (${openList})`, [], "marked_won"))
    ? c.json({ ok: true }) : c.json({ error: "This quote can't be changed any more." }, 409));

quotes.post("/:id/lost", async (c) =>
  (await change(c, `UPDATE quotes SET status='lost', next_followup_at=NULL, updated_at=? WHERE id=? AND business_id=? AND status IN (${openList})`, [], "marked_lost"))
    ? c.json({ ok: true }) : c.json({ error: "This quote can't be changed any more." }, 409));

quotes.post("/:id/pause", async (c) =>
  (await change(c, `UPDATE quotes SET status='paused', next_followup_at=NULL, updated_at=? WHERE id=? AND business_id=? AND status IN ('waiting','following_up')`, [], "paused"))
    ? c.json({ ok: true }) : c.json({ error: "Only quotes that are being followed up can be paused." }, 409));

quotes.post("/:id/resume", async (c) => {
  const id = c.req.param("id");
  const biz = c.get("biz")!;
  const q = await c.env.DB.prepare(
    "SELECT sent_at, followups_sent, last_sent_at FROM quotes WHERE id = ? AND business_id = ? AND status = 'paused'",
  ).bind(id, biz.id).first<{ sent_at: string; followups_sent: number; last_sent_at: string | null }>();
  if (!q) return c.json({ error: "This quote isn't paused." }, 409);
  const steps = scheduleOf(biz.schedule);
  const now = Date.now();
  // Never sooner than the schedule says, a day after the last email, or an hour from now.
  const due = q.followups_sent < steps.length
    ? new Date(Math.max(
        Date.parse(q.sent_at) + steps[q.followups_sent] * DAY,
        q.last_sent_at ? Date.parse(q.last_sent_at) + DAY : 0,
        now + 3600e3)).toISOString()
    : null;
  const ok = await change(c,
    `UPDATE quotes SET status = ?, next_followup_at = ?, updated_at = ? WHERE id = ? AND business_id = ? AND status = 'paused'`,
    [q.followups_sent > 0 ? "following_up" : "waiting", due], "resumed");
  return ok ? c.json({ ok: true }) : c.json({ error: "This quote isn't paused." }, 409);
});

quotes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const [, del] = await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM events WHERE quote_id IN (SELECT id FROM quotes WHERE id = ? AND business_id = ?)").bind(id, c.get("biz")!.id),
    c.env.DB.prepare("DELETE FROM quotes WHERE id = ? AND business_id = ?").bind(id, c.get("biz")!.id),
  ]);
  return del.meta.changes === 1 ? c.json({ ok: true }) : c.json({ error: "Quote not found" }, 404);
});
