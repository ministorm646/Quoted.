import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { asAppearance, setAppearance } from "./theme";

let csrf = "";

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}) {
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrf;
  const res = await fetch(path, {
    method, headers, credentials: "same-origin",
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, data: data as T };
}

export type Config = {
  name: string; turnstileSiteKey: string; contactEmail: string;
  company: { name: string; number: string; address: string };
  launched: boolean; trialDays: number;
  billing: { enabled: boolean; foundingPercent: number; plans: PlanInfo[] };
};
let cfgPromise: Promise<Config> | null = null;
export function useConfig(): Config | null {
  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => {
    cfgPromise ??= api<Config>("/api/config").then((r) => r.data);
    cfgPromise.then(setCfg).catch(() => setCfg(null));
  }, []);
  return cfg;
}

export type PlanInfo = { id: "monthly" | "annual"; label: string; interval: string; price: number; foundingPrice: number | null };
export type Access = { state: "free" | "subscribed" | "past_due" | "cancelled" | "expired"; allowed: boolean; enforced: boolean; daysLeft: number | null; until: string | null };
export type Me = {
  hasPassword: boolean; canResetPassword: boolean; prefs: { mode: string; accent: string } | null; access: Access | null;
  email: string; isAdmin: boolean; csrf: string;
  business: { name: string; replyTo: string; freeUntil: string; referralCode: string; founding: boolean } | null;
};
// Loads the signed-in user, or sends the visitor to the sign-in page.
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  const nav = useNavigate();
  useEffect(() => {
    api<Me>("/api/me").then((r) => {
      if (!r.ok) return nav("/signin", { replace: true });
      csrf = r.data.csrf;
      const saved = asAppearance(r.data.prefs);
      if (saved) setAppearance(saved);
      setMe(r.data);
    });
  }, [nav]);
  return me;
}

// Sets the browser tab title, e.g. "Privacy | Quoted.".
export function usePageTitle(title: string) {
  const cfg = useConfig();
  useEffect(() => { document.title = `${title} | ${cfg?.name ?? "Quoted"}.`; }, [title, cfg]);
}
