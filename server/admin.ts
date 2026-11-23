import { Hono } from "hono";
import type { HC } from "./types.js";
import { adminOnly, guard, readJson } from "./lib/security.js";
import { createUserWithBusiness, makeLoginToken, seatCap, seatsUsed } from "./lib/accounts.js";
import { sendEmail, signInEmail } from "./lib/email.js";
import { nowIso } from "./lib/util.js";
import { loadStats } from "./stats.js";
import { isLaunched, launchBlockers, launchCounts, launchedAt, readiness, sendLaunchEmails, setLaunched, subscriptionStats, trialFreeUntil } from "./launch.js";

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

admin.get("/stats", async (c) => {
  const adminEmail = c.env.ADMIN_EMAIL.trim().toLowerCase();
  return c.json({ ...(await loadStats(c.env.DB, adminEmail)), subscriptions: await subscriptionStats(c.env.DB, c.env, adminEmail) });
});

// ----- the launch switch -----
admin.get("/launch", async (c) => {
  const checks = readiness(c.env);
  const launched = await isLaunched(c.env.DB);
  return c.json({
    launched, launchedAt: launched ? await launchedAt(c.env.DB) : null, checks, ready: launchBlockers(checks).length === 0,
    counts: await launchCounts(c.env.DB, c.env.ADMIN_EMAIL.trim().toLowerCase()),
  });
});
admin.post("/launch", async (c) => {
  const b = await readJson(c);
  if (b?.confirm !== "LAUNCH") return c.json({ error: "Type LAUNCH to confirm." }, 400);
  const blockers = launchBlockers(readiness(c.env));
  if (blockers.length) return c.json({ error: "Not ready to launch yet.", failing: blockers.map((x) => x.label) }, 409);
  await setLaunched(c.env.DB, true);
  return c.json({ ok: true });
});
admin.post("/reopen", async (c) => {
  const b = await readJson(c);
  if (b?.confirm !== "REOPEN") return c.json({ error: "Type REOPEN to confirm." }, 400);
  await setLaunched(c.env.DB, false);
  return c.json({ ok: true });
});
admin.post("/launch/emails", async (c) => {
  if (!(await isLaunched(c.env.DB))) return c.json({ error: "Launch first." }, 409);
  return c.json({ ok: true, ...(await sendLaunchEmails(c.env, 25)) });
});

admin.post("/waitlist/:id/approve", async (c) => {
  const env = c.env;
  const id = c.req.param("id");
  const w = await env.DB.prepare("SELECT id, email, answers, ref FROM waitlist WHERE id = ?")
    .bind(id).first<{ id: string; email: string; answers: string; ref: string | null }>();
  if (!w) return c.json({ error: "Not found" }, 404);

  const launched = await isLaunched(env.DB);
  let user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(w.email).first<{ id: string }>();
  if (!user) {
    if (!launched && (await seatsUsed(env)) >= seatCap(env)) {
      return c.json({ error: "All seats are taken. Raise SEAT_CAP to approve more." }, 409);
    }
    let a: { businessName?: string } = {};
    try { a = JSON.parse(w.answers); } catch { /* ignore */ }
    let referredBy: string | null = null;
    if (w.ref) {
      const r = await env.DB.prepare("SELECT id FROM businesses WHERE referral_code = ?").bind(w.ref).first<{ id: string }>();
      referredBy = r?.id ?? null;
    }
    // After launch, approved people are ordinary customers on a trial, not founding members.
    user = await createUserWithBusiness(env, w.email, a.businessName || "My business", referredBy, launched ? 0 : 1, launched ? trialFreeUntil(env) : undefined);
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
