import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Shell from "../components/Shell";
import { api } from "../api";

export default function Unsubscribe() {
  const { token = "" } = useParams();
  const [business, setBusiness] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ business: string }>(`/api/unsub/${encodeURIComponent(token)}`).then((r) => (r.ok ? setBusiness(r.data.business) : setBad(true)));
  }, [token]);

  async function confirm() {
    setBusy(true); setError("");
    const r = await api<{ error?: string }>(`/api/unsub/${encodeURIComponent(token)}`, { body: {} });
    setBusy(false);
    if (r.ok) setDone(true); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  return (
    <Shell nav={<></>}>
      <div className="hard-card p-6 max-w-md mx-auto">
        {bad ? (
          <><h1 className="text-2xl font-extrabold">This link isn't valid</h1><p className="mt-3">It may have been copied incorrectly.</p></>
        ) : business === null ? (
          <div className="space-y-3"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-12 w-full" /></div>
        ) : done ? (
          <div role="status"><h1 className="text-2xl font-extrabold">You're unsubscribed</h1><p className="mt-3">You won't get any more follow-up emails from us, from {business} or from any other business using this service.</p></div>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold">Stop these emails?</h1>
            <p className="mt-3">This stops all follow-up emails to you, from {business} and from any other business using this service.</p>
            {error && <p role="alert" className="mt-3 text-error font-medium">{error}</p>}
            <button className="btn btn-primary w-full mt-5 text-base" onClick={confirm} disabled={busy}>
              {busy ? <span className="loading loading-spinner" /> : "Unsubscribe me"}
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}
