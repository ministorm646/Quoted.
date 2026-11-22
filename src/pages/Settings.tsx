import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import AppearancePicker from "../components/AppearancePicker";
import { api, usePageTitle, type Me } from "../api";

type S = { name: string; replyTo: string; schedule: number[]; template: string; defaultTemplate: string };

const Section = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <section className="panel p-5"><h2 className="text-xl font-bold">{title}</h2>{hint && <p className="mt-1 text-sm">{hint}</p>}<div className="mt-4">{children}</div></section>
);

function Form({ me }: { me: Me }) {
  const nav = useNavigate();
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => { api<S>("/api/settings").then((r) => r.ok && setS(r.data)); }, []);
  if (!s) return <div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-64 w-full" /></div>;

  const preview = (s.template || s.defaultTemplate).replaceAll("[client]", "Sam").replaceAll("[job]", "the kitchen repaint");
  const setDay = (i: number, v: string) => setS({ ...s, schedule: s.schedule.map((d, j) => (j === i ? Number(v) || 0 : d)) });

  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(""); setError(""); setBusy(true);
    const r = await api<{ error?: string }>("/api/settings", { method: "PUT", body: { name: s!.name, replyTo: s!.replyTo, schedule: s!.schedule, template: s!.template } });
    setBusy(false);
    if (r.ok) setMsg("Saved."); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }
  async function deleteAccount() {
    const r = await api<{ error?: string }>("/api/account", { method: "DELETE", body: { confirm } });
    if (r.ok) nav("/", { replace: true }); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  return (
    <>
      <h1 className="text-2xl md:text-3xl font-extrabold mb-5">Settings</h1>
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          <form onSubmit={save} noValidate className="space-y-6">
            <Section title="Your business" hint="This is how you appear to your clients.">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="font-medium">Business name</span>
                  <input className="input input-bordered w-full mt-1" maxLength={80} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
                <label className="block"><span className="font-medium">Reply-to email</span>
                  <input className="input input-bordered w-full mt-1" type="email" value={s.replyTo} onChange={(e) => setS({ ...s, replyTo: e.target.value })} />
                  <span className="text-sm">Client replies come here.</span></label>
              </div>
            </Section>

            <Section title="Follow-ups" hint="Send a follow-up this many days after you log the quote. Each day must be later than the one before.">
              <div className="flex flex-wrap items-center gap-2">
                {s.schedule.map((d, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <input aria-label={`Follow-up ${i + 1} day`} className="input input-bordered w-20" inputMode="numeric" value={d || ""} onChange={(e) => setDay(i, e.target.value)} />
                    {s.schedule.length > 1 && <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove follow-up ${i + 1}`} onClick={() => setS({ ...s, schedule: s.schedule.filter((_, j) => j !== i) })}>Remove</button>}
                  </div>))}
                {s.schedule.length < 5 && <button type="button" className="btn btn-outline btn-sm" onClick={() => setS({ ...s, schedule: [...s.schedule, (s.schedule.at(-1) ?? 0) + 7] })}>Add a follow-up</button>}
              </div>
              <label className="block mt-5"><span className="font-medium">Your message</span>
                <textarea className="textarea textarea-bordered w-full mt-1 h-40" maxLength={1000} placeholder={s.defaultTemplate} value={s.template} onChange={(e) => setS({ ...s, template: e.target.value })} />
                <span className="text-sm">Use [client] and [job] to fill in the name and the job. Leave blank to use our wording.</span></label>
            </Section>

            {error && <p role="alert" className="text-error font-medium">{error}</p>}
            {msg && <p role="status" className="font-medium">{msg}</p>}
            <button className="btn btn-primary text-base" disabled={busy}>{busy ? <span className="loading loading-spinner" /> : "Save settings"}</button>
          </form>

          <Section title="Your data" hint="Download every quote you have logged as a spreadsheet.">
            <a className="btn btn-outline" href="/api/export.csv" download>Download my quotes (CSV)</a>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Appearance" hint="Pick the look you like. It follows you to any device you sign in on."><AppearancePicker /></Section>

          <Section title="Sign-in and security">
            <p>{me.hasPassword ? "You sign in with your email and password." : "You don't have a password yet. You can sign in by email link, or set a password."}</p>
            <Link to="/app/password" className="btn btn-outline mt-3">{me.hasPassword ? "Change password" : "Set a password"}</Link>
          </Section>

          <Section title="How your client's email looks">
            <div className="hard-card p-5">
              <p className="text-sm">From: {s.name || "Your business"}</p>
              <p className="font-bold mt-1">Following up: the kitchen repaint</p>
              <p className="mt-4 whitespace-pre-wrap">{preview}</p>
              <div className="mt-4 flex flex-col gap-2">
                <span className="btn btn-primary pointer-events-none">Yes, go ahead</span>
                <span className="btn btn-outline pointer-events-none">I have a question</span>
                <span className="btn btn-ghost pointer-events-none">Not interested</span>
              </div>
              <p className="text-sm mt-4">Kind regards, {s.name || "Your business"}</p>
            </div>
          </Section>

          <section className="border-2 border-error rounded-xl p-5" aria-label="Delete account">
            <h2 className="text-xl font-bold">Delete my account and data</h2>
            <p className="mt-2 text-sm">This permanently removes your business, quotes and history, and stops all follow-ups. Type {me.email} to confirm.</p>
            <input className="input input-bordered w-full mt-3" aria-label="Type your email to confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <button className="btn btn-error mt-3" disabled={confirm.trim().toLowerCase() !== me.email} onClick={deleteAccount}>Delete everything</button>
          </section>
        </div>
      </div>
    </>
  );
}

export default function Settings() { usePageTitle("Settings"); return <AppShell>{(me) => <Form me={me} />}</AppShell>; }
