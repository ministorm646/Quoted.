import type { Db } from "./db.js";
import type { Env } from "./types.js";
import { safeEqual } from "./lib/crypto.js";

const DAY = 864e5;

// SQL for "this business may be followed up for": still in its free period, or paying, or cancelled but paid up.
// Two ? placeholders, both today's date as YYYY-MM-DD.
export const ACCESS_WHERE =
  "(b.free_until >= ? OR b.sub_status IN ('active','past_due') OR (b.sub_status = 'cancelled' AND b.sub_renews_at IS NOT NULL AND substr(b.sub_renews_at,1,10) >= ?))";

export type BizBilling = { free_until: string; sub_status: string; sub_renews_at: string | null; plan: string | null; founding: number };
export type Access = { state: "free" | "subscribed" | "past_due" | "cancelled" | "expired"; allowed: boolean; enforced: boolean; daysLeft: number | null; until: string | null };

// Where a business stands. When billing is not switched on (enforced = false) nobody is ever locked out.
export function accessInfo(b: BizBilling, enforced: boolean, now = new Date()): Access {
  const today = now.toISOString().slice(0, 10);
  const days = (d: string) => Math.max(0, Math.ceil((Date.parse(d.slice(0, 10)) - Date.parse(today)) / DAY));
  let state: Access["state"];
  let until: string | null = null;
  let daysLeft: number | null = null;
  const renews = b.sub_renews_at?.slice(0, 10) ?? null;
  if (b.sub_status === "active") state = "subscribed";
  else if (b.sub_status === "past_due") state = "past_due";
  else if (b.sub_status === "cancelled" && renews && renews >= today) { state = "cancelled"; until = renews; daysLeft = days(renews); }
  else if (b.free_until >= today) { state = "free"; until = b.free_until; daysLeft = days(b.free_until); }
  else { state = "expired"; until = b.free_until; daysLeft = 0; }
  return { state, allowed: !enforced || state !== "expired", enforced, daysLeft, until };
}

export type Plan = { id: "monthly" | "annual"; label: string; interval: string; price: number; foundingPrice: number | null };
export function foundingPercent(env: Env): number {
  return Math.min(90, Math.max(0, Math.round(Number(env.FOUNDING_DISCOUNT_PERCENT) || 0)));
}
export function plans(env: Env, founding: boolean): Plan[] {
  const pct = foundingPercent(env);
  const make = (id: Plan["id"], label: string, interval: string, raw: string): Plan | null => {
    const price = Number(raw);
    if (!(price > 0)) return null;
    return { id, label, interval, price, foundingPrice: founding && pct ? Math.round(price * (100 - pct)) / 100 : null };
  };
  return [make("monthly", "Monthly", "month", env.PRICE_MONTHLY), make("annual", "Annual", "year", env.PRICE_ANNUAL)].filter((p): p is Plan => !!p);
}

// ---------- Stripe (work in progress: stays switched off until STRIPE_SECRET_KEY is set) ----------

export function stripeReady(env: Env): boolean {
  return /^(sk|rk)_(live|test)_/.test(env.STRIPE_SECRET_KEY);
}
const priceFor = (env: Env, plan: string) => plan === "monthly" ? env.STRIPE_PRICE_MONTHLY : plan === "annual" ? env.STRIPE_PRICE_ANNUAL : "";

// The form fields for a Stripe Checkout Session. The business id travels on the subscription so the
// webhook can find the right business. Founding members get the founding coupon applied automatically.
export function checkoutParams(env: Env, plan: string, email: string, businessId: string, founding: boolean, customerId: string | null): Record<string, string> | null {
  const price = priceFor(env, plan);
  if (!price.startsWith("price_")) return null;
  const app = env.APP_URL.replace(/\/$/, "");
  const p: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": price,
    "line_items[0][quantity]": "1",
    client_reference_id: businessId,
    "subscription_data[metadata][business_id]": businessId,
    success_url: `${app}/app/billing?paid=1`,
    cancel_url: `${app}/app/billing`,
  };
  if (customerId) p.customer = customerId; else p.customer_email = email;
  if (founding && env.STRIPE_COUPON_FOUNDING) p["discounts[0][coupon]"] = env.STRIPE_COUPON_FOUNDING;
  return p;
}

async function stripePost(env: Env, path: string, params: Record<string, string>): Promise<any | null> {
  try {
    const r = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    if (!r.ok) { console.error("Stripe failed", path, r.status, (await r.text()).slice(0, 300)); return null; }
    return await r.json();
  } catch (e) { console.error("Stripe error", path, String(e)); return null; }
}

export async function createCheckoutUrl(env: Env, plan: string, email: string, businessId: string, founding: boolean, customerId: string | null): Promise<string | null> {
  if (!stripeReady(env)) return null;
  const params = checkoutParams(env, plan, email, businessId, founding, customerId);
  if (!params) return null;
  const s = await stripePost(env, "checkout/sessions", params);
  return typeof s?.url === "string" && s.url.startsWith("https://") ? s.url : null;
}

export async function createPortalUrl(env: Env, customerId: string): Promise<string | null> {
  if (!stripeReady(env) || !customerId) return null;
  const s = await stripePost(env, "billing_portal/sessions", { customer: customerId, return_url: `${env.APP_URL.replace(/\/$/, "")}/app/billing` });
  return typeof s?.url === "string" && s.url.startsWith("https://") ? s.url : null;
}

// Stripe signs "<timestamp>.<raw body>" with HMAC-SHA256. The Stripe-Signature header looks like t=123,v1=abc.
export async function verifySignature(secret: string, raw: string, header: string | undefined, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): Promise<boolean> {
  if (!secret || !header) return false;
  const parts = header.split(",").map((x) => x.trim().split("="));
  const t = parts.find((x) => x[0] === "t")?.[1];
  const sigs = parts.filter((x) => x[0] === "v1" && x[1]).map((x) => x[1].toLowerCase());
  if (!t || !/^\d+$/.test(t) || !sigs.length || Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${raw}`)));
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => safeEqual(hex, s));
}

const STATUS: Record<string, string> = {
  active: "active", trialing: "active", past_due: "past_due", unpaid: "past_due",
  canceled: "cancelled", incomplete_expired: "expired", paused: "paused",
};
const SUB_EVENTS = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
const iso = (sec: unknown) => (typeof sec === "number" && sec > 0 ? new Date(sec * 1000).toISOString() : null);

// Records a subscription event on the right business. Events can arrive out of order, so an
// older event never overwrites a newer one. Returns whether anything was changed.
export async function applyBillingEvent(db: Db, env: Env, payload: any): Promise<{ applied: boolean; reason?: string }> {
  const type = String(payload?.type ?? "");
  if (!SUB_EVENTS.includes(type)) return { applied: false, reason: "ignored event" };
  const s = payload?.data?.object;
  const businessId = s?.metadata?.business_id;
  if (typeof businessId !== "string" || !s || typeof s.id !== "string") return { applied: false, reason: "missing business or data" };
  let status = STATUS[String(s.status)];
  if (type === "customer.subscription.deleted") status = "cancelled";
  if (!status) return { applied: false, reason: "unknown status" };
  const periodEnd = iso(s.current_period_end ?? s.items?.data?.[0]?.current_period_end);
  let renews = periodEnd;
  if (status === "cancelled") renews = iso(s.ended_at) ?? periodEnd;
  else if (status === "active" && s.cancel_at_period_end === true) status = "cancelled"; // paid up until the period ends
  const priceId = String(s.items?.data?.[0]?.price?.id ?? "");
  const plan = priceId && priceId === env.STRIPE_PRICE_MONTHLY ? "monthly" : priceId && priceId === env.STRIPE_PRICE_ANNUAL ? "annual" : null;
  const customer = typeof s.customer === "string" ? s.customer : null;
  const updated = iso(payload.created) ?? new Date().toISOString();
  const r = await db.prepare(
    `UPDATE businesses SET sub_status = ?, plan = COALESCE(?, plan), sub_renews_at = ?, provider_sub_id = ?,
       provider_customer_id = COALESCE(?, provider_customer_id), sub_updated_at = ?
     WHERE id = ? AND (sub_updated_at IS NULL OR sub_updated_at <= ?)`,
  ).bind(status, plan, renews, s.id, customer, updated, businessId, updated).run();
  return r.meta.changes === 1 ? { applied: true } : { applied: false, reason: "no business or older event" };
}
