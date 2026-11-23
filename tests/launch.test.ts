import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./sqlite-db.js";
import { billingOn, isLaunched, launchBlockers, launchCounts, launchMail, readiness, selfServeSignup, sendLaunchEmails, setLaunched, subscriptionStats, trialFreeUntil } from "../server/launch.js";
import { runScheduler } from "../server/scheduler.js";
import type { Env } from "../server/types.js";
import type { Mail } from "../server/lib/email.js";

const READY = {
  APP_URL: "https://quoted.co.uk", ADMIN_EMAIL: "admin@x.co", FROM_EMAIL: "hello@quoted.co.uk", SUPPORT_EMAIL: "help@quoted.co.uk", PRODUCT_NAME: "Quoted",
  PRICE_MONTHLY: "19", PRICE_ANNUAL: "190", FOUNDING_DISCOUNT_PERCENT: "30", FOUNDING_DISCOUNT_CODE: "FOUNDER30",
  LS_CHECKOUT_MONTHLY: "https://s.lemonsqueezy.com/checkout/buy/a", LS_CHECKOUT_ANNUAL: "https://s.lemonsqueezy.com/checkout/buy/b",
  LS_VARIANT_MONTHLY: "1", LS_VARIANT_ANNUAL: "2", LS_WEBHOOK_SECRET: "0123456789abcdef-secret", DRY_RUN: "false", RESEND_API_KEY: "re_x",
  CRON_SECRET: "0123456789abcdef-cron", TURNSTILE_SITE_KEY: "0x4AAAA-real", COMPANY_NAME: "Quoted Ltd", COMPANY_NUMBER: "12345678", COMPANY_ADDRESS: "1 High St, Birmingham",
  BILLING_ENABLED: "false", TRIAL_DAYS: "14", DAILY_SEND_CAP: "80",
};
const mk = (o: Record<string, string> = {}) => { const DB = memoryDb(); return { DB, env: { ...READY, DB, ...o } as unknown as Env }; };
const NOW = new Date("2026-12-01T10:00:00Z");

test("launch flag: off by default, on after launch, off again after reopening; env can force billing for tests", async () => {
  const { DB, env } = mk();
  assert.equal(await isLaunched(DB), false); assert.equal(await billingOn(env), false);
  await setLaunched(DB, true); assert.equal(await isLaunched(DB), true); assert.equal(await billingOn(env), true);
  await setLaunched(DB, false); assert.equal(await isLaunched(DB), false); assert.equal(await billingOn(env), false);
  assert.equal(await billingOn({ ...env, BILLING_ENABLED: "true" } as Env), true);
});

test("readiness: a fully set up site can launch", () => { assert.deepEqual(launchBlockers(readiness(mk().env)), []); });
test("readiness: each missing piece blocks launch, with a plain reason", () => {
  const blocked = (o: Record<string, string>) => launchBlockers(readiness(mk(o).env)).map((c) => c.key);
  assert.deepEqual(blocked({ LS_CHECKOUT_MONTHLY: "" }), ["monthly"]);
  assert.deepEqual(blocked({ PRICE_MONTHLY: "" }), ["monthly"]);
  assert.deepEqual(blocked({ LS_WEBHOOK_SECRET: "short" }), ["webhook"]);
  assert.deepEqual(blocked({ FOUNDING_DISCOUNT_CODE: "" }), ["founding"]);
  assert.deepEqual(blocked({ FOUNDING_DISCOUNT_CODE: "", FOUNDING_DISCOUNT_PERCENT: "0" }), []);
  assert.deepEqual(blocked({ DRY_RUN: "true" }), ["emails"]);
  assert.deepEqual(blocked({ RESEND_API_KEY: "" }), ["emails"]);
  assert.deepEqual(blocked({ CRON_SECRET: "" }), ["cron"]);
  assert.deepEqual(blocked({ TURNSTILE_SITE_KEY: "1x00000000000000000000AA" }), ["turnstile"]);
  assert.deepEqual(blocked({ LS_CHECKOUT_MONTHLY: "http://insecure.example/x" }), ["monthly"]);
});
test("readiness: annual can be switched off, but a priced annual plan needs a checkout link", () => {
  const blocked = (o: Record<string, string>) => launchBlockers(readiness(mk(o).env)).map((c) => c.key);
  assert.deepEqual(blocked({ PRICE_ANNUAL: "", LS_CHECKOUT_ANNUAL: "" }), []);
  assert.deepEqual(blocked({ LS_CHECKOUT_ANNUAL: "" }), ["annual"]);
});
test("readiness: company details, plan ids and a custom domain are advice, not blockers", () => {
  const checks = readiness(mk({ COMPANY_NAME: "", LS_VARIANT_MONTHLY: "", APP_URL: "https://x.vercel.app" }).env);
  assert.deepEqual(launchBlockers(checks), []);
  assert.deepEqual(checks.filter((c) => !c.ok).map((c) => c.key).sort(), ["company", "domain", "variants"]);
});

test("new customers after launch: free trial, not founding, and the same address is never made twice", async () => {
  const { DB, env } = mk();
  const a = await selfServeSignup(env, { email: "new@x.co", businessName: "Bright Cleaners", ref: null });
  assert.equal(a.isNew, true);
  const b = await DB.prepare("SELECT founding, free_until, name FROM businesses WHERE user_id = ?").bind(a.userId).first<any>();
  assert.equal(b.founding, 0); assert.equal(b.name, "Bright Cleaners"); assert.equal(b.free_until, trialFreeUntil(env));
  const again = await selfServeSignup(env, { email: "new@x.co", businessName: "Other", ref: null });
  assert.deepEqual([again.isNew, again.userId], [false, a.userId]);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM users").first<any>()).n, 1);
});
test("trial length is configurable, and zero means the free period is already over", async () => {
  const day = (n: number) => new Date(NOW.getTime() + n * 864e5).toISOString().slice(0, 10);
  assert.equal(trialFreeUntil(mk({ TRIAL_DAYS: "7" }).env, NOW), day(7));
  assert.equal(trialFreeUntil(mk({ TRIAL_DAYS: "0" }).env, NOW), day(-1));
  assert.equal(trialFreeUntil(mk({ TRIAL_DAYS: "nonsense" }).env, NOW), day(14));
  assert.equal(trialFreeUntil(mk({ TRIAL_DAYS: "9999" }).env, NOW), day(60));
});
test("sign-up with a referral code links to the referrer", async () => {
  const { DB, env } = mk(); const first = await selfServeSignup(env, { email: "a@x.co", businessName: "A", ref: null });
  const code = (await DB.prepare("SELECT referral_code AS c, id FROM businesses WHERE user_id = ?").bind(first.userId).first<any>());
  const second = await selfServeSignup(env, { email: "b@x.co", businessName: "B", ref: code.c });
  assert.equal((await DB.prepare("SELECT referred_by AS r FROM businesses WHERE user_id = ?").bind(second.userId).first<any>()).r, code.id);
  const third = await selfServeSignup(env, { email: "c@x.co", businessName: "C", ref: "NOSUCH00" });
  assert.equal((await DB.prepare("SELECT referred_by AS r FROM businesses WHERE user_id = ?").bind(third.userId).first<any>()).r, null);
});

async function addBiz(DB: any, n: number, o: { email?: string; founding?: number; free?: string; sub?: string; plan?: string | null } = {}) {
  await DB.prepare("INSERT INTO users (id,email,created_at) VALUES (?,?,'2026-10-01T00:00:00Z')").bind(`u${n}`, o.email ?? `u${n}@x.co`).run();
  await DB.prepare("INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,created_at,founding,sub_status,plan) VALUES (?,?,?,?,?,?,'2026-10-01T00:00:00Z',?,?,?)")
    .bind(`b${n}`, `u${n}`, `Biz <${n}>`, `u${n}@x.co`, o.free ?? "2027-01-15", `CODE000${n}`, o.founding ?? 1, o.sub ?? "none", o.plan ?? null).run();
}
test("launch emails: founding members only, once each, admin skipped, in batches", async () => {
  const { DB, env } = mk();
  await addBiz(DB, 1); await addBiz(DB, 2); await addBiz(DB, 3); await addBiz(DB, 4, { founding: 0 }); await addBiz(DB, 5, { email: "admin@x.co" });
  const sent: Mail[] = []; const ok = async (m: Mail) => { sent.push(m); return { ok: true }; };
  let r = await sendLaunchEmails(env, 2, ok);
  assert.deepEqual([r.sent, r.remaining], [2, 1]);
  r = await sendLaunchEmails(env, 25, ok); assert.deepEqual([r.sent, r.remaining], [1, 0]);
  r = await sendLaunchEmails(env, 25, ok); assert.deepEqual([r.sent, r.remaining], [0, 0]); // nobody is emailed twice
  assert.deepEqual(sent.map((m) => m.to).sort(), ["u1@x.co", "u2@x.co", "u3@x.co"]);
});
test("launch emails: failures are retried later, and a test run does not count as sent", async () => {
  const { DB, env } = mk(); await addBiz(DB, 1);
  let r = await sendLaunchEmails(env, 25, async () => ({ ok: false })); assert.deepEqual([r.sent, r.failed, r.remaining], [0, 1, 1]);
  r = await sendLaunchEmails(env, 25, async () => ({ ok: true, dryRun: true })); assert.deepEqual([r.sent, r.dryRun, r.remaining], [0, 1, 1]);
  r = await sendLaunchEmails(env, 25, async () => { throw new Error("boom"); }); assert.equal(r.failed, 1);
  r = await sendLaunchEmails(env, 25, async () => ({ ok: true })); assert.deepEqual([r.sent, r.remaining], [1, 0]);
});
test("launch email: names the free period end and the founding price, and escapes the business name", () => {
  const m = launchMail(mk().env, { id: "b", name: "Bright <b>Cleaners</b>", free_until: "2027-01-15", email: "o@x.co" });
  assert.ok(m.text.includes("2027-01-15")); assert.ok(m.text.includes("30% off")); assert.ok(m.text.includes("£13.3/month instead of £19"));
  assert.ok(m.text.includes("https://quoted.co.uk/app/billing"));
  assert.ok(!m.html.includes("<b>Cleaners</b>")); assert.ok(m.html.includes("&lt;b&gt;Cleaners&lt;/b&gt;"));
  const none = launchMail(mk({ FOUNDING_DISCOUNT_PERCENT: "0" }).env, { id: "b", name: "X", free_until: "2027-01-15", email: "o@x.co" });
  assert.ok(!none.text.includes("% off"));
});

test("launch page numbers and the takings estimate", async () => {
  const { DB, env } = mk();
  await addBiz(DB, 1, { free: "2026-12-20" });                                  // founding, still free
  await addBiz(DB, 2, { sub: "active", plan: "monthly" });                      // founding subscriber
  await addBiz(DB, 3, { founding: 0, sub: "active", plan: "annual" });          // standard annual subscriber
  await addBiz(DB, 4, { founding: 0, sub: "cancelled", plan: "monthly" });
  await addBiz(DB, 5, { email: "admin@x.co" });
  await DB.prepare("INSERT INTO waitlist (id,email,answers,status,created_at) VALUES ('w','p@x.co','{}','pending','2026-11-01T00:00:00Z')").run();
  const c = await launchCounts(DB, "admin@x.co", NOW);
  assert.deepEqual({ total: c.total, founding: c.founding, foundingFree: c.foundingFree, subscribers: c.subscribers, pending: c.waitlistPending }, { total: 4, founding: 2, foundingFree: 1, subscribers: 2, pending: 1 });
  const s = await subscriptionStats(DB, env, "admin@x.co");
  assert.deepEqual({ active: s.active, founding: s.founding, standard: s.standard, cancelled: s.cancelled }, { active: 2, founding: 1, standard: 1, cancelled: 1 });
  assert.equal(s.estMonthlyPence, Math.round((19 * 0.7 + 190 / 12) * 100)); // founding monthly with 30% off, plus an annual plan per month
});

test("flipping the switch changes who gets followed up, with no redeploy", async () => {
  const { DB, env } = mk({ DRY_RUN: "false" });
  await addBiz(DB, 1, { free: "2026-01-01" }); // free period long over
  await DB.prepare(`INSERT INTO quotes (id,business_id,client_name,client_email,amount_pence,description,sent_at,status,followups_sent,next_followup_at,response_token,created_at,updated_at)
    VALUES ('q1','b1','Sam','s@c.co',1000,'Job','2026-11-20T10:00:00Z','waiting',0,'2026-11-30T10:00:00Z','tok','2026-11-20T10:00:00Z','2026-11-20T10:00:00Z')`).run();
  let n = 0; const send = async () => { n++; return { ok: true }; };
  await runScheduler(env, { now: NOW, anyTime: true, send }); assert.equal(n, 1, "before launch nobody is locked out");
  await DB.prepare("UPDATE quotes SET followups_sent = 0, last_sent_at = NULL, status = 'waiting', next_followup_at = '2026-11-30T10:00:00Z'").run();
  await setLaunched(DB, true);
  await runScheduler(env, { now: NOW, anyTime: true, send }); assert.equal(n, 1, "after launch an unpaid, expired business is not chased");
  await DB.prepare("UPDATE businesses SET sub_status = 'active'").run();
  await runScheduler(env, { now: NOW, anyTime: true, send }); assert.equal(n, 2, "paying again turns follow-ups back on");
});
