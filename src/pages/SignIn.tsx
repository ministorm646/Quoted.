import { useState, type FormEvent } from "react";
import Shell from "../components/Shell";
import Turnstile from "../components/Turnstile";
import { api, useConfig, usePageTitle } from "../api";

export default function SignIn() {
  usePageTitle("Sign in");
  const cfg = useConfig();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    const r = await api<{ message?: string; error?: string }>("/api/auth/request", { body: { email, turnstileToken: token } });
    setBusy(false);
    if (r.ok) return setMsg(r.data.message ?? "");
    setError(r.data?.error ?? "Something went wrong. Please try again.");
    setReset((n) => n + 1);
  }

  return (
    <Shell>
      <div className="hard-card p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-extrabold">Sign in</h1>
        {msg ? (
          <p role="status" className="mt-4">{msg} The link works once and expires in 15 minutes.</p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
            <label className="block">
              <span className="font-medium">Email</span>
              <input className="input input-bordered w-full mt-1" type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {cfg && <Turnstile siteKey={cfg.turnstileSiteKey} onToken={setToken} resetKey={reset} />}
            {error && <p role="alert" className="text-error font-medium">{error}</p>}
            <button className="btn btn-primary w-full text-base" disabled={busy || !token || !email}>
              {busy ? <span className="loading loading-spinner" /> : "Email me a sign-in link"}
            </button>
          </form>
        )}
      </div>
    </Shell>
  );
}
