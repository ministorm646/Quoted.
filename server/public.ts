import { Hono } from "hono";
import type { HC } from "./types.js";
import { hit, readJson } from "./lib/security.js";
import { clientIp } from "./lib/util.js";
import { sendEmail } from "./lib/email.js";
import { applyResponse, applyUnsubscribe, lookupToken, ownerNotice } from "./respond.js";

// Pages a client reaches from an email link. No sign-in: the long random token is the key.
export const pub = new Hono<HC>();
pub.use("*", async (c, next) => {
  if (!(await hit(c.env, `pub:${clientIp(c)}`, 40, 900))) return c.json({ error: "Too many requests. Try again later." }, 429);
  await next();
});

pub.get("/respond/:token", async (c) => {
  const q = await lookupToken(c.env.DB, c.req.param("token"));
  return q ? c.json({ business: q.business_name, job: q.description, status: q.status }) : c.json({ error: "This link is not valid." }, 404);
});

pub.post("/respond/:token", async (c) => {
  const b = await readJson(c);
  const r = await applyResponse(c.env.DB, c.req.param("token"), String(b?.action ?? ""));
  if (!r.found) return c.json({ error: "This link is not valid." }, 404);
  if (r.applied) c.executionCtx.waitUntil(sendEmail(c.env, ownerNotice(c.env, r.q, r.label)).then(() => undefined));
  return c.json({ ok: true, business: r.q.business_name });
});

pub.get("/unsub/:token", async (c) => {
  const q = await lookupToken(c.env.DB, c.req.param("token"));
  return q ? c.json({ business: q.business_name }) : c.json({ error: "This link is not valid." }, 404);
});

pub.post("/unsub/:token", async (c) => {
  const r = await applyUnsubscribe(c.env.DB, c.req.param("token"));
  return r.found ? c.json({ ok: true }) : c.json({ error: "This link is not valid." }, 404);
});
