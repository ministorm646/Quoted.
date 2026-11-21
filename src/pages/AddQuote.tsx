import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { api } from "../api";

function Form() {
  const nav = useNavigate();
  const [f, setF] = useState({ clientName: "", clientEmail: "", amount: "", description: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    const r = await api<{ id?: string; error?: string; unsubscribed?: boolean }>("/api/quotes", { body: f });
    setBusy(false);
    if (!r.ok) return setError(r.data?.error ?? "Something went wrong. Please try again.");
    nav(`/app/quotes/${r.data.id}`, { state: { justAdded: true, unsubscribed: r.data.unsubscribed } });
  }

  return (
    <form onSubmit={submit} className="max-w-lg space-y-4 pb-28 md:pb-0" noValidate>
      <h1 className="text-3xl font-extrabold">Add a quote</h1>
      <label className="block"><span className="font-medium">Client name</span>
        <input className="input input-bordered w-full mt-1" required maxLength={80} autoComplete="off" value={f.clientName} onChange={set("clientName")} /></label>
      <label className="block"><span className="font-medium">Client email</span>
        <input className="input input-bordered w-full mt-1" type="email" required autoComplete="off" inputMode="email" value={f.clientEmail} onChange={set("clientEmail")} /></label>
      <label className="block"><span className="font-medium">Quote amount (£)</span>
        <input className="input input-bordered w-full mt-1" required inputMode="decimal" placeholder="450" value={f.amount} onChange={set("amount")} /></label>
      <label className="block"><span className="font-medium">What is the job?</span>
        <input className="input input-bordered w-full mt-1" required maxLength={140} placeholder="Garden clearance and new fence panels" value={f.description} onChange={set("description")} /></label>
      {error && <p role="alert" className="text-error font-medium">{error}</p>}
      <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t-2 border-[#10231c] p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <button className="btn btn-primary w-full md:w-auto md:px-10 text-base" disabled={busy}>
          {busy ? <span className="loading loading-spinner" /> : "Save quote"}
        </button>
      </div>
    </form>
  );
}

export default function AddQuote() { return <AppShell><Form /></AppShell>; }
