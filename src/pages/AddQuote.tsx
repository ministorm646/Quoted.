import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import Icon from "../components/Icon";
import { api, usePageTitle } from "../api";
import { fmtDate } from "../lib";

function Form() {
  const nav = useNavigate();
  const [f, setF] = useState({ clientName: "", clientEmail: "", amount: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState(false);
  const [steps, setSteps] = useState<number[] | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  useEffect(() => { api<{ schedule: number[] }>("/api/settings").then((r) => r.ok && setSteps(r.data.schedule)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBilling(false); setBusy(true);
    const r = await api<{ id?: string; error?: string; unsubscribed?: boolean }>("/api/quotes", { body: f });
    setBusy(false);
    if (!r.ok) { setBilling(r.status === 402); return setError(r.data?.error ?? "Something went wrong. Please try again."); }
    nav(`/app/quotes/${r.data.id}`, { state: { justAdded: true, unsubscribed: r.data.unsubscribed } });
  }
  const day = (d: number) => fmtDate(new Date(Date.now() + d * 864e5).toISOString());

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] lg:gap-12">
      <form onSubmit={submit} className="space-y-4 pb-40 lg:pb-0" noValidate>
        <h1 className="text-2xl md:text-3xl font-extrabold">Add a quote</h1>
        <label className="block"><span className="font-medium">Client name</span>
          <input className="input input-bordered w-full mt-1" required maxLength={80} autoComplete="off" value={f.clientName} onChange={set("clientName")} /></label>
        <label className="block"><span className="font-medium">Client email</span>
          <input className="input input-bordered w-full mt-1" type="email" required autoComplete="off" inputMode="email" value={f.clientEmail} onChange={set("clientEmail")} /></label>
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <label className="block"><span className="font-medium">Amount (£)</span>
            <input className="input input-bordered w-full mt-1" required inputMode="decimal" placeholder="450" value={f.amount} onChange={set("amount")} /></label>
          <label className="block"><span className="font-medium">What is the job?</span>
            <input className="input input-bordered w-full mt-1" required maxLength={140} placeholder="Garden clearance and new fence panels" value={f.description} onChange={set("description")} /></label>
        </div>
        {error && <p role="alert" className="text-error font-medium">{error} {billing && <Link to="/app/billing" className="link">See plans</Link>}</p>}
        <div className="fixed inset-x-0 z-20 bottom-[calc(4rem+env(safe-area-inset-bottom))] bg-(--card) border-t-2 border-(--line) p-3 lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <button className="btn btn-primary w-full lg:w-auto lg:px-12 text-base" disabled={busy}>{busy ? <span className="loading loading-spinner" /> : "Save quote"}</button>
        </div>
      </form>

      <aside className="hidden lg:block space-y-5 self-start mt-12">
        <section className="panel p-5">
          <h2 className="font-bold text-lg">What happens next</h2>
          <ol className="mt-4 border-l-2 border-(--line) ml-2 space-y-4">
            <li className="pl-4 relative"><span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-(--accent) border-2 border-(--line)" /><p className="font-medium">Today</p><p className="text-sm">The quote is saved and shows as waiting for a reply.</p></li>
            {(steps ?? []).map((d, i) => (
              <li key={i} className="pl-4 relative"><span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-(--card) border-2 border-(--line)" />
                <p className="font-medium">{day(d)}</p><p className="text-sm">Follow-up {i + 1} goes out, if they haven't replied.</p></li>))}
          </ol>
          <p className="mt-4 text-sm">It all stops the moment they tap a button, or you mark the quote won, lost or paused. <Link to="/app/settings" className="link">Change the days</Link></p>
        </section>
        <section className="panel p-5">
          <h2 className="font-bold text-lg">Tips</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {["Use the email address the client wrote to you from.", "Keep the job to one line, such as \"Kitchen repaint\". It appears in the email.", "Only add people who asked you for a quote."].map((t) => (
              <li key={t} className="flex gap-2"><span className="mt-0.5 text-(--accent)"><Icon name="check" size={16} /></span>{t}</li>))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

export default function AddQuote() { usePageTitle("Add a quote"); return <AppShell><Form /></AppShell>; }
