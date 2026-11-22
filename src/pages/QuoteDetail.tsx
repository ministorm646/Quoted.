import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/AppShell";
import StatusBadge from "../components/StatusBadge";
import Celebrate from "../components/Celebrate";
import { api, usePageTitle } from "../api";
import { EVENT_LABEL, fmtDate, fmtDateTime, money, type QuoteRow } from "../lib";

type Detail = { quote: QuoteRow & { clientEmail: string }; events: { type: string; createdAt: string }[]; unsubscribed: boolean };
const OPEN = ["waiting", "following_up", "paused", "question", "accepted"];

function View() {
  const { id } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const added = (loc.state as { justAdded?: boolean } | null)?.justAdded;
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);
  const editDlg = useRef<HTMLDialogElement>(null);
  const [edit, setEdit] = useState({ clientName: "", clientEmail: "", amount: "", description: "" });
  const [editError, setEditError] = useState("");
  const done = useCallback(() => setParty(false), []);
  const [note, setNote] = useState("");
  async function sendTest() {
    setBusy(true); setNote(""); setError("");
    const r = await api<{ to?: string; dryRun?: boolean; error?: string }>(`/api/quotes/${id}/test`, { method: "POST", body: {} });
    setBusy(false);
    if (!r.ok) return setError(r.data?.error ?? "That didn't work. Please try again.");
    setNote(r.data.dryRun ? "Test mode is on, so the email was logged instead of sent. Your site settings say where to find it." : `Sent to ${r.data.to}. Open it and tap a button to see what your client sees. Tapping a button changes this quote.`);
  }

  const load = useCallback(async () => {
    const r = await api<Detail>(`/api/quotes/${id}`);
    if (r.ok) setD(r.data); else setError(r.data && (r.data as any).error || "Quote not found.");
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(path: string, method = "POST") {
    setBusy(true); setError("");
    const r = await api<{ error?: string }>(`/api/quotes/${id}${path}`, { method, body: {} });
    setBusy(false);
    if (!r.ok) return setError(r.data?.error ?? "That didn't work. Please try again.");
    if (method === "DELETE") return nav("/app", { replace: true });
    if (path === "/won") setParty(true);
    load();
  }

  if (error && !d) return <p role="alert" className="font-medium">{error} <Link className="link" to="/app">Back to your quotes</Link></p>;
  if (!d) return <div className="space-y-4"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-40 w-full" /></div>;
  const q = d.quote;
  const open = OPEN.includes(q.status);
  const openEdit = () => {
    setEdit({ clientName: q.clientName, clientEmail: q.clientEmail, amount: String(q.amountPence / 100), description: q.description });
    setEditError(""); editDlg.current?.showModal();
  };
  async function saveEdit() {
    setBusy(true); setEditError("");
    const r = await api<{ error?: string }>(`/api/quotes/${id}`, { method: "PUT", body: edit });
    setBusy(false);
    if (!r.ok) return setEditError(r.data?.error ?? "That didn't work. Please try again.");
    editDlg.current?.close(); load();
  }

  return (
    <>
      {party && <Celebrate onDone={done} />}
      <Link to="/app" className="link text-sm">All quotes</Link>
      <div className="hard-card p-5 mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold break-words">{q.clientName}</h1>
            <p className="break-all">{q.clientEmail}</p>
          </div>
          <p className="font-display font-extrabold text-2xl whitespace-nowrap">{money(q.amountPence)}</p>
        </div>
        <p className="mt-3">{q.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge status={q.status} />
          {q.nextFollowupAt && <span className="text-sm">Next follow-up: {fmtDate(q.nextFollowupAt)}</span>}
        </div>
      </div>

      {added && <p role="status" className="mt-4 font-medium">Saved. We'll follow this one up for you.</p>}
      {d.unsubscribed && <p role="status" className="mt-4 font-medium">This person has unsubscribed from emails, so no follow-ups will be sent.</p>}
      {note && <p role="status" className="mt-4 font-medium">{note}</p>}
      {error && <p role="alert" className="mt-4 text-error font-medium">{error}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {open && <button className="btn btn-primary" disabled={busy} onClick={() => act("/won")}>Mark as won</button>}
        {open && <button className="btn btn-outline" disabled={busy} onClick={() => act("/lost")}>Mark as lost</button>}
        {["waiting", "following_up"].includes(q.status) && <button className="btn btn-outline" disabled={busy} onClick={() => act("/pause")}>Pause follow-ups</button>}
        {q.status === "paused" && <button className="btn btn-outline" disabled={busy} onClick={() => act("/resume")}>Resume follow-ups</button>}
        <button className="btn btn-outline" disabled={busy} onClick={openEdit}>Edit details</button>
        <button className="btn btn-outline" disabled={busy} onClick={sendTest}>Email me a test</button>
        <button className="btn btn-ghost text-error" disabled={busy} onClick={() => dlg.current?.showModal()}>Delete</button>
      </div>

      <h2 className="text-xl font-bold mt-8">What has happened</h2>
      <ol className="mt-3 border-l-2 border-[#10231c] ml-2 space-y-4">
        {d.events.map((e, i) => (
          <li key={i} className="pl-4 relative">
            <span className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-[#0e7a55] border-2 border-[#10231c]" />
            <p className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</p>
            <p className="text-sm">{fmtDateTime(e.createdAt)}</p>
          </li>
        ))}
      </ol>

      <dialog ref={editDlg} className="modal">
        <div className="modal-box border-2 border-[#10231c]">
          <h3 className="font-bold text-lg">Edit details</h3>
          <div className="mt-3 space-y-3">
            <label className="block"><span className="font-medium">Client name</span><input className="input input-bordered w-full mt-1" maxLength={80} value={edit.clientName} onChange={(e) => setEdit({ ...edit, clientName: e.target.value })} /></label>
            <label className="block"><span className="font-medium">Client email</span><input className="input input-bordered w-full mt-1" type="email" value={edit.clientEmail} onChange={(e) => setEdit({ ...edit, clientEmail: e.target.value })} /></label>
            <label className="block"><span className="font-medium">Amount (£)</span><input className="input input-bordered w-full mt-1" inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></label>
            <label className="block"><span className="font-medium">Job</span><input className="input input-bordered w-full mt-1" maxLength={140} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
          </div>
          {editError && <p role="alert" className="mt-3 text-error font-medium">{editError}</p>}
          <div className="modal-action">
            <button className="btn" onClick={() => editDlg.current?.close()}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={saveEdit}>Save changes</button>
          </div>
        </div>
      </dialog>

      <dialog ref={dlg} className="modal">
        <div className="modal-box border-2 border-[#10231c]">
          <h3 className="font-bold text-lg">Delete this quote?</h3>
          <p className="py-3">This removes it and its history. Follow-ups will stop. You can't undo this.</p>
          <div className="modal-action">
            <button className="btn" onClick={() => dlg.current?.close()}>Keep it</button>
            <button className="btn btn-error" onClick={() => { dlg.current?.close(); act("", "DELETE"); }}>Delete quote</button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export default function QuoteDetail() {
  usePageTitle("Quote"); return <AppShell><View /></AppShell>; }
