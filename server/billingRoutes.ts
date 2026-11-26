import { Hono } from "hono";
import type { HC } from "./types.js";
import { guard, hit, readJson } from "./lib/security.js";
import { billingOn, isLaunched } from "./launch.js";
import { accessInfo, applyBillingEvent, checkoutUrl, foundingPercent, plans, verifySignature } from "./billing.js";

export const billing = new Hono<HC>();

// Called by the billing provider. Not a browser request, so it is checked by its signature.
billing.post("/webhook", async (c) => {
  const raw = await c.req.text();
  if (raw.length > 200_000) return c.json({ error: "Too large" }, 413);
  if (!(await verifySignature(c.env.LS_WEBHOOK_SECRET, raw, c.req.header("X-Signature")))) return c.json({ error: "Bad signature" }, 400);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return c.json({ error: "Bad body" }, 400); }
  const r = await applyBillingEvent(c.env.DB, c.env, payload);
  console.log(`billing webhook: ${r.applied ? "applied" : "skipped"}${r.reason ? ` (${r.reason})` : ""}`);
  return c.json({ ok: true }); // always 200 for a valid signature, so the provider does not keep retrying
});

async function mine(c: any) {
  return c.env.DB.prepare(
    `SELECT id, free_until, sub_status, sub_renews_at, plan, founding, portal_url FROM businesses WHERE user_id = ?`,
  ).bind(c.get("user")!.id).first();
}

billing.get("/", guard, async (c) => {
  const b = await mine(c);
  if (!b) return c.json({ error: "No business found" }, 404);
  const founding = b.founding === 1;
  const on = await billingOn(c.env);
  return c.json({
    enabled: on, launched: await isLaunched(c.env.DB),
    access: accessInfo(b, on),
    founding, foundingPercent: founding ? foundingPercent(c.env) : 0,
    plan: b.plan, status: b.sub_status, renews: b.sub_renews_at?.slice(0, 10) ?? null,
    plans: plans(c.env, founding), portalUrl: b.portal_url ?? null,
    canCheckout: !!(c.env.LS_CHECKOUT_MONTHLY || c.env.LS_CHECKOUT_ANNUAL),
  });
});

billing.post("/checkout", guard, async (c) => {
  const user = c.get("user")!;
  const body = await readJson(c);
  if (!(await hit(c.env, `co:${user.id}`, 20, 3600))) return c.json({ error: "Too many tries. Try again later." }, 429);
  const b = await mine(c);
  if (!b) return c.json({ error: "No business found" }, 404);
  const url = checkoutUrl(c.env, String(body?.plan ?? ""), user.email, b.id, b.founding === 1);
  return url ? c.json({ url }) : c.json({ error: "Payments are not switched on yet." }, 503);
});
