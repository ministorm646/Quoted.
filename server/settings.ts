import { Hono } from "hono";
import type { HC } from "./types.js";
import { endSession, guard, readJson } from "./lib/security.js";
import { cleanEmail, cleanMultiline, cleanText } from "./lib/util.js";
import { DEFAULT_SCHEDULE, DEFAULT_TEMPLATE } from "./lib/template.js";

export const settings = new Hono<HC>();
settings.use("*", guard);

settings.get("/", async (c) => {
  const b = await c.env.DB.prepare(
    "SELECT name, reply_to AS replyTo, schedule, template FROM businesses WHERE user_id = ?",
  ).bind(c.get("user")!.id).first<{ name: string; replyTo: string; schedule: string; template: string | null }>();
  if (!b) return c.json({ error: "No business found" }, 404);
  let schedule = DEFAULT_SCHEDULE;
  try { schedule = JSON.parse(b.schedule); } catch { /* keep default */ }
  return c.json({ name: b.name, replyTo: b.replyTo, schedule, template: b.template ?? "", defaultTemplate: DEFAULT_TEMPLATE });
});

// 1 to 5 whole days, each later than the one before, so emails are always at least a day apart.
function cleanSchedule(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length < 1 || v.length > 5) return null;
  const days = v.map(Number);
  if (!days.every((n) => Number.isInteger(n) && n >= 1 && n <= 60)) return null;
  for (let i = 1; i < days.length; i++) if (days[i] <= days[i - 1]) return null;
  return days;
}

settings.put("/", async (c) => {
  const b = await readJson(c);
  if (!b) return c.json({ error: "Invalid request" }, 400);
  const name = cleanText(b.name, 80);
  const replyTo = cleanEmail(b.replyTo);
  const schedule = cleanSchedule(b.schedule);
  let template: string | null = cleanMultiline(b.template, 1000);
  if (!name) return c.json({ error: "Enter your business name." }, 400);
  if (!replyTo) return c.json({ error: "Enter a valid reply-to email." }, 400);
  if (!schedule) return c.json({ error: "Follow-up days must be whole numbers from 1 to 60, each later than the one before (up to 5)." }, 400);
  if (template === "" || template === DEFAULT_TEMPLATE) template = null;
  await c.env.DB.prepare("UPDATE businesses SET name = ?, reply_to = ?, schedule = ?, template = ? WHERE user_id = ?")
    .bind(name, replyTo, JSON.stringify(schedule), template, c.get("user")!.id).run();
  return c.json({ ok: true });
});

// "Delete my account and data": removes the user, business, quotes, events and sign-in records.
export const account = new Hono<HC>();
account.use("*", guard);
account.delete("/", async (c) => {
  const user = c.get("user")!;
  const b = await readJson(c);
  if (!b || typeof b.confirm !== "string" || b.confirm.trim().toLowerCase() !== user.email) {
    return c.json({ error: "Type your email address to confirm." }, 400);
  }
  const biz = await c.env.DB.prepare("SELECT id FROM businesses WHERE user_id = ?").bind(user.id).first<{ id: string }>();
  const st = [];
  if (biz) {
    st.push(
      c.env.DB.prepare("UPDATE businesses SET referred_by = NULL WHERE referred_by = ?").bind(biz.id),
      c.env.DB.prepare("DELETE FROM events WHERE quote_id IN (SELECT id FROM quotes WHERE business_id = ?)").bind(biz.id),
      c.env.DB.prepare("DELETE FROM quotes WHERE business_id = ?").bind(biz.id),
      c.env.DB.prepare("DELETE FROM referrals WHERE referrer_business_id = ? OR referred_business_id = ?").bind(biz.id, biz.id),
      c.env.DB.prepare("DELETE FROM businesses WHERE id = ?").bind(biz.id),
    );
  }
  st.push(
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM login_tokens WHERE user_id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM waitlist WHERE email = ?").bind(user.email),
  );
  await c.env.DB.batch(st);
  await endSession(c);
  return c.json({ ok: true });
});
