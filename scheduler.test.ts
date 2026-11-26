import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryDb } from "./sqlite-db.js";
import { runScheduler } from "../server/scheduler.js";
import { applyResponse, applyUnsubscribe } from "../server/respond.js";
import type { Env } from "../server/types.js";
import type { Mail } from "../server/lib/email.js";

const DAY = 864e5;
const T0 = new Date("2026-11-23T10:00:00Z"); // a Monday, inside sending hours
const at = (ms: number) => new Date(T0.getTime() + ms).toISOString();

async function setup(over: Partial<Env> = {}) {
  const DB = memoryDb();
  const env = { DB, APP_URL: "https://t.example", DAILY_SEND_CAP: "80", DRY_RUN: "false", ...over } as Env;
  await DB.prepare("INSERT INTO users (id,email,created_at) VALUES ('u1','owner@x.co',?)").bind(at(-9 * DAY)).run();
  await DB.prepare("INSERT INTO businesses (id,user_id,name,reply_to,free_until,referral_code,created_at) VALUES ('b1','u1','Bright Cleaners','owner@x.co','2027-03-01','ABCD2345',?)").bind(at(-9 * DAY)).run();
  return { DB, env };
}
type Q = { id?: string; email?: string; status?: string; sent?: number; followups?: number; next?: number | null; last?: number | null; retries?: number };
async function addQuote(DB: any, o: Q = {}) {
  const id = o.id ?? "q1";
  await DB.prepare(`INSERT INTO quotes (id,business_id,client_name,client_email,amount_pence,description,sent_at,status,followups_sent,retry_count,next_followup_at,last_sent_at,response_token,created_at,updated_at)
    VALUES (?, 'b1', 'Sam', ?, 45000, 'Fence panels', ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, o.email ?? "sam@client.co", at(o.sent ?? -4 * DAY), o.status ?? "waiting", o.followups ?? 0, o.retries ?? 0,
      o.next === null ? null : at(o.next ?? -1000), o.last == null ? null : at(o.last), "tok-" + id, at(-4 * DAY), at(-4 * DAY)).run();
  return id;
}
const sends = () => { const sent: Mail[] = []; return { sent, send: async (m: Mail) => { sent.push(m); return { ok: true }; } }; };
const row = (DB: any, id = "q1") => DB.prepare("SELECT * FROM quotes WHERE id=?").bind(id).first();
const events = async (DB: any, type: string) => (await DB.prepare("SELECT COUNT(*) AS n FROM events WHERE type=?").bind(type).first()).n;

test("sends a due follow-up, in the business name, with three buttons and an unsubscribe link", async () => {
  const { DB, env } = await setup(); await addQuote(DB);
  const s = sends(); const r = await runScheduler(env, { now: T0, send: s.send });
  assert.equal(r.sent, 1); assert.equal(s.sent.length, 1);
  const m = s.sent[0];
  assert.equal(m.to, "sam@client.co"); assert.equal(m.fromName, "Bright Cleaners"); assert.equal(m.replyTo, "owner@x.co");
  for (const p of ["/r/tok-q1/yes", "/r/tok-q1/question", "/r/tok-q1/no", "/u/tok-q1"]) { assert.ok(m.text.includes(p), p); assert.ok(m.html.includes(p), p); }
  const q = await row(DB);
  assert.equal(q.followups_sent, 1); assert.equal(q.status, "following_up");
  assert.ok(Date.parse(q.next_followup_at) >= T0.getTime() + DAY, "next step is at least a day away");
});

test("duplicate prevention: two scheduler runs at once send the step only once", async () => {
  const { DB, env } = await setup(); await addQuote(DB);
  const s = sends();
  await Promise.all([runScheduler(env, { now: T0, send: s.send }), runScheduler(env, { now: T0, send: s.send })]);
  assert.equal(s.sent.length, 1); assert.equal((await row(DB)).followups_sent, 1); assert.equal(await events(DB, "email_sent"), 1);
  await runScheduler(env, { now: T0, send: s.send }); // and a later run does not repeat it
  assert.equal(s.sent.length, 1);
});

test("stop conditions: answered, won, lost, declined and paused quotes are never chased", async () => {
  const { DB, env } = await setup();
  let i = 0; for (const status of ["accepted", "question", "declined", "won", "lost", "paused"]) await addQuote(DB, { id: "q" + i++, status });
  const s = sends(); await runScheduler(env, { now: T0, send: s.send });
  assert.equal(s.sent.length, 0);
});

test("a client tapping a button stops the chasing straight away", async () => {
  const { DB, env } = await setup(); await addQuote(DB);
  const r = await applyResponse(DB, "tok-q1", "yes");
  assert.ok(r.found && r.applied);
  const q = await row(DB); assert.equal(q.status, "accepted"); assert.equal(q.next_followup_at, null);
  const s = sends(); await runScheduler(env, { now: T0, send: s.send });
  assert.equal(s.sent.length, 0); assert.equal(await events(DB, "client_accept"), 1);
  const again = await applyResponse(DB, "tok-q1", "yes"); assert.ok(again.found && !again.applied); // no duplicate event
  assert.equal(await events(DB, "client_accept"), 1);
  assert.equal((await applyResponse(DB, "nope", "yes")).found, false);
  assert.equal((await applyResponse(DB, "tok-q1", "bogus")).found, false);
});

test("spacing: nothing is sent within a day of the last email", async () => {
  const { DB, env } = await setup(); await addQuote(DB, { followups: 1, status: "following_up", last: -2 * 36e5, next: -1000 });
  const s = sends(); await runScheduler(env, { now: T0, send: s.send });
  assert.equal(s.sent.length, 0);
  assert.equal((await row(DB)).next_followup_at, at(-2 * 36e5 + DAY)); // pushed to a day after the last send
});

test("never sends more steps than the schedule has", async () => {
  const { DB, env } = await setup();
  await DB.prepare("UPDATE businesses SET schedule='[3,7]' WHERE id='b1'").run();
  await addQuote(DB, { followups: 2, status: "following_up", last: -9 * DAY });
  const s = sends(); await runScheduler(env, { now: T0, send: s.send });
  assert.equal(s.sent.length, 0); assert.equal((await row(DB)).next_followup_at, null);
});

test("unsubscribed addresses are skipped and the quote is paused, from any business", async () => {
  const { DB, env } = await setup(); await addQuote(DB, { email: "gone@client.co" });
  await DB.prepare("INSERT INTO unsubscribes (email,is_global,created_at) VALUES ('gone@client.co',1,?)").bind(at(0)).run();
  const s = sends(); await runScheduler(env, { now: T0, send: s.send });
  assert.equal(s.sent.length, 0); assert.equal((await row(DB)).status, "paused"); assert.equal(await events(DB, "client_unsub"), 1);
});

test("unsubscribe link pauses all of that client's open quotes", async () => {
  const { DB, env } = await setup(); await addQuote(DB, { id: "q1" }); await addQuote(DB, { id: "q2" });
  assert.ok((await applyUnsubscribe(DB, "tok-q1")).found);
  assert.equal((await row(DB, "q2")).status, "paused");
  const s = sends(); await runScheduler(env, { now: T0, send: s.send }); assert.equal(s.sent.length, 0);
});

test("failure: the claim is released, retried in an hour, and paused after three tries", async () => {
  const { DB, env } = await setup(); await addQuote(DB);
  const bad = async () => ({ ok: false, error: "boom" });
  await runScheduler(env, { now: T0, send: bad });
  let q = await row(DB);
  assert.equal(q.followups_sent, 0); assert.equal(q.status, "waiting"); assert.equal(q.retry_count, 1);
  assert.equal(q.next_followup_at, at(36e5)); assert.equal(await events(DB, "email_failed"), 1);
  const s = sends(); await runScheduler(env, { now: T0, send: s.send }); assert.equal(s.sent.length, 0); // not due for an hour yet
  await runScheduler(env, { now: new Date(T0.getTime() + 36e5), send: bad });
  await runScheduler(env, { now: new Date(T0.getTime() + 2 * 36e5), send: bad });
  q = await row(DB); assert.equal(q.status, "paused"); assert.equal(q.retry_count, 3); assert.equal(q.followups_sent, 0);
});

test("a send that succeeds after a failure resets the retry count", async () => {
  const { DB, env } = await setup(); await addQuote(DB);
  await runScheduler(env, { now: T0, send: async () => ({ ok: false }) });
  const s = sends(); await runScheduler(env, { now: new Date(T0.getTime() + 36e5), send: s.send });
  assert.equal(s.sent.length, 1); assert.equal((await row(DB)).retry_count, 0);
});

test("global daily cap limits how many go out", async () => {
  const { DB, env } = await setup({ DAILY_SEND_CAP: "2" });
  for (const id of ["a", "b", "c"]) await addQuote(DB, { id, email: id + "@client.co" });
  const s = sends(); await runScheduler(env, { now: T0, send: s.send }); assert.equal(s.sent.length, 2);
  await runScheduler(env, { now: T0, send: s.send }); assert.equal(s.sent.length, 2); // still capped today
});

test("dry run is recorded as dry_run events", async () => {
  const { DB, env } = await setup(); await addQuote(DB);
  const r = await runScheduler(env, { now: T0, send: async () => ({ ok: true, dryRun: true }) });
  assert.equal(r.dryRun, 1); assert.equal(await events(DB, "dry_run"), 1); assert.equal(await events(DB, "email_sent"), 0);
});

test("outside 8am to 7pm UK time nothing is sent", async () => {
  const { DB, env } = await setup(); await addQuote(DB, { next: -DAY });
  const s = sends(); await runScheduler(env, { now: new Date("2026-11-23T22:30:00Z"), send: s.send });
  assert.equal(s.sent.length, 0);
});

test("rate limited by the email service: the step is handed back untouched and the run stops", async () => {
  const { DB, env } = await setup();
  await addQuote(DB, { id: "q1", next: -2000 });
  await addQuote(DB, { id: "q2", email: "jo@client.co", next: -1000 });
  let calls = 0;
  const r = await runScheduler(env, { now: T0, send: async () => { calls++; return { ok: false, error: "status 429", rateLimited: true }; } });
  assert.equal(calls, 1); assert.equal(r.failed, 0); assert.equal(r.sent, 0);
  const q = await row(DB, "q1");
  assert.equal(q.followups_sent, 0); assert.equal(q.retry_count, 0); assert.equal(q.status, "waiting"); assert.equal(q.last_sent_at, null); assert.ok(q.next_followup_at);
  assert.equal((await DB.prepare("SELECT COUNT(*) AS n FROM events WHERE type='email_failed'").first()).n, 0);
  const again = sends(); // next run, the limit has passed: both go out
  const r2 = await runScheduler(env, { now: new Date(T0.getTime() + 15 * 60e3), send: again.send });
  assert.equal(r2.sent, 2);
});
