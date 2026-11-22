import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api, type Me, usePageTitle } from "../api";

type S = { name: string; replyTo: string; schedule: number[]; template: string; defaultTemplate: string };

function Form({ me }: { me: Me }) {
  const nav = useNavigate();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => { api<S>("/api/settings").then((r) => r.ok && setS(r.data)); }, []);
  if (!s) return <div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-64 w-full" /></div>;

  const text = s.template || s.defaultTemplate;
  const preview = text.replaceAll("[client]", "Sam").replaceAll("[job]", "the kitchen repaint");
  const setDay = (i: number, v: string) => setS({ ...s, schedule: s.schedule.map((d, j) => (j === i ? Number(v) || 0 : d)) });

  async function save(e: FormEvent) {
    e.preventDefault();
    setMsg(""); setError(""); setBusy(true);
    const r = await api<{ error?: string }>("/api/settings", { method: "PUT", body: { name: s!.name, replyTo: s!.replyTo, schedule: s!.schedule, template: s!.template } });
    setBusy(false);
    if (r.ok) setMsg("Saved."); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  async function deleteAccount() {
    const r = await api<{ error?: string }>("/api/account", { method: "DELETE", body: { confirm } });
    if (r.ok) nav("/", { replace: true }); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-start">
      <form onSubmit={save} className="space-y-4" noValidate>
        <h1 className="text-3xl font-extrabold">Settings</h1>
        <label className="block"><span className="font-medium">Business name</span>
          <input className="input input-bordered w-full mt-1" maxLength={80} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
        <label className="block"><span className="font-medium">Reply-to email</span>
          <input className="input input-bordered w-full mt-1" type="email" value={s.replyTo} onChange={(e) => setS({ ...s, replyTo: e.target.value })} />
          <span className="text-sm">Client replies come to this address.</span></label>

        <fieldset>
          <legend className="font-medium">Send a follow-up this many days after the quote</legend>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {s.schedule.map((d, i) => (
              <div key={i} className="flex items-center gap-1">
                <input aria-label={`Follow-up ${i + 1} day`} className="input input-bordered w-20" inputMode="numeric" value={d || ""} onChange={(e) => setDay(i, e.target.value)} />
                {s.schedule.length > 1 && <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove follow-up ${i + 1}`} onClick={() => setS({ ...s, schedule: s.schedule.filter((_, j) => j !== i) })}>Remove</button>}
              </div>
            ))}
            {s.schedule.length < 5 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setS({ ...s, schedule: [...s.schedule, (s.schedule.at(-1) ?? 0) + 7] })}>Add a follow-up</button>}
          </div>
          <p className="text-sm mt-1">Each day must be later than the one before.</p>
        </fieldset>

        <label className="block"><span className="font-medium">Your message</span>
          <textarea className="textarea textarea-bordered w-full mt-1 h-44" maxLength={1000} placeholder={s.defaultTemplate} value={s.template} onChange={(e) => setS({ ...s, template: e.target.value })} />
          <span className="text-sm">Use [client] and [job] to fill in the client's name and the job. Leave blank to use our wording.</span></label>

        {error && <p role="alert" className="text-error font-medium">{error}</p>}
        {msg && <p role="status" className="font-medium">{msg}</p>}
        <button className="btn btn-primary text-base" disabled={busy}>{busy ? <span className="loading loading-spinner" /> : "Save settings"}</button>
      </form>

      <div className="space-y-8">
        <section aria-label="Email preview">
          <h2 className="text-xl font-bold mb-3">How it looks to your client</h2>
          <div className="hard-card p-5">
            <p className="text-sm">From: {s.name || "Your business"}</p>
            <p className="font-bold mt-1">Following up on your quote</p>
            <p className="mt-4 whitespace-pre-wrap">{preview}</p>
            <div className="mt-4 flex flex-col gap-2">
              <span className="btn btn-primary pointer-events-none">Yes, go ahead</span>
              <span className="btn btn-outline pointer-events-none">I have a question</span>
              <span className="btn btn-ghost pointer-events-none">Not interested</span>
            </div>
            <p className="text-sm mt-4">Kind regards, {s.name || "Your business"}</p>
          </div>
        </section>

        <section aria-label="Your data">
          <h2 className="text-xl font-bold">Your data</h2>
          <p className="mt-2 text-sm">Download every quote you have logged as a spreadsheet.</p>
          <a className="btn btn-outline mt-3" href="/api/export.csv" download>Download my quotes (CSV)</a>
        </section>

        <section className="border-2 border-error rounded-xl p-5" aria-label="Delete account">
          <h2 className="text-xl font-bold">Delete my account and data</h2>
          <p className="mt-2 text-sm">This permanently removes your business, quotes and history, and stops all follow-ups. Type {me.email} to confirm.</p>
          <input className="input input-bordered w-full mt-3" aria-label="Type your email to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn btn-error mt-3" disabled={confirm.trim().toLowerCase() !== me.email} onClick={deleteAccount}>Delete everything</button>
        </section>
      </div>
    </div>
  );
}

export default function Settings() {
  usePageTitle("Settings"); return <AppShell>{(me) => <Form me={me} />}</AppShell>; }
