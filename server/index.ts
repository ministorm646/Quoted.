import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { HC } from "./types.js";
import {
  endSession, guard, hit, isAdminEmail, loadSession, originCheck, readJson, startSession, verifyTurnstile,
} from "./lib/security.js";
import { hmacHash } from "./lib/crypto.js";
import { cleanEmail, cleanText, clientIp, nowIso } from "./lib/util.js";
import { createUserWithBusiness, makeLoginToken } from "./lib/accounts.js";
import { sendEmail, signInEmail } from "./lib/email.js";
import { newId } from "./lib/crypto.js";
import { admin } from "./admin.js";
import { quotes } from "./quotes.js";
import { settings, account } from "./settings.js";

const TRADES = ["cleaning", "building", "landscaping", "removals", "agency", "other"];
const NEUTRAL = "If you have access, we've emailed you a link.";

const app = new Hono<HC>();
app.use("*", secureHeaders());
app.use("*", async (c, next) => { await next(); c.header("Cache-Control", "no-store"); });
app.use("*", originCheck, loadSession);

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/config", (c) =>
  c.json({ name: c.env.PRODUCT_NAME, turnstileSiteKey: c.env.TURNSTILE_SITE_KEY }));

// Early-access request. Always answers the same way, so nobody can probe the list.
app.post("/api/waitlist", async (c) => {
  const b = await readJson(c);
  if (!b) return c.json({ error: "Invalid request" }, 400);
  const ip = clientIp(c);
  if (!(await hit(c.env, `wl:${ip}`, 5, 3600))) return c.json({ error: "Too many requests. Try again later." }, 429);
  const email = cleanEmail(b.email);
  if (!email) return c.json({ error: "Enter a valid email address." }, 400);
  if (!(await verifyTurnstile(c.env, b.turnstileToken, ip))) {
    return c.json({ error: "Please complete the check and try again." }, 400);
  }
  const answers = {
    businessName: cleanText(b.businessName, 80),
    trade: TRADES.includes(b.trade) ? b.trade : "",
    chat: b.chat === true,
  };
  const ref = typeof b.ref === "string" && /^[A-Za-z0-9]{6,16}$/.test(b.ref) ? b.ref.toUpperCase() : null;
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO waitlist (id, email, answers, ref, status, created_at) VALUES (?,?,?,?, 'pending', ?)",
  ).bind(newId(), email, JSON.stringify(answers), ref, nowIso()).run();
  return c.json({ ok: true });
});

// Ask for a sign-in link. Same answer whether or not the email is approved.
app.post("/api/auth/request", async (c) => {
  const b = await readJson(c);
  if (!b) return c.json({ error: "Invalid request" }, 400);
  const ip = clientIp(c);
  const email = cleanEmail(b.email);
  if (!email) return c.json({ error: "Enter a valid email address." }, 400);
  const emailKey = await hmacHash(c.env.SESSION_SECRET, email);
  if (!(await hit(c.env, `ar-ip:${ip}`, 8, 900)) || !(await hit(c.env, `ar-em:${emailKey}`, 3, 900))) {
    return c.json({ error: "Too many requests. Try again in a few minutes." }, 429);
  }
  if (!(await verifyTurnstile(c.env, b.turnstileToken, ip))) {
    return c.json({ error: "Please complete the check and try again." }, 400);
  }
  let user = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  // The admin email can always sign in, which creates the first account.
  if (!user && isAdminEmail(c.env, email)) user = await createUserWithBusiness(c.env, email, "Admin", null);
  if (user) {
    const uid = user.id;
    c.executionCtx.waitUntil((async () => {
      const token = await makeLoginToken(c.env, uid, "login", 15 * 60);
      await sendEmail(c.env, signInEmail(c.env, email, token, false));
    })());
  }
  return c.json({ ok: true, message: NEUTRAL });
});

// The email link opens a page with a button. Only that POST uses up the token,
// so mail scanners that open links cannot burn it.
app.post("/api/auth/verify", async (c) => {
  const b = await readJson(c);
  if (!b || typeof b.token !== "string" || b.token.length > 100) return c.json({ error: "Invalid request" }, 400);
  if (!(await hit(c.env, `av:${clientIp(c)}`, 20, 900))) return c.json({ error: "Too many requests." }, 429);
  const now = nowIso();
  const row = await c.env.DB.prepare(
    `UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
     RETURNING user_id`,
  ).bind(now, await hmacHash(c.env.SESSION_SECRET, b.token), now).first<{ user_id: string }>();
  if (!row) return c.json({ error: "This link has expired or was already used. Ask for a new one." }, 400);
  await startSession(c, row.user_id);
  return c.json({ ok: true });
});

app.post("/api/auth/logout", guard, async (c) => { await endSession(c); return c.json({ ok: true }); });

app.get("/api/me", guard, async (c) => {
  const u = c.get("user")!;
  const business = await c.env.DB.prepare(
    "SELECT name, reply_to AS replyTo, free_until AS freeUntil, referral_code AS referralCode FROM businesses WHERE user_id = ?",
  ).bind(u.id).first();
  return c.json({ email: u.email, isAdmin: isAdminEmail(c.env, u.email), csrf: c.get("csrf"), business });
});

app.route("/api/admin", admin);
app.route("/api/quotes", quotes);
app.route("/api/settings", settings);
app.route("/api/account", account);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.onError((e, c) => { console.error(e); return c.json({ error: "Something went wrong." }, 500); });

export default app;
