import type { Env } from "../types.js";
import { escapeHtml } from "./util.js";

export type Mail = {
  to: string; subject: string; text: string; html: string;
  replyTo?: string; fromName?: string; headers?: Record<string, string>;
};
export type SendResult = { ok: boolean; dryRun?: boolean; error?: string };

export async function sendEmail(env: Env, m: Mail): Promise<SendResult> {
  const name = (m.fromName ?? env.PRODUCT_NAME).replace(/[<>"\r\n]/g, "").slice(0, 60);
  if (env.DRY_RUN === "true") {
    // Dry run logs the message (including sign-in links) to the Vercel runtime logs.
    console.log("DRY_RUN email", JSON.stringify({ to: m.to, subject: m.subject, text: m.text }));
    return { ok: true, dryRun: true };
  }
  try {
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
      return { ok: false, error: `status ${r.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error("Resend error", String(e));
    return { ok: false, error: "network" };
  }
}

// Sign-in and invite emails (the only emails early-access people ever receive).
export function signInEmail(env: Env, to: string, token: string, invite: boolean): Mail {
  const link = `${env.APP_URL.replace(/\/$/, "")}/verify?token=${encodeURIComponent(token)}`;
  const name = env.PRODUCT_NAME;
  const lead = invite
    ? `You have a place in the ${name} early access. Use the button to sign in. The link works once and lasts 7 days.`
    : `Use the button to sign in to ${name}. The link works once and expires in 15 minutes.`;
  const text = `${lead}\n\n${link}\n\nIf you did not ask for this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;color:#10231C;max-width:480px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(name)}</h1>
<p style="font-size:16px;line-height:1.5">${escapeHtml(lead)}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0E7A55;color:#fff;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:8px">Sign in</a></p>
<p style="font-size:13px;color:#4a5b53">If the button does not work, paste this into your browser:<br>${escapeHtml(link)}</p>
<p style="font-size:13px;color:#4a5b53">If you did not ask for this, you can ignore this email.</p></div>`;
  return {
    to,
    subject: invite ? `You're in: ${name} early access` : `Your ${name} sign-in link`,
    text, html,
  };
}
