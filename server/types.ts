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
}
export type SessionUser = { id: string; email: string };
export type HC = {
  Bindings: Env;
  Variables: { user?: SessionUser; csrf?: string; biz?: { id: string; schedule: string } };
};
