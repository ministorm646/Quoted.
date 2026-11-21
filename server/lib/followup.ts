import type { Env } from "../types.js";
import type { Mail } from "./email.js";
import { escapeHtml } from "./util.js";
import { DEFAULT_TEMPLATE, renderTemplate } from "./template.js";

export type FollowupQuote = {
  client_name: string; client_email: string; description: string; response_token: string;
  bname: string; reply_to: string; template: string | null;
};

// Goes out in the business's name, replies go to the owner. Buttons are plain links
// to a confirm page, so mail scanners that open links cannot answer for the client.
export function followupMail(env: Env, q: FollowupQuote, step: number): Mail {
  const t = q.response_token;
  const yes = `${env.APP_URL}/r/${t}/yes`, ask = `${env.APP_URL}/r/${t}/question`;
  const no = `${env.APP_URL}/r/${t}/no`, unsub = `${env.APP_URL}/u/${t}`;
  const body = renderTemplate(q.template || DEFAULT_TEMPLATE, { client: q.client_name, job: q.description });

  const text = `${body}\n\nYes, go ahead: ${yes}\nI have a question: ${ask}\nNot interested: ${no}\n\nKind regards,\n${q.bname}\n\nDon't want these emails? ${unsub}`;

  const btn = (href: string, label: string, bg: string, fg: string, border: string) =>
    `<a href="${escapeHtml(href)}" style="display:block;text-align:center;margin:0 0 10px;padding:14px 16px;border-radius:8px;background:${bg};color:${fg};border:2px solid ${border};font-weight:bold;font-size:16px;text-decoration:none">${label}</a>`;
  const paras = body.split(/\n{2,}/).map((p) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;color:#10231C;max-width:480px;margin:0 auto;padding:24px">${paras}
${btn(yes, "Yes, go ahead", "#0E7A55", "#ffffff", "#0E7A55")}${btn(ask, "I have a question", "#ffffff", "#10231C", "#10231C")}${btn(no, "Not interested", "#F4F6F3", "#10231C", "#c9d1c8")}
<p style="margin:16px 0 0;font-size:16px">Kind regards,<br>${escapeHtml(q.bname)}</p>
<p style="margin:24px 0 0;font-size:12px;color:#4a5b53">Don't want these emails? <a href="${escapeHtml(unsub)}" style="color:#4a5b53">Unsubscribe</a></p></div>`;

  return {
    to: q.client_email,
    subject: `${step === 1 ? "Following up" : "Checking in"}: ${q.description}`.slice(0, 90),
    text, html, replyTo: q.reply_to, fromName: q.bname,
    headers: { "List-Unsubscribe": `<${unsub}>` },
  };
}
