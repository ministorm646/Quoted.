import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { memoryDb } from "./sqlite-db.js";
import { hashPassword, verifyPassword, checkPassword } from "../server/lib/password.js";
import { accessInfo, plans, checkoutUrl, verifySignature, applyBillingEvent } from "../server/billing.js";
import { runScheduler } from "../server/scheduler.js";
import { MIGRATIONS } from "../server/schema.js";
import type { Env } from "../server/types.js";

const NOW = new Date("2026-12-01T10:00:00Z");
const base = (o: Partial<Env> = {}) => ({ APP_URL: "https://t.example", FOUNDING_DISCOUNT_PERCENT: "30", PRICE_MONTHLY: "19", PRICE_ANNUAL: "190",
  FOUNDING_DISCOUNT_CODE: "FOUNDER30", LS_CHECKOUT_MONTHLY: "https://shop.lemonsqueezy.com/checkout/buy/abc", LS_CHECKOUT_ANNUAL: "https://shop.lemonsqueezy.com/checkout/buy/def",
  LS_VARIANT_MONTHLY: "111", LS_VARIANT_ANNUAL: "222", LS_WEBHOOK_SECRET: "lemon-test-secret", ...o }) as Env;

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
  assert.ok(checkPassword("aaaaaaaaaaaa", "a@b.co")); assert.ok(checkPassword("password123", "a@b.co")); assert.ok(checkPassword("MyQuoteMe2026!", "a@b.co"));
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
test("checkout link: email, business and (for founders only) the discount code", () => {
  const u = new URL(checkoutUrl(base(), "monthly", "me@x.co", "biz1", true)!);
  assert.equal(u.searchParams.get("checkout[email]"), "me@x.co"); assert.equal(u.searchParams.get("checkout[custom][business_id]"), "biz1");
  assert.equal(u.searchParams.get("checkout[discount_code]"), "FOUNDER30");
  assert.equal(new URL(checkoutUrl(base(), "annual", "me@x.co", "biz1", false)!).searchParams.get("checkout[discount_code]"), null);
  assert.equal(checkoutUrl(base(), "weekly", "me@x.co", "b", true), null);
  assert.equal(checkoutUrl(base({ LS_CHECKOUT_MONTHLY: "http://insecure.example/x" }), "monthly", "m@x.co", "b", true), null);
  assert.equal(checkoutUrl(base({ LS_CHECKOUT_MONTHLY: "" }), "monthly", "m@x.co", "b", true), null);
});

// ---------- webhook ----------
test("webhook signature: only the exact signed body is accepted", async () => {
  const body = '{"meta":{"event_name":"subscription_created"}}';
  const sig = createHmac("sha256", "lemon-test-secret").update(body).digest("hex");
  assert.equal(await verifySignature("lemon-test-secret", body, sig), true);
  assert.equal(await verifySignature("lemon-test-secret", body + " ", sig), false);
  assert.equal(await verifySignature("other-secret", body, sig), false);
  assert.equal(await verifySignature("lemon-test-secret", body, undefined), false);
  assert.equal(await verifySignature("", body, sig), false);
});
async function withBusiness(extra = "") {
  const DB = memoryDb(); const env = base({ DB } as any);
  await DB.prepare("INSERT INTO users (id,email,created_at) VALUES ('u1','o@x.co','2026-01-01T00:00:00Z')").run();
  await DB.prepare(`INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,created_at,founding${extra ? "," + extra.split("=")[0] : ""}) VALUES ('b1','u1','Biz','o@x.co','2026-01-01','ABCD2345','2026-01-01T00:00:00Z',1${extra ? "," + extra.split("=")[1] : ""})`).run();
  return { DB, env };
}
const ev = (name: string, status: string, updated: string, extra: object = {}) => ({
  meta: { event_name: name, custom_data: { business_id: "b1" } },
  data: { id: "sub9", attributes: { status, variant_id: 111, renews_at: "2027-01-05T00:00:00Z", ends_at: null, updated_at: updated, urls: { customer_portal: "https://portal.example/p" }, ...extra } } });
const row = (DB: any) => DB.prepare("SELECT sub_status, plan, sub_renews_at, provider_sub_id, portal_url FROM businesses WHERE id='b1'").first();

test("webhook: a new subscription is recorded with plan, renewal date and billing portal link", async () => {
  const { DB, env } = await withBusiness();
  assert.deepEqual(await applyBillingEvent(DB, env, ev("subscription_created", "active", "2026-12-01T09:00:00Z")), { applied: true });
  assert.deepEqual({ ...(await row(DB)) }, { sub_status: "active", plan: "monthly", sub_renews_at: "2027-01-05T00:00:00Z", provider_sub_id: "sub9", portal_url: "https://portal.example/p" });
});
test("webhook: older events never overwrite newer ones; cancelled keeps access until the end date", async () => {
  const { DB, env } = await withBusiness();
  await applyBillingEvent(DB, env, ev("subscription_updated", "active", "2026-12-01T09:00:00Z"));
  const cancel = ev("subscription_cancelled", "cancelled", "2026-12-02T09:00:00Z", { ends_at: "2027-01-05T00:00:00Z", renews_at: null });
  await applyBillingEvent(DB, env, cancel);
  assert.equal((await row(DB)).sub_status, "cancelled"); assert.equal((await row(DB)).sub_renews_at, "2027-01-05T00:00:00Z");
  const r = await applyBillingEvent(DB, env, ev("subscription_updated", "active", "2026-12-01T09:30:00Z")); // arrives late
  assert.equal(r.applied, false); assert.equal((await row(DB)).sub_status, "cancelled");
  await applyBillingEvent(DB, env, ev("subscription_resumed", "active", "2026-12-03T09:00:00Z"));
  assert.equal((await row(DB)).sub_status, "active");
});
test("webhook: payment, order, unknown and malformed events are ignored safely", async () => {
  const { DB, env } = await withBusiness();
  for (const p of [ev("subscription_payment_success", "active", "2026-12-01T09:00:00Z"), { meta: { event_name: "order_created" } }, ev("subscription_updated", "mystery", "2026-12-01T09:00:00Z"),
    { meta: { event_name: "subscription_created" }, data: { attributes: { status: "active" } } }, {}, null])
    assert.equal((await applyBillingEvent(DB, env, p)).applied, false);
  assert.equal((await row(DB)).sub_status, "none");
  const wrong = ev("subscription_created", "active", "2026-12-01T09:00:00Z"); (wrong.meta.custom_data as any).business_id = "nope";
  assert.equal((await applyBillingEvent(DB, env, wrong)).applied, false);
});
test("webhook: annual variant is recognised", async () => {
  const { DB, env } = await withBusiness();
  await applyBillingEvent(DB, env, ev("subscription_created", "active", "2026-12-01T09:00:00Z", { variant_id: 222 }));
  assert.equal((await row(DB)).plan, "annual");
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
