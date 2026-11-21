import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./sqlite-db.js";
import { creditReferral, REFERRAL_CAP } from "../server/referrals.js";
import { loadStats } from "../server/stats.js";

const NOW = new Date("2026-12-14T12:00:00Z"); // a Monday
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 864e5).toISOString();

async function biz(DB: any, n: number, opts: { referredBy?: string | null; created?: string; free?: string } = {}) {
  await DB.prepare("INSERT INTO users (id,email,created_at) VALUES (?,?,?)").bind(`u${n}`, `u${n}@x.co`, opts.created ?? iso(1)).run();
  await DB.prepare("INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,referred_by,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(`b${n}`, `u${n}`, `Biz ${n}`, `u${n}@x.co`, opts.free ?? "2027-02-01", `CODE000${n}`, opts.referredBy ?? null, opts.created ?? iso(1)).run();
}
const freeUntil = async (DB: any, id: string) => (await DB.prepare("SELECT free_until AS f FROM businesses WHERE id=?").bind(id).first()).f;
const refCount = async (DB: any) => (await DB.prepare("SELECT COUNT(*) AS n FROM referrals").first()).n;

test("referral: both sides get one extra month, once only", async () => {
  const DB = memoryDb(); await biz(DB, 1); await biz(DB, 2, { referredBy: "b1" });
  assert.equal(await creditReferral(DB, "b2"), true);
  assert.equal(await freeUntil(DB, "b1"), "2027-03-01"); assert.equal(await freeUntil(DB, "b2"), "2027-03-01");
  assert.equal(await creditReferral(DB, "b2"), false); // a second call changes nothing
  assert.equal(await freeUntil(DB, "b1"), "2027-03-01"); assert.equal(await refCount(DB), 1);
});

test("referral: no credit when the business was not referred", async () => {
  const DB = memoryDb(); await biz(DB, 1);
  assert.equal(await creditReferral(DB, "b1"), false); assert.equal(await freeUntil(DB, "b1"), "2027-02-01");
});

test("referral: capped at 3 per person, and the capped one gets no credit either", async () => {
  const DB = memoryDb(); await biz(DB, 1);
  for (let i = 2; i <= 5; i++) await biz(DB, i, { referredBy: "b1" });
  for (let i = 2; i <= 4; i++) assert.equal(await creditReferral(DB, `b${i}`), true);
  assert.equal(await creditReferral(DB, "b5"), false);
  assert.equal(await refCount(DB), REFERRAL_CAP);
  assert.equal(await freeUntil(DB, "b1"), "2027-05-01"); // 3 extra months, not 4
  assert.equal(await freeUntil(DB, "b5"), "2027-02-01");
});

test("referral: an already-expired free period is extended from today, not from the past", async () => {
  const DB = memoryDb(); await biz(DB, 1, { free: "2020-01-01" }); await biz(DB, 2, { referredBy: "b1", free: "2020-01-01" });
  await creditReferral(DB, "b2");
  const f = await freeUntil(DB, "b2");
  assert.ok(f > new Date().toISOString().slice(0, 10), "new date is in the future: " + f);
});

test("admin stats: counts only, and the right numbers", async () => {
  const DB = memoryDb(); const admin = "admin@x.co";
  await DB.prepare("INSERT INTO users (id,email,created_at) VALUES ('ua',?,?)").bind(admin, iso(60)).run();
  await DB.prepare("INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,created_at) VALUES ('ba','ua','Admin','a@x.co','2027-01-01','ADMN0000',?)").bind(iso(60)).run();
  await biz(DB, 1, { created: iso(30) }); // joined 30 days ago, logs quotes in its week 3
  await biz(DB, 2, { created: iso(30) }); // joined 30 days ago, never logs a quote
  await biz(DB, 3, { created: iso(2) });  // new, 3 quotes
  const addQ = (id: string, b: string, created: string, status = "waiting") => DB.prepare(
    `INSERT INTO quotes (id,business_id,client_name,client_email,amount_pence,description,sent_at,status,followups_sent,response_token,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,1,?,?,?)`).bind(id, b, "Client", "c@x.co", 10000, "Job", created, status, "t" + id, created, created).run();
  await addQ("q1", "b1", iso(15), "won"); await addQ("q2", "b3", iso(1)); await addQ("q3", "b3", iso(1)); await addQ("q4", "b3", iso(1));
  await DB.prepare("INSERT INTO events (quote_id,type,created_at) VALUES ('q1','email_sent',?)").bind(iso(12)).run();
  await DB.prepare("INSERT INTO events (quote_id,type,created_at) VALUES ('q2','dry_run',?)").bind(iso(1)).run();
  for (const [i, e, d] of [[1, "p1@x.co", 1], [2, "p2@x.co", 10], [3, "p3@x.co", 10]] as const)
    await DB.prepare("INSERT INTO waitlist (id,email,answers,status,created_at) VALUES (?,?,'{}',?,?)").bind("w" + i, e, i === 1 ? "approved" : "pending", iso(d)).run();

  const s = await loadStats(DB, admin, NOW);
  assert.equal(s.users.approved, 3); assert.equal(s.users.active, 2); assert.equal(s.users.threePlus, 1);
  assert.deepEqual(s.emails, { sent: 1, testMode: 1 });
  assert.deepEqual(s.wonAfterFollowUp, { count: 1, pence: 10000 });
  assert.deepEqual(s.weekThree, { eligible: 2, active: 1 });
  assert.deepEqual(s.waitlist, { pending: 2, approved: 1, rejected: 0 });
  assert.equal(s.signupsPerWeek.length, 8); assert.equal(s.signupsPerWeek.reduce((a, w) => a + w.signups, 0), 3);
  assert.ok(!JSON.stringify(s).includes("@"), "no email addresses in the stats");
});
