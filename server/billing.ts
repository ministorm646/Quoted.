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

// The hosted checkout page, with the customer's email filled in, the business tagged so the webhook can
// find it, and the founding-member discount code applied for founding members.
export function checkoutUrl(env: Env, plan: string, email: string, businessId: string, founding: boolean): string | null {
  const base = plan === "monthly" ? env.LS_CHECKOUT_MONTHLY : plan === "annual" ? env.LS_CHECKOUT_ANNUAL : "";
  if (!base) return null;
  let u: URL;
  try { u = new URL(base); } catch { return null; }
  if (u.protocol !== "https:") return null;
  u.searchParams.set("checkout[email]", email);
  u.searchParams.set("checkout[custom][business_id]", businessId);
  if (founding && env.FOUNDING_DISCOUNT_CODE) u.searchParams.set("checkout[discount_code]", env.FOUNDING_DISCOUNT_CODE);
  return u.toString();
}

// Lemon Squeezy signs the raw request body with HMAC-SHA256 and sends the hex in X-Signature.
export async function verifySignature(secret: string, raw: string, header: string | undefined): Promise<boolean> {
  if (!secret || !header) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  const hex = Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(hex, header.trim().toLowerCase());
}

const STATUS: Record<string, string> = {
  active: "active", on_trial: "active", past_due: "past_due", unpaid: "past_due",
  cancelled: "cancelled", expired: "expired", paused: "paused",
};

// Records a subscription event on the right business. Events can arrive out of order, so an
// older event never overwrites a newer one. Returns whether anything was changed.
export async function applyBillingEvent(db: Db, env: Env, payload: any): Promise<{ applied: boolean; reason?: string }> {
  const name = String(payload?.meta?.event_name ?? "");
  if (!name.startsWith("subscription_") || name === "subscription_payment_success" || name === "subscription_payment_failed" || name === "subscription_payment_recovered" || name === "subscription_payment_refunded") {
    // Payment events are followed by a subscription_updated carrying the latest status.
    return { applied: false, reason: "ignored event" };
  }
  const businessId = payload?.meta?.custom_data?.business_id;
  const a = payload?.data?.attributes;
  if (typeof businessId !== "string" || !a) return { applied: false, reason: "missing business or data" };
  const status = STATUS[String(a.status)];
  if (!status) return { applied: false, reason: "unknown status" };
  const renews = status === "cancelled" ? (a.ends_at ?? a.renews_at ?? null) : (a.renews_at ?? null);
  const variant = String(a.variant_id ?? "");
  const plan = variant && variant === env.LS_VARIANT_MONTHLY ? "monthly" : variant && variant === env.LS_VARIANT_ANNUAL ? "annual" : null;
  const updated = typeof a.updated_at === "string" ? a.updated_at : new Date().toISOString();
  const r = await db.prepare(
    `UPDATE businesses SET sub_status = ?, plan = COALESCE(?, plan), sub_renews_at = ?, provider_sub_id = ?,
       portal_url = COALESCE(?, portal_url), sub_updated_at = ?
     WHERE id = ? AND (sub_updated_at IS NULL OR sub_updated_at <= ?)`,
  ).bind(status, plan, renews, String(payload.data.id ?? ""), a.urls?.customer_portal ?? null, updated, businessId, updated).run();
  return r.meta.changes === 1 ? { applied: true } : { applied: false, reason: "no business or older event" };
}
