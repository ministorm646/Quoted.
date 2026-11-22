import type { Db } from "./db.js";
import type { Env } from "./types.js";
import type { Mail } from "./lib/email.js";
import { escapeHtml } from "./lib/util.js";
import { emailShell } from "./lib/layout.js";

export const ACTIONS: Record<string, { status: string; event: string; label: string }> = {
  yes: { status: "accepted", event: "client_accept", label: "Yes, go ahead" },
  question: { status: "question", event: "client_question", label: "I have a question" },
  no: { status: "declined", event: "client_decline", label: "Not interested" },
};

export type TokenQuote = {
  id: string; client_name: string; client_email: string; description: string; status: string;
  business_name: string; owner_email: string;
};

export async function lookupToken(db: Db, token: string): Promise<TokenQuote | null> {
  if (!token || token.length > 64) return null;
  return db.prepare(
    `SELECT q.id, q.client_name, q.client_email, q.description, q.status, b.name AS business_name, u.email AS owner_email
     FROM quotes q JOIN businesses b ON b.id = q.business_id JOIN users u ON u.id = b.user_id
     WHERE q.response_token = ?`,
  ).bind(token).first<TokenQuote>();
}

// Any button stops the chasing at once (next_followup_at is cleared).
export async function applyResponse(db: Db, token: string, action: string) {
  const a = ACTIONS[action];
  const q = a ? await lookupToken(db, token) : null;
  if (!a || !q) return { found: false as const };
  const iso = new Date().toISOString();
  const [upd] = await db.batch([
    db.prepare("UPDATE quotes SET status=?, next_followup_at=NULL, updated_at=? WHERE id=? AND status NOT IN ('won','lost') AND status != ?")
      .bind(a.status, iso, q.id, a.status),
    db.prepare("INSERT INTO events (quote_id, type, created_at) SELECT ?, ?, ? WHERE changes() > 0").bind(q.id, a.event, iso),
  ]);
  return { found: true as const, applied: upd.meta.changes === 1, q, label: a.label };
}

// Unsubscribe applies to every business: record the address, pause its open quotes.
export async function applyUnsubscribe(db: Db, token: string) {
  const q = await lookupToken(db, token);
  if (!q) return { found: false as const };
  const iso = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO unsubscribes (email, is_global, created_at) VALUES (?, 1, ?)").bind(q.client_email, iso),
    db.prepare("INSERT INTO events (quote_id, type, created_at) SELECT id, 'client_unsub', ? FROM quotes WHERE client_email = ? AND status IN ('waiting','following_up','paused')").bind(iso, q.client_email),
    db.prepare("UPDATE quotes SET status='paused', next_followup_at=NULL, updated_at=? WHERE client_email = ? AND status IN ('waiting','following_up')").bind(iso, q.client_email),
  ]);
  return { found: true as const, q };
}

export function ownerNotice(env: Env, q: TokenQuote, label: string): Mail {
  const link = `${env.APP_URL}/app/quotes/${q.id}`;
  const line = `${q.client_name} replied about "${q.description}": ${label}.`;
  return {
    to: q.owner_email,
    subject: `${q.client_name} replied: ${label}`,
    text: `${line}\n\nOpen the quote: ${link}`,
    html: emailShell(env, `<p style="font-size:16px;line-height:1.5;margin:0 0 20px">${escapeHtml(line)}</p><p style="margin:0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#0E7A55;color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px">Open the quote</a></p>`),
  };
}
