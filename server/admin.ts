import { Hono } from "hono";
import type { HC } from "./types";
import { adminOnly, guard } from "./lib/security";
import { createUserWithBusiness, makeLoginToken, seatCap, seatsUsed } from "./lib/accounts";
import { sendEmail, signInEmail } from "./lib/email";
import { nowIso } from "./lib/util";

export const admin = new Hono<HC>();
admin.use("*", guard, adminOnly);

admin.get("/waitlist", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, email, answers, status, created_at FROM waitlist
     ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200`,
  ).all<{ id: string; email: string; answers: string; status: string; created_at: string }>();
  const items = results.map((r) => {
    let a: Record<string, unknown> = {};
    try { a = JSON.parse(r.answers); } catch { /* ignore bad JSON */ }
    return { id: r.id, email: r.email, status: r.status, createdAt: r.created_at,
      businessName: a.businessName ?? "", trade: a.trade ?? "", chat: a.chat === true };
  });
  return c.json({ items, seats: { used: await seatsUsed(c.env), cap: seatCap(c.env) } });
});

admin.post("/waitlist/:id/approve", async (c) => {
  const env = c.env;
  const id = c.req.param("id");
  const w = await env.DB.prepare("SELECT id, email, answers, ref FROM waitlist WHERE id = ?")
    .bind(id).first<{ id: string; email: string; answers: string; ref: string | null }>();
  if (!w) return c.json({ error: "Not found" }, 404);

  let user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(w.email).first<{ id: string }>();
  if (!user) {
    if ((await seatsUsed(env)) >= seatCap(env)) {
      return c.json({ error: "All seats are taken. Raise SEAT_CAP to approve more." }, 409);
    }
    let a: { businessName?: string } = {};
    try { a = JSON.parse(w.answers); } catch { /* ignore */ }
    let referredBy: string | null = null;
    if (w.ref) {
      const r = await env.DB.prepare("SELECT id FROM businesses WHERE referral_code = ?").bind(w.ref).first<{ id: string }>();
      referredBy = r?.id ?? null;
    }
    user = await createUserWithBusiness(env, w.email, a.businessName || "My business", referredBy);
  }
  await env.DB.prepare("UPDATE waitlist SET status = 'approved', decided_at = ? WHERE id = ?").bind(nowIso(), id).run();
  const token = await makeLoginToken(env, user.id, "invite", 7 * 24 * 3600);
  const sent = await sendEmail(env, signInEmail(env, w.email, token, true));
  return c.json({ ok: true, emailed: sent.ok && !sent.dryRun, dryRun: !!sent.dryRun });
});

admin.post("/waitlist/:id/reject", async (c) => {
  // Rejecting never sends an email.
  await c.env.DB.prepare("UPDATE waitlist SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'pending'")
    .bind(nowIso(), c.req.param("id")).run();
  return c.json({ ok: true });
});
