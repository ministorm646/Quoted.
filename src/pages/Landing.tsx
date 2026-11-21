import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import Turnstile from "../components/Turnstile";
import { api, useConfig } from "../api";

const TRADES = [
  ["cleaning", "Cleaner"], ["building", "Builder"], ["landscaping", "Landscaper"],
  ["removals", "Removals"], ["agency", "Small agency"], ["other", "Something else"],
];

export default function Landing() {
  const cfg = useConfig();
  const [sp] = useSearchParams();
  const ref = sp.get("ref") ?? "";
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [trade, setTrade] = useState("");
  const [chat, setChat] = useState(false);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    const r = await api("/api/waitlist", {
      body: { email, businessName: business, trade, chat, ref, turnstileToken: token },
    });
    setBusy(false);
    if (r.ok) return setDone(true);
    setError(r.data?.error ?? "Something went wrong. Please try again.");
    setReset((n) => n + 1);
  }

  return (
    <Shell>
      <section className="grid gap-10 md:grid-cols-2 md:items-start">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
            Quotes go quiet. <span className="hl">The work shouldn't.</span>
          </h1>
          <p className="mt-5 text-lg max-w-prose">
            Log a quote in about ten seconds. We send polite follow-ups in your name until the customer
            replies, and you see what is still waiting and what you have won.
          </p>
          <p className="mt-4 max-w-prose">
            Early access is limited to a small group of UK trades and service businesses. It is free for
            the first three months.
          </p>
        </div>

        <div className="hard-card p-6">
          {done ? (
            <div role="status">
              <h2 className="text-2xl font-bold">You're on the list</h2>
              <p className="mt-2">
                We will only email you if you are approved. Until then, you won't hear from us.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              <h2 className="text-2xl font-bold">Ask for early access</h2>
              <label className="block">
                <span className="font-medium">Email</span>
                <input className="input input-bordered w-full mt-1" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label className="block">
                <span className="font-medium">Business name (optional)</span>
                <input className="input input-bordered w-full mt-1" maxLength={80} autoComplete="organization"
                  value={business} onChange={(e) => setBusiness(e.target.value)} />
              </label>
              <label className="block">
                <span className="font-medium">What do you do?</span>
                <select className="select select-bordered w-full mt-1" value={trade} onChange={(e) => setTrade(e.target.value)}>
                  <option value="">Choose one</option>
                  {TRADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="checkbox mt-1" checked={chat} onChange={(e) => setChat(e.target.checked)} />
                <span>I'm happy to have a 15-minute chat about how it works for me.</span>
              </label>
              {cfg && <Turnstile siteKey={cfg.turnstileSiteKey} onToken={setToken} resetKey={reset} />}
              {error && <p role="alert" className="text-error font-medium">{error}</p>}
              <button className="btn btn-primary w-full text-base" disabled={busy || !token || !email}>
                {busy ? <span className="loading loading-spinner" /> : "Ask for a place"}
              </button>
              <p className="text-sm">We only use your email to send your invite and sign-in links.</p>
            </form>
          )}
        </div>
      </section>
    </Shell>
  );
}
