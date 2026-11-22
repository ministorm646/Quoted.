import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Shell from "../components/Shell";
import { api, usePageTitle } from "../api";

const COPY: Record<string, { label: string; thanks: (b: string) => string }> = {
  yes: { label: "Yes, go ahead", thanks: (b) => `Thank you. ${b} has been told and will be in touch.` },
  question: { label: "I have a question", thanks: (b) => `Thanks. ${b} has been told you have a question and will get back to you. You can also just reply to their email.` },
  no: { label: "Not interested", thanks: (b) => `No problem. ${b} has been told, and you won't get any more emails about this quote.` },
};

// Email buttons only open this page. Nothing changes until the client taps Confirm.
export default function Respond() {
  usePageTitle("Your reply");
  const { token = "", action = "" } = useParams();
  const copy = COPY[action];
  const [info, setInfo] = useState<{ business: string; job: string } | null>(null);
  const [bad, setBad] = useState(!copy);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!copy) return;
    api<{ business: string; job: string }>(`/api/respond/${encodeURIComponent(token)}`).then((r) => (r.ok ? setInfo(r.data) : setBad(true)));
  }, [token, copy]);

  async function confirm() {
    setBusy(true); setError("");
    const r = await api<{ error?: string }>(`/api/respond/${encodeURIComponent(token)}`, { body: { action } });
    setBusy(false);
    if (r.ok) setDone(true); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  return (
    <Shell nav={<></>}>
      <div className="hard-card p-6 max-w-md mx-auto">
        {bad ? (
          <><h1 className="text-2xl font-extrabold">This link isn't valid</h1><p className="mt-3">It may have been copied incorrectly. Try the button in the email again.</p></>
        ) : !info ? (
          <div className="space-y-3"><div className="skeleton h-8 w-2/3" /><div className="skeleton h-12 w-full" /></div>
        ) : done ? (
          <div role="status"><h1 className="text-2xl font-extrabold">Thank you</h1><p className="mt-3">{copy.thanks(info.business)}</p></div>
        ) : (
          <>
            <p className="text-sm">{info.business}</p>
            <h1 className="text-2xl font-extrabold mt-1">{copy.label}?</h1>
            <p className="mt-3">About: {info.job}</p>
            {error && <p role="alert" className="mt-3 text-error font-medium">{error}</p>}
            <button className="btn btn-primary w-full mt-5 text-base" onClick={confirm} disabled={busy}>
              {busy ? <span className="loading loading-spinner" /> : "Confirm"}
            </button>
          </>
        )}
      </div>
    </Shell>
  );
}
