import type { Env } from "./types.js";
import { sendEmail, type Mail, type SendResult } from "./lib/email.js";
import { followupMail } from "./lib/followup.js";
import { DEFAULT_SCHEDULE } from "./lib/template.js";
import { ACCESS_WHERE } from "./billing.js";
import { billingOn } from "./launch.js";

const DAY = 864e5, HOUR = 36e5;
const MAX_RETRIES = 3;      // failed sends before a quote is paused
const BATCH = 20;           // quotes looked at per run
const BUSINESS_DAILY_CAP = 25;
const OPEN = "('waiting','following_up')";
const COUNTED = "('email_sent','dry_run')";

export type RunResult = { checked: number; sent: number; dryRun: number; skipped: number; failed: number };
type Cand = {
  id: string; business_id: string; client_name: string; client_email: string; description: string;
  sent_at: string; status: string; followups_sent: number; retry_count: number; last_sent_at: string | null;
  response_token: string; bname: string; reply_to: string; schedule: string; template: string | null;
};

export function parseSchedule(json: string): number[] {
  try {
    const s = JSON.parse(json);
    if (Array.isArray(s) && s.length && s.every((n) => Number.isInteger(n) && n > 0)) return s.slice(0, 5);
  } catch { /* use default */ }
  return DEFAULT_SCHEDULE;
}

// Emails only go out between 8am and 7pm UK time.
export function inSendingHours(now: Date): boolean {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now)) % 24;
  return h >= 8 && h < 19;
}

export async function runScheduler(
  env: Env,
  opts: { now?: Date; send?: (m: Mail) => Promise<SendResult>; anyTime?: boolean } = {},
): Promise<RunResult> {
  const now = opts.now ?? new Date();
  const iso = now.toISOString();
  const send = opts.send ?? ((m: Mail) => sendEmail(env, m));
  const out: RunResult = { checked: 0, sent: 0, dryRun: 0, skipped: 0, failed: 0 };
  if (!opts.anyTime && !inSendingHours(now)) return out;

  const dayStart = iso.slice(0, 10) + "T00:00:00.000Z";
  const globalCap = parseInt(env.DAILY_SEND_CAP, 10) || 80;
  let sentToday = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM events WHERE type IN ${COUNTED} AND created_at >= ?`)
    .bind(dayStart).first<{ n: number }>())?.n ?? 0;

  const billingFlag = (await billingOn(env)) ? 1 : 0;
  const { results } = await env.DB.prepare(
    `SELECT q.id, q.business_id, q.client_name, q.client_email, q.description, q.sent_at, q.status,
            q.followups_sent, q.retry_count, q.last_sent_at, q.response_token,
            b.name AS bname, b.reply_to, b.schedule, b.template
     FROM quotes q JOIN businesses b ON b.id = q.business_id
     WHERE q.status IN ${OPEN} AND q.next_followup_at IS NOT NULL AND q.next_followup_at <= ?
       AND (? = 0 OR ${ACCESS_WHERE})
     ORDER BY q.next_followup_at LIMIT ?`,
  ).bind(iso, billingFlag, iso.slice(0, 10), iso.slice(0, 10), BATCH).all<Cand>();

  const perBusiness = new Map<string, number>();

  for (const q of results) {
    out.checked++;
    if (sentToday >= globalCap) { out.skipped++; continue; } // stays due for the next run

    // Never email someone who has unsubscribed anywhere in the system.
    if (await env.DB.prepare("SELECT 1 AS x FROM unsubscribes WHERE email = ?").bind(q.client_email).first()) {
      await env.DB.batch([
        env.DB.prepare(`UPDATE quotes SET status='paused', next_followup_at=NULL, updated_at=? WHERE id=? AND status IN ${OPEN}`).bind(iso, q.id),
        env.DB.prepare("INSERT INTO events (quote_id, type, detail, created_at) SELECT ?, 'client_unsub', 'already unsubscribed', ? WHERE changes() > 0").bind(q.id, iso),
      ]);
      out.skipped++; continue;
    }

    const steps = parseSchedule(q.schedule);
    if (q.followups_sent >= steps.length) { // all steps used
      await env.DB.prepare(`UPDATE quotes SET next_followup_at=NULL, updated_at=? WHERE id=? AND status IN ${OPEN}`).bind(iso, q.id).run();
      out.skipped++; continue;
    }

    // At least one day between sends.
    if (q.last_sent_at && now.getTime() - Date.parse(q.last_sent_at) < DAY) {
      await env.DB.prepare(`UPDATE quotes SET next_followup_at=?, updated_at=? WHERE id=? AND followups_sent=? AND status IN ${OPEN}`)
        .bind(new Date(Date.parse(q.last_sent_at) + DAY).toISOString(), iso, q.id, q.followups_sent).run();
      out.skipped++; continue;
    }

    let bizCount = perBusiness.get(q.business_id);
    if (bizCount === undefined) {
      bizCount = (await env.DB.prepare(
        `SELECT COUNT(*) AS n FROM events e JOIN quotes x ON x.id = e.quote_id
         WHERE x.business_id = ? AND e.type IN ${COUNTED} AND e.created_at >= ?`,
      ).bind(q.business_id, dayStart).first<{ n: number }>())?.n ?? 0;
    }
    if (bizCount >= BUSINESS_DAILY_CAP) { perBusiness.set(q.business_id, bizCount); out.skipped++; continue; }

    // Claim this step first. Only one run can change the row, so a step is never sent twice.
    const claim = await env.DB.prepare(
      `UPDATE quotes SET followups_sent = followups_sent + 1, status='following_up', last_sent_at=?, next_followup_at=NULL, updated_at=?
       WHERE id=? AND followups_sent=? AND status IN ${OPEN} AND next_followup_at IS NOT NULL AND next_followup_at <= ?`,
    ).bind(iso, iso, q.id, q.followups_sent, iso).run();
    if (claim.meta.changes !== 1) { out.skipped++; continue; }

    const step = q.followups_sent + 1;
    let result: SendResult;
    try { result = await send(followupMail(env, q, step)); }
    catch (e) { result = { ok: false, error: String(e) }; }

    if (result.ok) {
      const nextDays = steps[step];
      const next = nextDays ? new Date(Math.max(Date.parse(q.sent_at) + nextDays * DAY, now.getTime() + DAY)).toISOString() : null;
      await env.DB.batch([
        // Only schedule the next step if the client has not answered in the meantime.
        env.DB.prepare("UPDATE quotes SET next_followup_at=?, retry_count=0, updated_at=? WHERE id=? AND followups_sent=? AND status='following_up'").bind(next, iso, q.id, step),
        env.DB.prepare("INSERT INTO events (quote_id, type, detail, created_at) VALUES (?,?,?,?)")
          .bind(q.id, result.dryRun ? "dry_run" : "email_sent", `step ${step} of ${steps.length}`, iso),
      ]);
      sentToday++; perBusiness.set(q.business_id, bizCount + 1);
      if (result.dryRun) out.dryRun++; else out.sent++;
    } else {
      // Release the claim, try again in an hour, and give up (pause) after MAX_RETRIES.
      const retries = q.retry_count + 1;
      const giveUp = retries >= MAX_RETRIES;
      await env.DB.batch([
        env.DB.prepare(
          `UPDATE quotes SET followups_sent=?, last_sent_at=?, status=?, retry_count=?, next_followup_at=?, updated_at=?
           WHERE id=? AND followups_sent=? AND status='following_up'`,
        ).bind(q.followups_sent, q.last_sent_at, giveUp ? "paused" : q.status, retries,
          giveUp ? null : new Date(now.getTime() + HOUR).toISOString(), iso, q.id, step),
        env.DB.prepare("INSERT INTO events (quote_id, type, detail, created_at) VALUES (?, 'email_failed', ?, ?)")
          .bind(q.id, giveUp ? `gave up after ${retries} tries` : `try ${retries}, retrying in an hour`, iso),
      ]);
      out.failed++;
    }
  }
  return out;
}
