import type { Db } from "./db.js";

export interface Env {
  DB: Db;
  RESEND_API_KEY: string;
  SESSION_SECRET: string;
  TURNSTILE_SECRET: string;
  PRODUCT_NAME: string;
  APP_URL: string;
  FROM_EMAIL: string;
  ADMIN_EMAIL: string;
  TURNSTILE_SITE_KEY: string;
  DRY_RUN: string;
  SEAT_CAP: string;
  DAILY_SEND_CAP: string;
  CRON_SECRET: string;
  COMPANY_NAME: string;
  COMPANY_NUMBER: string;
  COMPANY_ADDRESS: string;
  SUPPORT_EMAIL: string;
  BILLING_ENABLED: string;
  PRICE_MONTHLY: string;
  PRICE_ANNUAL: string;
  FOUNDING_DISCOUNT_PERCENT: string;
  FOUNDING_DISCOUNT_CODE: string;
  LS_CHECKOUT_MONTHLY: string;
  LS_CHECKOUT_ANNUAL: string;
  LS_VARIANT_MONTHLY: string;
  LS_VARIANT_ANNUAL: string;
  LS_WEBHOOK_SECRET: string;
  TRIAL_DAYS: string;
}
export type SessionUser = { id: string; email: string };
export type HC = {
  Bindings: Env;
  Variables: {
    user?: SessionUser; csrf?: string; sidHash?: string; via?: string; sessionCreated?: string;
    biz?: { id: string; schedule: string; free_until: string; sub_status: string; sub_renews_at: string | null; plan: string | null; founding: number };
  };
};
