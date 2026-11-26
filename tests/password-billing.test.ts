import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { memoryDb } from "./sqlite-db.js";
import { hashPassword, verifyPassword, checkPassword } from "../server/lib/password.js";
import { accessInfo, plans, checkoutParams, verifySignature, applyBillingEvent, stripeReady } from "../server/billing.js";
import { runScheduler } from "../server/scheduler.js";
import { MIGRATIONS } from "../server/schema.js";
import type { Env } from "../server/types.js";

const NOW = new Date("2026-12-01T10:00:00Z");
const base = (o: Partial<Env> = {}) => ({ APP_URL: "https://t.example", FOUNDING_DISCOUNT_PERCENT: "30", PRICE_MONTHLY: "19", PRICE_ANNUAL: "190",
  STRIPE_SECRET_KEY: "sk_test_x", STRIPE_PRICE_MONTHLY: "price_m", STRIPE_PRICE_ANNUAL: "price_a", STRIPE_COUPON_FOUNDING: "founder30", STRIPE_WEBHOOK_SECRET: "whsec_test",
  ...o }) as Env;

// ---------- passwords ----------
test("password: right one works, wrong one and unknown account do not, and only a salted hash is stored", async () => {
  const h = await hashPassword("a long enough passphrase");
  assert.ok(h.startsWith("scrypt$16384$8$5$")); assert.ok(!h.includes("passphrase"));
  assert.equal(await verifyPassword("a long enough passphrase", h), true);
  assert.equal(await verifyPassword("a long enough passphras", h), false);
  assert.equal(await verifyPassword("anything at all here", null), false);
  assert.notEqual(h, await hashPassword("a long enough passphrase")); // different salt each time
});
test("password: unicode forms of the same password match", async () => {
  const h = await hashPassword("caf\u00e9 society 2026"); // composed e-acute
  assert.equal(await verifyPassword("cafe\u0301 society 2026", h), true); // decomposed form
});
test("password rules", () => {
  assert.match(checkPassword("short", "a@b.co")!, /10 characters/);
  assert.ok(checkPassword("x".repeat(129), "a@b.co"));
  assert.ok(checkPassword("aaaaaaaaaaaa", "a@b.co")); assert.ok(checkPassword("password123", "a@b.co")); assert.ok(checkPassword("MyQuoted2026!", "a@b.co"));
  assert.ok(checkPassword("sam.taylor-is-great", "sam.taylor@x.co"));
  assert.equal(checkPassword("correct horse battery staple", "sam@x.co"), null);
});

// ---------- access and prices ----------
const biz = (o: object = {}) => ({ free_until: "2026-12-10", sub_status: "none", sub_renews_at: null, plan: null, founding: 1, ...o });
test("access: free period, then expired, and billing off never locks anyone out", () => {
  let a = accessInfo(biz(), true, NOW); assert.equal(a.state, "free"); assert.equal(a.daysLeft, 9); assert.equal(a.allowed, true);
  a = accessInfo(biz({ free_until: "2026-11-30" }), true, NOW); assert.equal(a.state, "expired"); assert.equal(a.allowed, false);
  a = accessInfo(biz({ free_until: "2026-11-30" }), false, NOW); assert.equal(a.state, "expired"); assert.equal(a.allowed, true);
});
test("access: paying, past due (grace) and cancelled-but-paid-up are allowed; cancelled and over is not", () => {
  const old = { free_until: "2026-01-01" };
  assert.equal(accessInfo(biz({ ...old, sub_status: "active" }), true, NOW).allowed, true);
  assert.equal(accessInfo(biz({ ...old, sub_status: "past_due" }), true, NOW).state, "past_due");
  let a = accessInfo(biz({ ...old, sub_status: "cancelled", sub_renews_at: "2026-12-20T00:00:00Z" }), true, NOW);
  assert.equal(a.state, "cancelled"); assert.equal(a.allowed, true); assert.equal(a.daysLeft, 19);
  a = accessInfo(biz({ ...old, sub_status: "cancelled", sub_renews_at: "2026-11-20T00:00:00Z" }), true, NOW);
  assert.equal(a.state, "expired"); assert.equal(a.allowed, false);
});
test("founding members get the discount on every plan, others pay full price", () => {
  const f = plans(base(), true), n = plans(base(), false);
  assert.deepEqual(f.map((p) => [p.id, p.price, p.foundingPrice]), [["monthly", 19, 13.3], ["annual", 190, 133]]);
  assert.deepEqual(n.map((p) => p.foundingPrice), [null, null]);
  assert.deepEqual(plans(base({ PRICE_ANNUAL: "" }), true).map((p) => p.id), ["monthly"]); // no price set, no plan shown
  assert.equal(plans(base({ FOUNDING_DISCOUNT_PERCENT: "0" }), true)[0].foundingPrice, null);
});
test("checkout: price, business and (for founders only) the founding coupon", () => {
  const p = checkoutParams(base(), "monthly", "me@x.co", "biz1", true, null)!;
  assert.equal(p.mode, "subscription"); assert.equal(p["line_items[0][price]"], "price_m"); assert.equal(p.customer_email, "me@x.co");
  assert.equal(p["subscription_data[metadata][business_id]"], "biz1"); assert.equal(p["discounts[0][coupon]"], "founder30");
  assert.equal(p.success_url, "https://t.example/app/billing?paid=1");
  assert.equal(checkoutParams(base(), "annual", "me@x.co", "biz1", false, null)!["discounts[0][coupon]"], undefined);
  const again = checkoutParams(base(), "monthly", "me@x.co", "biz1", false, "cus_1")!; // returning customer reuses their Stripe customer
  assert.equal(again.customer, "cus_1"); assert.equal(again.customer_email, undefined);
  assert.equal(checkoutParams(base(), "weekly", "me@x.co", "b", true, null), null);
  assert.equal(checkoutParams(base({ STRIPE_PRICE_MONTHLY: "" }), "monthly", "m@x.co", "b", true, null), null);
});
test("stripe stays off until a key is set", () => {
  assert.equal(stripeReady(base({ STRIPE_SECRET_KEY: "" })), false);
  assert.equal(stripeReady(base({ STRIPE_SECRET_KEY: "nonsense" })), false);
  assert.equal(stripeReady(base()), true);
});

// ---------- webhook ----------
test("webhook signature: only the exact signed body, signed recently, is accepted", async () => {
  const body = '{"type":"customer.subscription.created"}', now = 1_800_000_000;
  const sign = (secret: string, t: number, b = body) => createHmac("sha256", secret).update(`${t}.${b}`).digest("hex");
  const hdr = `t=${now},v1=${sign("whsec_test", now)}`;
  assert.equal(await verifySignature("whsec_test", body, hdr, now), true);
  assert.equal(await verifySignature("whsec_test", body, `t=${now},v1=bad,v1=${sign("whsec_test", now)}`, now), true); // any v1 may match
  assert.equal(await verifySignature("whsec_test", body + " ", hdr, now), false);
  assert.equal(await verifySignature("other", body, hdr, now), false);
  assert.equal(await verifySignature("whsec_test", body, hdr, now + 301), false); // too old, blocks replays
  assert.equal(await verifySignature("whsec_test", body, undefined, now), false);
  assert.equal(await verifySignature("", body, hdr, now), false);
  assert.equal(await verifySignature("whsec_test", body, `v1=${sign("whsec_test", now)}`, now), false); // no timestamp
});
async function withBusiness(extra = "") {
  const DB = memoryDb(); const env = base({ DB } as any);
  await DB.prepare("INSERT INTO users (id,email,created_at) VALUES ('u1','o@x.co','2026-01-01T00:00:00Z')").run();
  await DB.prepare(`INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,created_at,founding${extra ? "," + extra.split("=")[0] : ""}) VALUES ('b1','u1','Biz','o@x.co','2026-01-01','ABCD2345','2026-01-01T00:00:00Z',1${extra ? "," + extra.split("=")[1] : ""})`).run();
  return { DB, env };
}
const T = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const ev = (type: string, status: string, created: string, extra: object = {}) => ({
  type, created: T(created),
  data: { object: { id: "sub9", customer: "cus9", status, metadata: { business_id: "b1" }, cancel_at_period_end: false, current_period_end: T("2027-01-05T00:00:00Z"),
    items: { data: [{ price: { id: "price_m" } }] }, ...extra } } });
const row = (DB: any) => DB.prepare("SELECT sub_status, plan, sub_renews_at, provider_sub_id, provider_customer_id FROM businesses WHERE id='b1'").first();

test("webhook: a new subscription is recorded with plan, renewal date and customer", async () => {
  const { DB, env } = await withBusiness();
  assert.deepEqual(await applyBillingEvent(DB, env, ev("customer.subscription.created", "active", "2026-12-01T09:00:00Z")), { applied: true });
  assert.deepEqual({ ...(await row(DB)) }, { sub_status: "active", plan: "monthly", sub_renews_at: "2027-01-05T00:00:00.000Z", provider_sub_id: "sub9", provider_customer_id: "cus9" });
});
test("webhook: cancelling keeps access to the end of the period, older events never overwrite newer ones", async () => {
  const { DB, env } = await withBusiness();
  await applyBillingEvent(DB, env, ev("customer.subscription.updated", "active", "2026-12-01T09:00:00Z"));
  await applyBillingEvent(DB, env, ev("customer.subscription.updated", "active", "2026-12-02T09:00:00Z", { cancel_at_period_end: true }));
  assert.equal((await row(DB)).sub_status, "cancelled"); assert.equal((await row(DB)).sub_renews_at, "2027-01-05T00:00:00.000Z");
  const r = await applyBillingEvent(DB, env, ev("customer.subscription.updated", "active", "2026-12-01T09:30:00Z")); // arrives late
  assert.equal(r.applied, false); assert.equal((await row(DB)).sub_status, "cancelled");
  await applyBillingEvent(DB, env, ev("customer.subscription.updated", "active", "2026-12-03T09:00:00Z")); // resumed
  assert.equal((await row(DB)).sub_status, "active");
  await applyBillingEvent(DB, env, ev("customer.subscription.deleted", "canceled", "2026-12-04T09:00:00Z", { ended_at: T("2026-12-04T09:00:00Z") }));
  assert.equal((await row(DB)).sub_status, "cancelled"); assert.equal((await row(DB)).sub_renews_at, "2026-12-04T09:00:00.000Z");
});
test("webhook: failed payments, other, unknown and malformed events are ignored safely", async () => {
  const { DB, env } = await withBusiness();
  for (const p of [{ ...ev("invoice.payment_failed", "active", "2026-12-01T09:00:00Z") }, { type: "checkout.session.completed" },
    ev("customer.subscription.updated", "incomplete", "2026-12-01T09:00:00Z"),
    { type: "customer.subscription.created", data: { object: { id: "s", status: "active" } } }, {}, null])
    assert.equal((await applyBillingEvent(DB, env, p)).applied, false);
  assert.equal((await row(DB)).sub_status, "none");
  const wrong = ev("customer.subscription.created", "active", "2026-12-01T09:00:00Z"); (wrong.data.object.metadata as any).business_id = "nope";
  assert.equal((await applyBillingEvent(DB, env, wrong)).applied, false);
});
test("webhook: past due and the annual price are recognised", async () => {
  const { DB, env } = await withBusiness();
  await applyBillingEvent(DB, env, ev("customer.subscription.created", "past_due", "2026-12-01T09:00:00Z", { items: { data: [{ price: { id: "price_a" } }] } }));
  assert.equal((await row(DB)).plan, "annual"); assert.equal((await row(DB)).sub_status, "past_due");
});

// ---------- scheduler respects billing ----------
async function dueQuote(over: Partial<Env>, bizCols: string) {
  const { DB } = await withBusiness(bizCols);
  await DB.prepare(`INSERT INTO quotes (id,business_id,client_name,client_email,amount_pence,description,sent_at,status,followups_sent,next_followup_at,response_token,created_at,updated_at)
    VALUES ('q1','b1','Sam','s@c.co',1000,'Job','2026-11-20T10:00:00Z','waiting',0,'2026-11-30T10:00:00Z','tok','2026-11-20T10:00:00Z','2026-11-20T10:00:00Z')`).run();
  const env = base({ DB, DAILY_SEND_CAP: "80", ...over } as any); let sent = 0;
  await runScheduler(env, { now: NOW, anyTime: true, send: async () => { sent++; return { ok: true }; } });
  return sent;
}
test("scheduler: when billing is on, a business past its free period is not chased, a paying one is", async () => {
  assert.equal(await dueQuote({ BILLING_ENABLED: "true" }, ""), 0);                       // free_until 2026-01-01, no plan
  assert.equal(await dueQuote({ BILLING_ENABLED: "true" }, "sub_status='active'".replace("=", "=").replace("'", "'")), 1);
  assert.equal(await dueQuote({ BILLING_ENABLED: "false" }, ""), 1);                      // billing off: nobody is locked out
});

// ---------- upgrading an existing database ----------
test("migrations add the new columns to an old database, and are safe to run twice", () => {
  const d = new DatabaseSync(":memory:");
  d.exec("CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, created_at TEXT, last_login_at TEXT)");
  d.exec("CREATE TABLE sessions (id_hash TEXT PRIMARY KEY, user_id TEXT, csrf TEXT, expires_at TEXT, created_at TEXT)");
  d.exec("CREATE TABLE businesses (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, reply_to TEXT, free_until TEXT, referral_code TEXT, created_at TEXT)");
  d.exec("INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,created_at) VALUES ('old','u','Old Co','a@b.co','2026-12-01','OLD00000','x')");
  const run = () => { for (const [t, c, ddl] of MIGRATIONS) { try { d.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${ddl}`); } catch (e) { if (!/duplicate column/i.test(String(e))) throw e; } } };
  run(); run();
  const b = d.prepare("SELECT founding, sub_status FROM businesses WHERE id='old'").get() as any;
  assert.equal(b.founding, 1, "existing businesses become founding members"); assert.equal(b.sub_status, "none");
  assert.ok(d.prepare("SELECT password_hash, prefs FROM users").all() !== undefined);
});
