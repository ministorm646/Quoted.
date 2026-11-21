import type { Env } from "../types.js";
import { hmacHash, newId, randomToken } from "./crypto.js";
import { addMonths, nowIso, referralCode } from "./util.js";

export async function createUserWithBusiness(
  env: Env, email: string, businessName: string, referredBy: string | null,
): Promise<{ id: string }> {
  const uid = newId();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, created_at) VALUES (?,?,?)").bind(uid, email, now),
    env.DB.prepare(
      `INSERT INTO businesses (id, user_id, name, reply_to, free_until, referral_code, referred_by, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
    ).bind(newId(), uid, businessName, email, addMonths(3), referralCode(), referredBy, now),
  ]);
  return { id: uid };
}

// Returns the raw token (goes in the email). Only its keyed hash is stored.
export async function makeLoginToken(
  env: Env, userId: string, purpose: "login" | "invite", ttlSec: number,
): Promise<string> {
  const token = randomToken();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO login_tokens (token_hash, user_id, purpose, expires_at, created_at) VALUES (?,?,?,?,?)",
  ).bind(
    await hmacHash(env.SESSION_SECRET, token), userId, purpose,
    new Date(now + ttlSec * 1000).toISOString(), new Date(now).toISOString(),
  ).run();
  return token;
}

export const seatCap = (env: Env) => parseInt(env.SEAT_CAP, 10) || 30;

export async function seatsUsed(env: Env): Promise<number> {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE email != ?")
    .bind(env.ADMIN_EMAIL.trim().toLowerCase()).first<{ n: number }>();
  return r?.n ?? 0;
}
