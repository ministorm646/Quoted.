import type { Env } from "../types.js";
import { escapeHtml } from "./util.js";

// The frame around QuoteMe's own emails (sign-in, invite, reply notices).
export function emailShell(env: Env, inner: string): string {
  const company = [env.COMPANY_NAME, env.COMPANY_NUMBER ? `Company no. ${env.COMPANY_NUMBER}` : "", env.COMPANY_ADDRESS]
    .filter(Boolean).map(escapeHtml).join(" | ");
  return `<div style="background:#F4F6F3;padding:24px 12px"><div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #10231C;border-radius:12px;padding:28px;font-family:Arial,sans-serif;color:#10231C"><p style="margin:0 0 20px;font-size:22px;font-weight:bold">${escapeHtml(env.PRODUCT_NAME || "QuoteMe")}</p>${inner}</div>${company ? `<p style="max-width:520px;margin:12px auto 0;font-size:12px;line-height:1.5;color:#4a5b53;text-align:center;font-family:Arial,sans-serif">${company}</p>` : ""}</div>`;
}
