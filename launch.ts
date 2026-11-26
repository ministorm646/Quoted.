import type { Db } from "./db.js";
import type { Env } from "./types.js";
import { sendEmail, signInEmail, type Mail, type SendResult } from "./lib/email.js";
import { emailShell } from "./lib/layout.js";
import { createUserWithBusiness } from "./lib/accounts.js";
import { escapeHtml, nowIso } from "./lib/util.js";
import { foundingPercent, plans } from "./billing.js";

// ---------- the launch switch ----------
// One flag in the database. Off: early access (invite only, free). On: early access is closed, anyone can
// sign up for a free trial, and everyone must subscribe once their free period ends.
const cache = new WeakMap<object, { at: number; launched: boolean }>();

export async function isLaunched(db: Db): Promise<boolean> {
  const hit = cache.get(db);
  if (hit && Date.now() - hit.at < 10_000) return hit.launched;
  const r = await db.prepare("SELECT v FROM app_settings WHERE k = 'launched'").first<{ v: string }>();
  const launched = r?.v === "1";
  cache.set(db, { at: Date.now(), launched });
  return launched;
}

// BILLING_ENABLED=true can still force billing on before launch (for testing).
export async function billingOn(env: Env): Promise<boolean> {
  return env.BILLING_ENABLED === "true" || (await isLaunched(env.DB));
}

export async function setLaunched(db: Db, on: boolean): Promise<void> {
  const now = nowIso();
  const stmts = [db.prepare("INSERT OR REPLACE INTO app_settings (k, v, updated_at) VALUES ('launched', ?, ?)").bind(on ? "1" : "0", now)];
  if (on) stmts.push(db.prepare("INSERT OR REPLACE INTO app_settings (k, v, updated_at) VALUES ('launched_at', ?, ?)").bind(now, now));
  await db.batch(stmts);
  cache.delete(db);
}

export async function launchedAt(db: Db): Promise<string | null> {
  return (await db.prepare("SELECT v FROM app_settings WHERE k = 'launched_at'").first<{ v: string }>())?.v ?? null;
}

// ---------- is everything ready? ----------
export type Check = { key: string; label: string; ok: boolean; required: boolean; hint: string };

export function readiness(env: Env): Check[] {
  const priced = (v: string) => Number(v) > 0;
  const planOk = (price: string, id: string) => !priced(price) || id.startsWith("price_"); // a plan that is priced must be purchasable
  const pct = foundingPercent(env);
  return [
    { key: "stripe", required: true, ok: /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY), label: "Stripe is connected in live mode",
      hint: "Set STRIPE_SECRET_KEY to your live secret key (sk_live_...). Test keys do not count." },
    { key: "monthly", required: true, ok: priced(env.PRICE_MONTHLY) && env.STRIPE_PRICE_MONTHLY.startsWith("price_"), label: "Monthly plan is set up",
      hint: "Set PRICE_MONTHLY and STRIPE_PRICE_MONTHLY (the price id from Stripe, starting price_)." },
    { key: "annual", required: true, ok: planOk(env.PRICE_ANNUAL, env.STRIPE_PRICE_ANNUAL), label: "Annual plan is set up, or switched off",
      hint: "Set STRIPE_PRICE_ANNUAL, or clear PRICE_ANNUAL to hide the annual plan." },
    { key: "webhook", required: true, ok: env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_"), label: "Payment webhook secret is set",
      hint: "Set STRIPE_WEBHOOK_SECRET (starts whsec_) from the webhook endpoint in Stripe." },
    { key: "founding", required: true, ok: pct === 0 || env.STRIPE_COUPON_FOUNDING.length > 0, label: "Founding discount coupon is set",
      hint: "Create the coupon in Stripe and set STRIPE_COUPON_FOUNDING to its id, or set FOUNDING_DISCOUNT_PERCENT to 0." },
    { key: "emails", required: true, ok: env.DRY_RUN === "false" && env.RESEND_API_KEY.length > 0, label: "Real emails are switched on",
      hint: "Set RESEND_API_KEY and DRY_RUN=false. New customers get their sign-in link by email." },
    { key: "cron", required: true, ok: env.CRON_SECRET.length >= 16, label: "Follow-up timer is set up",
      hint: "Set CRON_SECRET and add the 15-minute timer (see the setup guide)." },
    { key: "turnstile", required: true, ok: !env.TURNSTILE_SITE_KEY.startsWith("1x0000"), label: "Real bot check keys",
      hint: "You are using Cloudflare's test keys, which let bots through. Create real Turnstile keys." },
    { key: "company", required: false, ok: !!(env.COMPANY_NAME && env.COMPANY_NUMBER && env.COMPANY_ADDRESS), label: "Company details are set",
      hint: "Set COMPANY_NAME, COMPANY_NUMBER and COMPANY_ADDRESS. They show in the footer and legal pages." },
    { key: "domain", required: false, ok: !env.APP_URL.includes("vercel.app"), label: "Your own domain is in use",
      hint: "Add your domain in Vercel and set APP_URL to it." },
  ];
}
export const launchBlockers = (checks: Check[]) => checks.filter((c) => c.required && !c.ok);

// ---------- numbers for the launch page ----------
export async function launchCounts(db: Db, adminEmail: string, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const r = await db.prepare(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(b.founding = 1), 0) AS founding,
            COALESCE(SUM(b.founding = 1 AND b.free_until >= ? AND b.sub_status NOT IN ('active','past_due')), 0) AS foundingFree,
            COALESCE(SUM(b.sub_status IN ('active','past_due')), 0) AS subscribers,
            COALESCE(SUM(b.founding = 1 AND b.launch_emailed_at IS NULL), 0) AS emailsPending
     FROM businesses b JOIN users u ON u.id = b.user_id WHERE u.email != ?`,
  ).bind(today, adminEmail).first<{ total: number; founding: number; foundingFree: number; subscribers: number; emailsPending: number }>();
  const w = await db.prepare("SELECT COUNT(*) AS n FROM waitlist WHERE status = 'pending'").first<{ n: number }>();
  return { ...r!, waitlistPending: w?.n ?? 0 };
}

// ---------- new customers after launch ----------
export const trialDays = (env: Env) => {
  const n = parseInt(env.TRIAL_DAYS, 10);
  return Number.isFinite(n) ? Math.min(60, Math.max(0, n)) : 14;
};
const addDays = (n: number, from = new Date()) => new Date(from.getTime() + n * 864e5).toISOString().slice(0, 10);
export const trialFreeUntil = (env: Env, from = new Date()) => (trialDays(env) > 0 ? addDays(trialDays(env), from) : addDays(-1, from));

export async function selfServeSignup(env: Env, input: { email: string; businessName: string; ref: string | null }): Promise<{ userId: string; isNew: boolean }> {
  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(input.email).first<{ id: string }>();
  if (existing) return { userId: existing.id, isNew: false };
  let referredBy: string | null = null;
  if (input.ref) referredBy = (await env.DB.prepare("SELECT id FROM businesses WHERE referral_code = ?").bind(input.ref).first<{ id: string }>())?.id ?? null;
  const u = await createUserWithBusiness(env, input.email, input.businessName, referredBy, 0, trialFreeUntil(env));
  return { userId: u.id, isNew: true };
}

// ---------- telling the founding members ----------
type Recipient = { id: string; name: string; free_until: string; email: string };

export function launchMail(env: Env, r: Recipient): Mail {
  const product = env.PRODUCT_NAME || "Quoted";
  const pct = foundingPercent(env);
  const monthly = plans(env, true).find((p) => p.id === "monthly");
  const offer = pct > 0 && monthly?.foundingPrice
    ? `After that, as a founding member you get ${pct}% off for as long as you stay subscribed: £${monthly.foundingPrice}/month instead of £${monthly.price}.`
    : "After that you can choose a plan that suits you.";
  const link = `${env.APP_URL}/app/billing`;
  const lines = [
    `Hi ${r.name},`,
    `Thank you for being one of the first businesses to use ${product}. Early access has now ended and ${product} is open to everyone.`,
    `You keep your free period until ${r.free_until}. ${offer}`,
    `Nothing changes for your quotes or follow-ups until your free period ends. You can look at the plans any time: ${link}`,
    `Questions? Reply to this email or write to ${env.SUPPORT_EMAIL || env.FROM_EMAIL}.`,
    `Thanks again,\nThe ${product} team`,
  ];
  const html = emailShell(env, `${lines.slice(0, 4).map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 16px">${escapeHtml(p).replace(link, `<a href="${escapeHtml(link)}" style="color:#12121A;text-decoration:underline">${escapeHtml(link)}</a>`)}</p>`).join("")}
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#FFD60A;color:#12121A;border:2px solid #12121A;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:8px">See the plans</a></p>
${lines.slice(4).map((p) => `<p style="font-size:16px;line-height:1.5;margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("")}`);
  return { to: r.email, subject: `Early access has ended: your founding-member offer`, text: lines.join("\n\n"), html };
}

// Sends the launch email to founding members who haven't had it yet, in small batches.
export async function sendLaunchEmails(env: Env, limit = 25, send: (m: Mail) => Promise<SendResult> = (m) => sendEmail(env, m), adminEmail = env.ADMIN_EMAIL?.trim().toLowerCase() ?? "") {
  const { results } = await env.DB.prepare(
    `SELECT b.id, b.name, b.free_until, u.email FROM businesses b JOIN users u ON u.id = b.user_id
     WHERE b.founding = 1 AND b.launch_emailed_at IS NULL AND u.email != ? ORDER BY b.created_at LIMIT ?`,
  ).bind(adminEmail, limit).all<Recipient>();
  let sent = 0, failed = 0, dryRun = 0;
  for (const r of results) {
    let res: SendResult;
    try { res = await send(launchMail(env, r)); } catch { res = { ok: false }; }
    if (!res.ok) { failed++; continue; }
    if (res.dryRun) { dryRun++; continue; } // a test run does not count as told
    await env.DB.prepare("UPDATE businesses SET launch_emailed_at = ? WHERE id = ? AND launch_emailed_at IS NULL").bind(nowIso(), r.id).run();
    sent++;
  }
  const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM businesses b JOIN users u ON u.id = b.user_id WHERE b.founding = 1 AND b.launch_emailed_at IS NULL AND u.email != ?").bind(adminEmail).first<{ n: number }>();
  return { sent, failed, dryRun, remaining: left?.n ?? 0 };
}

// ---------- takings, for the admin stats ----------
export async function subscriptionStats(db: Db, env: Env, adminEmail: string) {
  const { results } = await db.prepare(
    `SELECT b.plan, b.founding, b.sub_status FROM businesses b JOIN users u ON u.id = b.user_id
     WHERE u.email != ? AND b.sub_status IN ('active','past_due','cancelled')`,
  ).bind(adminEmail).all<{ plan: string | null; founding: number; sub_status: string }>();
  const pct = foundingPercent(env);
  const monthly = Number(env.PRICE_MONTHLY) || 0, annual = Number(env.PRICE_ANNUAL) || 0;
  let est = 0, active = 0, founding = 0;
  for (const r of results) {
    if (r.sub_status === "cancelled") continue;
    active++; if (r.founding === 1) founding++;
    const base = r.plan === "annual" ? annual / 12 : monthly;
    est += r.founding === 1 ? (base * (100 - pct)) / 100 : base;
  }
  return {
    active, founding, standard: active - founding,
    pastDue: results.filter((r) => r.sub_status === "past_due").length,
    cancelled: results.filter((r) => r.sub_status === "cancelled").length,
    estMonthlyPence: Math.round(est * 100),
  };
}
