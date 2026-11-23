import type { Env } from "./types.js";
import { makeDb, type Db } from "./db.js";

const e = process.env;
const appUrl = () => e.APP_URL || (e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : "");
const dryRun = () => ((e.DRY_RUN ?? "true").trim().toLowerCase() === "false" ? "false" : "true");

// Names (never values) of settings that are not filled in yet.
export function missingSettings(): string[] {
  const need = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "SESSION_SECRET", "TURNSTILE_SITE_KEY", "TURNSTILE_SECRET", "ADMIN_EMAIL", "FROM_EMAIL"];
  if (dryRun() === "false") need.push("RESEND_API_KEY");
  const missing = need.filter((k) => !e[k]);
  if (!appUrl()) missing.push("APP_URL");
  if (e.SESSION_SECRET && e.SESSION_SECRET.length < 32) missing.push("SESSION_SECRET (needs 32+ characters)");
  return missing;
}

let db: Db | null = null;
export function buildEnv(): Env {
  db ??= makeDb(e.TURSO_DATABASE_URL!, e.TURSO_AUTH_TOKEN!);
  return {
    DB: db,
    RESEND_API_KEY: e.RESEND_API_KEY ?? "",
    SESSION_SECRET: e.SESSION_SECRET!,
    TURNSTILE_SECRET: e.TURNSTILE_SECRET!,
    TURNSTILE_SITE_KEY: e.TURNSTILE_SITE_KEY!,
    PRODUCT_NAME: e.PRODUCT_NAME || "Quoted",
    APP_URL: appUrl().replace(/\/$/, ""),
    FROM_EMAIL: e.FROM_EMAIL!,
    ADMIN_EMAIL: e.ADMIN_EMAIL!,
    DRY_RUN: dryRun(),
    SEAT_CAP: e.SEAT_CAP ?? "30",
    DAILY_SEND_CAP: e.DAILY_SEND_CAP ?? "80",
    CRON_SECRET: e.CRON_SECRET ?? "",
    COMPANY_NAME: e.COMPANY_NAME ?? "",
    COMPANY_NUMBER: e.COMPANY_NUMBER ?? "",
    COMPANY_ADDRESS: e.COMPANY_ADDRESS ?? "",
    SUPPORT_EMAIL: e.SUPPORT_EMAIL || e.FROM_EMAIL || "",
    BILLING_ENABLED: (e.BILLING_ENABLED ?? "false").trim().toLowerCase() === "true" ? "true" : "false",
    PRICE_MONTHLY: e.PRICE_MONTHLY ?? "19",
    PRICE_ANNUAL: e.PRICE_ANNUAL ?? "190",
    FOUNDING_DISCOUNT_PERCENT: e.FOUNDING_DISCOUNT_PERCENT ?? "30",
    FOUNDING_DISCOUNT_CODE: e.FOUNDING_DISCOUNT_CODE ?? "",
    LS_CHECKOUT_MONTHLY: e.LS_CHECKOUT_MONTHLY ?? "",
    LS_CHECKOUT_ANNUAL: e.LS_CHECKOUT_ANNUAL ?? "",
    LS_VARIANT_MONTHLY: e.LS_VARIANT_MONTHLY ?? "",
    LS_VARIANT_ANNUAL: e.LS_VARIANT_ANNUAL ?? "",
    LS_WEBHOOK_SECRET: e.LS_WEBHOOK_SECRET ?? "",
    TRIAL_DAYS: e.TRIAL_DAYS ?? "14",
  };
}
