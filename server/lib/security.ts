import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Env, HC } from "../types.js";
import { hmacHash, randomToken, safeEqual } from "./crypto.js";
import { nowIso } from "./util.js";

export const COOKIE = "__Host-sid";
const SESSION_DAYS = 30;

// Fixed-window counter in D1. Returns true while the caller is under the limit.
export async function hit(env: Env, key: string, limit: number, windowSec: number): Promise<boolean> {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (k, n, exp) VALUES (?, 1, ?)
     ON CONFLICT(k) DO UPDATE SET n = n + 1 RETURNING n`,
  ).bind(`${key}:${win}`, (win + 2) * windowSec).first<{ n: number }>();
  if (Math.random() < 0.02) {
    await env.DB.prepare("DELETE FROM rate_limits WHERE exp < ?").bind(Math.floor(Date.now() / 1000)).run();
  }
  return (row?.n ?? 1) <= limit;
}

export async function verifyTurnstile(env: Env, token: unknown, ip: string): Promise<boolean> {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    return ((await r.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}

export async function readJson(c: Context<HC>): Promise<Record<string, any> | null> {
  if (Number(c.req.header("content-length") ?? 0) > 8192) return null;
  const t = await c.req.text();
  if (t.length > 8192) return null;
  try {
    const v = JSON.parse(t);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// The origin the browser used (Vercel passes it in the forwarded headers).
function requestOrigin(c: Context<HC>): string {
  const h = (n: string) => c.req.header(n)?.split(",")[0].trim();
  const u = new URL(c.req.url);
  return `${h("x-forwarded-proto") ?? u.protocol.replace(":", "")}://${h("x-forwarded-host") ?? h("host") ?? u.host}`;
}

// Every state-changing request must come from this site's own origin.
export const originCheck = createMiddleware<HC>(async (c, next) => {
  // Payment webhooks come from the billing provider, not a browser. They are checked by signature instead.
  if (c.req.path === "/api/billing/webhook") return next();
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const o = c.req.header("Origin");
    if (!o || o !== requestOrigin(c)) return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

export const loadSession = createMiddleware<HC>(async (c, next) => {
  const sid = getCookie(c, COOKIE);
  if (sid && sid.length < 100) {
    const h = await hmacHash(c.env.SESSION_SECRET, sid);
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, s.csrf, s.via, s.created_at AS created FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id_hash = ? AND s.expires_at > ?`,
    ).bind(h, nowIso()).first<{ id: string; email: string; csrf: string; via: string; created: string }>();
    if (row) {
      c.set("user", { id: row.id, email: row.email });
      c.set("csrf", row.csrf);
      c.set("sidHash", h);
      c.set("via", row.via);
      c.set("sessionCreated", row.created);
    }
  }
  await next();
});

// Signed in, and for anything but GET, a matching CSRF token header.
export const guard = createMiddleware<HC>(async (c, next) => {
  if (!c.get("user")) return c.json({ error: "Not signed in" }, 401);
  if (c.req.method !== "GET") {
    const t = c.req.header("X-CSRF-Token") ?? "";
    if (!safeEqual(t, c.get("csrf") ?? "")) return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

export const isAdminEmail = (env: Env, email: string) =>
  email === env.ADMIN_EMAIL.trim().toLowerCase();

export const adminOnly = createMiddleware<HC>(async (c, next) => {
  const u = c.get("user");
  if (!u || !isAdminEmail(c.env, u.email)) return c.json({ error: "Forbidden" }, 403);
  await next();
});

// "Remember me" gives a 30 day cookie. Without it the cookie ends when the browser closes and the session lasts 12 hours.
export async function startSession(c: Context<HC>, userId: string, opts: { remember: boolean; via: "password" | "link" }) {
  const sid = randomToken();
  const now = Date.now();
  const ttl = opts.remember ? SESSION_DAYS * 864e5 : 12 * 36e5;
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO sessions (id_hash, user_id, csrf, expires_at, created_at, via) VALUES (?,?,?,?,?,?)")
      .bind(await hmacHash(c.env.SESSION_SECRET, sid), userId, randomToken(16),
        new Date(now + ttl).toISOString(), new Date(now).toISOString(), opts.via),
    c.env.DB.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(new Date(now).toISOString(), userId),
    c.env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(new Date(now).toISOString()),
  ]);
  setCookie(c, COOKIE, sid, {
    httpOnly: true, secure: true, sameSite: "Lax", path: "/", ...(opts.remember ? { maxAge: SESSION_DAYS * 86400 } : {}),
  });
}

export async function endSession(c: Context<HC>) {
  const sid = getCookie(c, COOKIE);
  if (sid) await c.env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await hmacHash(c.env.SESSION_SECRET, sid)).run();
  deleteCookie(c, COOKIE, { path: "/", secure: true });
}
