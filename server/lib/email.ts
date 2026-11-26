import type { Env } from "../types.js";
import { escapeHtml } from "./util.js";
import { emailShell } from "./layout.js";

export type Mail = {
  to: string; subject: string; text: string; html: string;
  replyTo?: string; fromName?: string; headers?: Record<string, string>;
};
export type SendResult = { ok: boolean; dryRun?: boolean; error?: string; rateLimited?: boolean };

// Resend's free plan allows 2 requests a second and 100 emails a day. Space real sends out a little
// so a batch never trips the per-second limit.
const GAP_MS = 600;
let lastSendAt = 0;
async function pace() {
  const wait = lastSendAt + GAP_MS - Date.now();
  lastSendAt = Math.max(Date.now(), lastSendAt + GAP_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export async function sendEmail(env: Env, m: Mail): Promise<SendResult> {
  const name = (m.fromName ?? env.PRODUCT_NAME).replace(/[<>"\r\n]/g, "").slice(0, 60);
  if (env.DRY_RUN === "true") {
    // Dry run logs the message (including sign-in links) to the Vercel runtime logs.
    // Links are listed on their own so they are easy to copy.
    console.log(`DRY_RUN email to ${m.to} | subject: ${m.subject} | LINKS: ${(m.text.match(/https?:\/\/[^\s]+/g) ?? []).join("  ")}`);
    return { ok: true, dryRun: true };
  }
  try {
    await pace();
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${name} <${env.FROM_EMAIL}>`,
        to: [m.to], subject: m.subject, html: m.html, text: m.text,
        ...(m.replyTo ? { reply_to: m.replyTo } : {}),
        ...(m.headers ? { headers: m.headers } : {}),
      }),
    });
    if (!r.ok) {
      console.error("Resend failed", r.status, (await r.text()).slice(0, 300));
      // 429 means the per-second or daily limit was hit. That is not the email's fault, so the caller should just wait.
      return { ok: false, error: `status ${r.status}`, rateLimited: r.status === 429 };
    }
    return { ok: true };
  } catch (e) {
    console.error("Resend error", String(e));
    return { ok: false, error: "network" };
  }
}

// Sign-in and invite emails (the only emails early-access people ever receive).
export function signInEmail(env: Env, to: string, token: string, invite: boolean, welcome = false): Mail {
  const link = `${env.APP_URL.replace(/\/$/, "")}/verify?token=${encodeURIComponent(token)}`;
  const name = env.PRODUCT_NAME;
  const lead = welcome
    ? `Welcome to ${name}. Use the button to confirm your email and get started. The link works once and lasts 60 minutes.`
    : invite
    ? `You have a place in the ${name} early access. Use the button to sign in. The link works once and lasts 7 days.`
    : `Use the button to sign in to ${name}. The link works once and expires in 15 minutes.`;
  const text = `${lead}\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`;
  const html = emailShell(env, `<p style="font-size:16px;line-height:1.5;margin:0 0 20px">${escapeHtml(lead)}</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#FFD60A;color:#12121A;border:2px solid #12121A;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px">Sign in</a></p>
<p style="font-size:13px;line-height:1.5;color:#55555F;margin:0 0 8px">If the button does not work, paste this into your browser:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#55555F;margin:0">If you did not ask for this, you can ignore this email.</p>`);
  return {
    to,
    subject: welcome ? `Welcome to ${name}.` : invite ? `You're in: ${name} early access` : `Your ${name} sign-in link`,
    text, html,
  };
}
