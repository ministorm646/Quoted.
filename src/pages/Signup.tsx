import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import Turnstile from "../components/Turnstile";
import Icon from "../components/Icon";
import { api, useConfig, usePageTitle } from "../api";
import { money } from "../lib";

export default function Signup() {
  usePageTitle("Start your free trial");
  const cfg = useConfig();
  const [sp] = useSearchParams();
  const ref = sp.get("ref") ?? "";
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [agree, setAgree] = useState(false);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const days = cfg?.trialDays ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    const r = await api<{ message?: string; error?: string }>("/api/signup", { body: { email, businessName: business, agree, ref, turnstileToken: token } });
    setBusy(false);
    if (r.ok) return setMsg(r.data.message ?? "");
    setError(r.data?.error ?? "Something went wrong. Please try again."); setReset((n) => n + 1);
  }

  if (cfg && !cfg.launched) return (
    <Shell><div className="hard-card p-6 max-w-md mx-auto"><h1 className="text-2xl font-extrabold">Not open yet</h1>
      <p className="mt-3">Sign-up isn't open yet, but you can ask for early access.</p><Link to="/#access" className="btn btn-primary mt-5">Ask for early access</Link></div></Shell>
  );

  return (
    <Shell wide>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-14 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold leading-tight">{days > 0 ? <>Start your <span className="hl">{days}-day free trial</span></> : <>Get started with <span className="hl">{cfg?.name ?? "Quoted"}.</span></>}</h1>
          <p className="mt-4 text-lg max-w-prose">Log a quote in seconds. We follow it up in your name until the customer replies.</p>
          <ul className="mt-6 space-y-3 max-w-md">
            {[days > 0 ? "No card needed to start" : "Choose a plan once you are in", "Follow-ups in your own words, on the days you choose", "One-tap replies, and your dashboard updates itself", "Cancel any time"].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-(--accent) text-(--accent-content)"><Icon name="check" size={14} /></span><span>{t}</span></li>))}
          </ul>
          {cfg && cfg.billing.plans.length > 0 && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 max-w-md">
              {cfg.billing.plans.map((p) => <div key={p.id} className="panel p-4"><p className="text-sm font-medium">{p.label}</p><p className="font-display font-extrabold text-2xl mt-1">{money(Math.round(p.price * 100))}<span className="text-sm font-medium"> / {p.interval}</span></p></div>)}
            </div>)}
        </div>

        <div className="hard-card p-6 w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          {msg ? (
            <div role="status"><h2 className="text-2xl font-extrabold">Check your email</h2><p className="mt-3">{msg} The link works once and lasts 60 minutes. Then you can set a password.</p></div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <h2 className="text-2xl font-extrabold">Create your account</h2>
              <label className="block"><span className="font-medium">Email</span>
                <input className="input input-bordered w-full mt-1" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              <label className="block"><span className="font-medium">Business name</span>
                <input className="input input-bordered w-full mt-1" maxLength={80} autoComplete="organization" value={business} onChange={(e) => setBusiness(e.target.value)} /></label>
              <label className="flex items-start gap-3 cursor-pointer text-sm">
                <input type="checkbox" className="checkbox mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>I agree to the <Link className="link" to="/terms" target="_blank">terms</Link> and have read the <Link className="link" to="/privacy" target="_blank">privacy notice</Link>.</span></label>
              {cfg && <Turnstile siteKey={cfg.turnstileSiteKey} onToken={setToken} resetKey={reset} />}
              {error && <p role="alert" className="text-error font-medium">{error}</p>}
              <button className="btn btn-primary w-full text-base" disabled={busy || !token || !email || !agree}>{busy ? <span className="loading loading-spinner" /> : days > 0 ? "Start free trial" : "Create account"}</button>
              <p className="text-sm">Already have an account? <Link className="link" to="/signin">Sign in</Link></p>
            </form>)}
        </div>
      </div>
    </Shell>
  );
}
