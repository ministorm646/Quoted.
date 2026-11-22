import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import { api, usePageTitle } from "../api";

export default function Verify() {
  usePageTitle("Signing in");
  const [sp] = useSearchParams();
  // Keep only the token characters, so stray text copied after the link is ignored.
  const token = (sp.get("token") ?? "").match(/^[A-Za-z0-9_-]+/)?.[0] ?? "";
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true); setError("");
    const r = await api<{ error?: string; needsPassword?: boolean }>("/api/auth/verify", { body: { token } });
    setBusy(false);
    if (r.ok) return nav(r.data.needsPassword ? "/app/password" : "/app", { replace: true });
    setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  return (
    <Shell>
      <div className="hard-card p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-extrabold">Finish signing in</h1>
        <p className="mt-3">Tap the button to sign in on this device.</p>
        {error && <p role="alert" className="mt-3 text-error font-medium">{error} <Link className="link" to="/signin">Get a new link</Link></p>}
        <button className="btn btn-primary w-full mt-5 text-base" onClick={go} disabled={busy || !token}>
          {busy ? <span className="loading loading-spinner" /> : "Sign in"}
        </button>
      </div>
    </Shell>
  );
}
