import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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

export type Config = { name: string; turnstileSiteKey: string; contactEmail: string };
let cfgPromise: Promise<Config> | null = null;
export function useConfig(): Config | null {
  const [cfg, setCfg] = useState<Config | null>(null);
  useEffect(() => {
    cfgPromise ??= api<Config>("/api/config").then((r) => r.data);
    cfgPromise.then(setCfg).catch(() => setCfg(null));
  }, []);
  return cfg;
}

export type Me = {
  email: string; isAdmin: boolean; csrf: string;
  business: { name: string; replyTo: string; freeUntil: string; referralCode: string } | null;
};
// Loads the signed-in user, or sends the visitor to the sign-in page.
export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(null);
  const nav = useNavigate();
  useEffect(() => {
    api<Me>("/api/me").then((r) => {
      if (!r.ok) return nav("/signin", { replace: true });
      csrf = r.data.csrf;
      setMe(r.data);
    });
  }, [nav]);
  return me;
}
