import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { HC } from "./types.js";
import {
  endSession, guard, hit, isAdminEmail, loadSession, originCheck, readJson, startSession, verifyTurnstile,
} from "./lib/security.js";
import { hmacHash, safeEqual } from "./lib/crypto.js";
import { cleanEmail, cleanText, clientIp, nowIso } from "./lib/util.js";
import { createUserWithBusiness, makeLoginToken } from "./lib/accounts.js";
import { sendEmail, signInEmail } from "./lib/email.js";
import { newId } from "./lib/crypto.js";
import { admin } from "./admin.js";
import { pub } from "./public.js";
import { runScheduler } from "./scheduler.js";
import { REFERRAL_CAP } from "./referrals.js";
import { toCsv } from "./lib/csv.js";
import { billing } from "./billingRoutes.js";
import { accessInfo, foundingPercent, plans } from "./billing.js";
import { checkPassword, hashPassword, verifyPassword } from "./lib/password.js";
import { quotes } from "./quotes.js";
import { settings, account } from "./settings.js";

const TRADES = ["cleaning", "building", "landscaping", "removals", "plumbing", "electrical", "roofing", "decorating", "handyman", "agency", "other"];
const NEUTRAL = "If you have access, we've emailed you a link.";

const app = new Hono<HC>();
app.use("*", secureHeaders());
app.use("*", async (c, next) => { await next(); c.header("Cache-Control", "no-store"); });
app.use("*", originCheck, loadSession);

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/config", (c) =>
  c.json({ name: c.env.PRODUCT_NAME, turnstileSiteKey: c.env.TURNSTILE_SITE_KEY, contactEmail: c.env.SUPPORT_EMAIL,
    company: { name: c.env.COMPANY_NAME, number: c.env.COMPANY_NUMBER, address: c.env.COMPANY_ADDRESS },
    billing: { enabled: c.env.BILLING_ENABLED === "true", foundingPercent: foundingPercent(c.env), plans: plans(c.env, false) } }));

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
  if (!b || typeof b.token !== "string" || b.token.length > 1000) return c.json({ error: "Invalid request" }, 400);
  if (!(await hit(c.env, `av:${clientIp(c)}`, 20, 900))) return c.json({ error: "Too many requests." }, 429);
  // Keep only the token characters, so extra text copied after the link is ignored.
  const token = b.token.match(/^[A-Za-z0-9_-]+/)?.[0] ?? "";
  const hash = await hmacHash(c.env.SESSION_SECRET, token);
  const now = nowIso();
  const row = await c.env.DB.prepare(
    `UPDATE login_tokens SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
     RETURNING user_id`,
  ).bind(now, hash, now).first<{ user_id: string }>();
  if (!row) {
    // Say why (this only describes a token the visitor already holds) and log it for debugging.
    const t = await c.env.DB.prepare("SELECT used_at, expires_at FROM login_tokens WHERE token_hash = ?")
      .bind(hash).first<{ used_at: string | null; expires_at: string }>();
    const why = !t ? "not found" : t.used_at ? "already used" : "expired";
    console.log(`verify failed: ${why} (token length ${token.length}, expected 43)`);
    const msg = !t ? "This link looks incomplete or has been changed. Copy the whole link with nothing extra, or ask for a new one."
      : t.used_at ? "This link has already been used. Ask for a new one." : "This link has expired. Ask for a new one.";
    return c.json({ error: msg }, 400);
  }
  await startSession(c, row.user_id, { remember: true, via: "link" });
  const u = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(row.user_id).first<{ password_hash: string | null }>();
  return c.json({ ok: true, needsPassword: !u?.password_hash });
});

app.post("/api/auth/logout", guard, async (c) => { await endSession(c); return c.json({ ok: true }); });

const MODES = ["light", "dark", "system"];
const ACCENTS = ["forest", "ocean", "sunset", "berry", "violet", "graphite"];

// Sign in with email and password. "Remember me" keeps the session for 30 days.
app.post("/api/auth/login", async (c) => {
  const b = await readJson(c);
  if (!b) return c.json({ error: "Invalid request" }, 400);
  const ip = clientIp(c);
  const email = cleanEmail(b.email);
  const password = typeof b.password === "string" ? b.password : "";
  if (!email || !password || password.length > 200) return c.json({ error: "Enter your email and password." }, 400);
  const key = await hmacHash(c.env.SESSION_SECRET, email);
  if (!(await hit(c.env, `lg-ip:${ip}`, 20, 900)) || !(await hit(c.env, `lg-em:${key}`, 8, 900))) {
    return c.json({ error: "Too many attempts. Wait 15 minutes, or email yourself a sign-in link instead." }, 429);
  }
  if (!(await verifyTurnstile(c.env, b.turnstileToken, ip))) return c.json({ error: "Please complete the check and try again." }, 400);
  const u = await c.env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?").bind(email).first<{ id: string; password_hash: string | null }>();
  const ok = await verifyPassword(password, u?.password_hash ?? null);
  if (!u || !ok) {
    return c.json({ error: "That email and password don't match. If you haven't set a password yet, email yourself a sign-in link instead." }, 401);
  }
  await startSession(c, u.id, { remember: b.remember === true, via: "password" });
  return c.json({ ok: true });
});

// Set or change the password. Changing needs the current one, unless you signed in by email link in the last 30 minutes
// (that is how a forgotten password is reset). Other devices are signed out afterwards.
app.post("/api/password", guard, async (c) => {
  const user = c.get("user")!;
  const b = await readJson(c);
  if (!b) return c.json({ error: "Invalid request" }, 400);
  if (!(await hit(c.env, `pw:${user.id}`, 10, 3600))) return c.json({ error: "Too many tries. Try again later." }, 429);
  const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(user.id).first<{ password_hash: string | null }>();
  const recentLink = c.get("via") === "link" && Date.now() - Date.parse(c.get("sessionCreated") ?? "") < 30 * 60e3;
  if (row?.password_hash && !recentLink && !(await verifyPassword(String(b.current ?? ""), row.password_hash))) {
    return c.json({ error: "Your current password is not right." }, 403);
  }
  const password = String(b.password ?? "");
  const problem = checkPassword(password, user.email);
  if (problem) return c.json({ error: problem }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ?, password_set_at = ? WHERE id = ?").bind(await hashPassword(password), nowIso(), user.id),
    c.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND id_hash != ?").bind(user.id, c.get("sidHash") ?? ""),
  ]);
  return c.json({ ok: true });
});

// Appearance (colour and light/dark) follows the person to any device.
app.put("/api/prefs", guard, async (c) => {
  const b = await readJson(c);
  if (!b || !MODES.includes(b.mode) || !ACCENTS.includes(b.accent)) return c.json({ error: "Invalid choice" }, 400);
  await c.env.DB.prepare("UPDATE users SET prefs = ? WHERE id = ?").bind(JSON.stringify({ mode: b.mode, accent: b.accent }), c.get("user")!.id).run();
  return c.json({ ok: true });
});

app.get("/api/me", guard, async (c) => {
  const u = c.get("user")!;
  const biz = await c.env.DB.prepare(
    `SELECT name, reply_to AS replyTo, free_until AS freeUntil, referral_code AS referralCode, founding,
            plan, sub_status AS subStatus, sub_renews_at AS subRenewsAt FROM businesses WHERE user_id = ?`,
  ).bind(u.id).first<any>();
  const row = await c.env.DB.prepare("SELECT password_hash, prefs FROM users WHERE id = ?").bind(u.id).first<{ password_hash: string | null; prefs: string | null }>();
  let prefs: { mode: string; accent: string } | null = null;
  try { prefs = row?.prefs ? JSON.parse(row.prefs) : null; } catch { /* ignore */ }
  const enforced = c.env.BILLING_ENABLED === "true";
  const access = biz ? accessInfo({ free_until: biz.freeUntil, sub_status: biz.subStatus, sub_renews_at: biz.subRenewsAt, plan: biz.plan, founding: biz.founding }, enforced) : null;
  return c.json({
    email: u.email, isAdmin: isAdminEmail(c.env, u.email), csrf: c.get("csrf"),
    hasPassword: !!row?.password_hash,
    canResetPassword: c.get("via") === "link" && Date.now() - Date.parse(c.get("sessionCreated") ?? "") < 30 * 60e3,
    prefs, access,
    business: biz && { name: biz.name, replyTo: biz.replyTo, freeUntil: biz.freeUntil, referralCode: biz.referralCode, founding: biz.founding === 1 },
  });
});

// Called by Vercel Cron or an outside timer. Needs: Authorization: Bearer <CRON_SECRET>
app.get("/api/cron", async (c) => {
  if (!c.env.CRON_SECRET) return c.json({ error: "Cron is not set up. Add CRON_SECRET." }, 503);
  const given = (c.req.header("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!safeEqual(given, c.env.CRON_SECRET)) return c.json({ error: "Forbidden" }, 403);
  return c.json({ ok: true, ...(await runScheduler(c.env)) });
});

app.get("/api/referrals", guard, async (c) => {
  const b = await c.env.DB.prepare("SELECT id, referral_code AS code, free_until AS freeUntil FROM businesses WHERE user_id = ?")
    .bind(c.get("user")!.id).first<{ id: string; code: string; freeUntil: string }>();
  if (!b) return c.json({ error: "No business found" }, 404);
  const n = (await c.env.DB.prepare("SELECT COUNT(*) AS n FROM referrals WHERE referrer_business_id = ?").bind(b.id).first<{ n: number }>())?.n ?? 0;
  return c.json({ code: b.code, link: `${c.env.APP_URL}/?ref=${b.code}`, credited: n, cap: REFERRAL_CAP, freeUntil: b.freeUntil });
});

// Everything the signed-in business has logged, as a spreadsheet they can keep.
app.get("/api/export.csv", guard, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT q.client_name, q.client_email, q.amount_pence, q.description, q.status, q.followups_sent, q.created_at
     FROM quotes q JOIN businesses b ON b.id = q.business_id WHERE b.user_id = ? ORDER BY q.created_at DESC`,
  ).bind(c.get("user")!.id).all<Record<string, unknown>>();
  const rows: unknown[][] = [["Client", "Client email", "Amount (GBP)", "Job", "Status", "Follow-ups sent", "Logged at"],
    ...results.map((r) => [r.client_name, r.client_email, (Number(r.amount_pence) / 100).toFixed(2), r.description, r.status, r.followups_sent, r.created_at])];
  return c.body(toCsv(rows), 200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="quotes.csv"' });
});

app.get("/robots.txt", (c) => c.text(
  `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /admin\nDisallow: /api/\nDisallow: /r/\nDisallow: /u/\nDisallow: /verify\n\nSitemap: ${c.env.APP_URL}/sitemap.xml\n`));
app.get("/sitemap.xml", (c) => c.body(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${["/", "/privacy", "/terms", "/contact"].map((p) => `  <url><loc>${c.env.APP_URL}${p}</loc></url>`).join("\n")}\n</urlset>\n`,
  200, { "Content-Type": "application/xml; charset=utf-8" }));

app.route("/api", pub);
app.route("/api/billing", billing);
app.route("/api/admin", admin);
app.route("/api/quotes", quotes);
app.route("/api/settings", settings);
app.route("/api/account", account);
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
app.onError((e, c) => { console.error(e); return c.json({ error: "Something went wrong." }, 500); });

export default app;
