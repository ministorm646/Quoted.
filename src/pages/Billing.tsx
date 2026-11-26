import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import { api, usePageTitle, type Access, type PlanInfo } from "../api";
import { money } from "../lib";

type B = {
  enabled: boolean; access: Access; founding: boolean; foundingPercent: number; plan: string | null; status: string; renews: string | null;
  plans: PlanInfo[]; hasPortal: boolean; canCheckout: boolean;
};
const gbp = (n: number) => money(Math.round(n * 100));

function View() {
  const [b, setB] = useState<B | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api<B>("/api/billing").then((r) => r.ok && setB(r.data)); }, []);
  if (!b) return <div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-40 w-full" /></div>;

  async function choose(plan: string) {
    setBusy(plan); setError("");
    const r = await api<{ url?: string; error?: string }>("/api/billing/checkout", { body: { plan } });
    if (r.ok && r.data.url) { window.location.href = r.data.url; return; }
    setBusy(""); setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  async function openPortal() {
    setBusy("portal"); setError("");
    const r = await api<{ url?: string; error?: string }>("/api/billing/portal", { body: {} });
    if (r.ok && r.data.url) { window.location.href = r.data.url; return; }
    setBusy(""); setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  const a = b.access;
  const head = a.state === "subscribed" ? `You're subscribed${b.plan ? ` (${b.plan})` : ""}`
    : a.state === "past_due" ? "Your last payment didn't go through"
    : a.state === "cancelled" ? "Your subscription is cancelled" : a.state === "expired" ? "Your free period has ended" : b.founding ? "You're on free early access" : "You're on your free trial";
  const detail = a.state === "subscribed" ? (b.renews ? `Renews on ${b.renews}.` : "")
    : a.state === "past_due" ? "Update your payment details to keep follow-ups running."
    : a.state === "cancelled" ? `You keep full access until ${a.until}.`
    : a.state === "expired" ? "Follow-ups are paused and you can't add new quotes. Everything you have is safe, and you can still view and download it."
    : `Free until ${a.until}${a.daysLeft !== null ? ` (${a.daysLeft} day${a.daysLeft === 1 ? "" : "s"} left)` : ""}.`;
  const monthly = b.plans.find((p) => p.id === "monthly"), annual = b.plans.find((p) => p.id === "annual");
  const save = monthly && annual ? Math.round((1 - annual.price / (monthly.price * 12)) * 100) : 0;
  const subscribed = a.state === "subscribed" || a.state === "past_due" || a.state === "cancelled";

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="hard-card p-6">
          <p className="font-medium">Plan and billing</p>
          <h1 className="text-3xl font-extrabold mt-1">{head}</h1>
          <p className="mt-2 text-lg">{detail}</p>
          {b.founding && <p className="mt-3"><span className="badge badge-success">Founding member</span> {b.foundingPercent > 0 && <span className="ml-1">{b.foundingPercent}% off while you stay subscribed.</span>}</p>}
          {!b.enabled && <p className="mt-4 text-sm">Paid plans haven't started yet. We will tell you well before anything changes, and you won't be charged without choosing a plan.</p>}
          {b.hasPortal && subscribed && <button className="btn btn-outline mt-5" onClick={openPortal} disabled={busy === "portal"}>Manage billing and invoices</button>}
          {error && subscribed && <p role="alert" className="mt-3 text-error font-medium">{error}</p>}
        </section>
        <aside className="panel p-5 self-start">
          <h2 className="font-bold text-lg">Every plan includes</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {["Automatic follow-ups in your name", "One-tap client replies", "Dashboard, search and CSV download", "Referral months for friends you bring"].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-0.5 text-(--accent-text)"><Icon name="check" size={16} /></span>{t}</li>))}
          </ul>
        </aside>
      </div>

      {b.enabled && b.plans.length > 0 && !(a.state === "subscribed") && (
        <section aria-label="Plans">
          <h2 className="text-2xl font-extrabold">{subscribed ? "Switch plan" : "Choose a plan"}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 max-w-3xl">
            {b.plans.map((p) => (
              <div key={p.id} className="hard-card p-6 flex flex-col">
                <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{p.label}</h3>{p.id === "annual" && save > 0 && <span className="badge badge-warning">Save {save}%</span>}</div>
                <p className="mt-3 font-display font-extrabold text-4xl">
                  <span className="hl">{gbp(p.foundingPrice ?? p.price)}</span><span className="text-base font-medium"> / {p.interval}</span>
                </p>
                {p.foundingPrice !== null && <p className="mt-1 text-sm"><s>{gbp(p.price)}</s> Founding-member price, {b.foundingPercent}% off</p>}
                <button className="btn btn-primary mt-5 text-base" disabled={!!busy || !b.canCheckout} onClick={() => choose(p.id)}>
                  {busy === p.id ? <span className="loading loading-spinner" /> : b.canCheckout ? `Choose ${p.label.toLowerCase()}` : "Payments are being set up"}
                </button>
              </div>))}
          </div>
          {error && <p role="alert" className="mt-3 text-error font-medium">{error}</p>}
          <p className="mt-4 text-sm max-w-3xl">Payments are handled by our payment provider, who send your receipts. You can cancel any time from "Manage billing".</p>
        </section>
      )}
    </div>
  );
}

export default function Billing() { usePageTitle("Plan and billing"); return <AppShell><View /></AppShell>; }
