import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import { api } from "../api";

export default function Verify() {
  const [sp] = useSearchParams();
  const token = sp.get("token") ?? "";
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function go() {
    setBusy(true); setError("");
    const r = await api<{ error?: string }>("/api/auth/verify", { body: { token } });
    setBusy(false);
    if (r.ok) return nav("/app", { replace: true });
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
