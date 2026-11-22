import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { api, useMe, usePageTitle } from "../api";

type Item = { id: string; email: string; status: string; createdAt: string; businessName: string; trade: string; chat: boolean };
type Data = { items: Item[]; seats: { used: number; cap: number } };
type Tab = "pending" | "approved" | "rejected";

export default function Admin() {
  usePageTitle("Early access requests");
  const me = useMe();
  const nav = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");
  const [tab, setTab] = useState<Tab>("pending");

  const load = useCallback(async () => {
    const r = await api<Data>("/api/admin/waitlist");
    if (r.status === 403) return nav("/app", { replace: true });
    if (r.ok) setData(r.data);
  }, [nav]);
  useEffect(() => { if (me) load(); }, [me, load]);

  async function act(id: string, what: "approve" | "reject") {
    setBusyId(id); setNote("");
    const r = await api<any>(`/api/admin/waitlist/${id}/${what}`, { method: "POST", body: {} });
    setBusyId("");
    if (!r.ok) setNote(r.data?.error ?? "That did not work.");
    else if (what === "approve") setNote(r.data.dryRun ? "Approved. Test mode is on, so the invite was logged, not emailed." : r.data.emailed ? "Approved. Invite sent." : "Approved, but the invite email failed to send. Check the Resend settings.");
    load();
  }

  const nav2 = <><Link to="/admin/stats" className="btn btn-sm btn-outline">Stats</Link><Link to="/app" className="btn btn-sm btn-ghost">Back to app</Link></>;
  if (!me || !data) return <Shell nav={nav2}><span className="loading loading-spinner loading-lg" aria-label="Loading" /></Shell>;
  const count = (t: Tab) => data.items.filter((i) => i.status === t).length;
  const rows = data.items.filter((i) => i.status === tab);
  const badge = (s: string) => (s === "approved" ? "badge-success" : s === "rejected" ? "badge-neutral" : "badge-warning");
  const full = data.seats.used >= data.seats.cap;

  return (
    <Shell nav={nav2}>
      <h1 className="text-2xl md:text-3xl font-extrabold">Early-access requests</h1>
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="hard-card p-4 col-span-2 md:col-span-1"><p className="text-sm font-medium">Seats used</p><p className="font-display font-extrabold text-3xl mt-1"><span className="hl">{data.seats.used} of {data.seats.cap}</span></p>{full && <p className="text-sm mt-1">Full. Raise SEAT_CAP to approve more.</p>}</div>
        {(["pending", "approved", "rejected"] as Tab[]).map((t) => <div key={t} className="panel p-4"><p className="text-sm font-medium capitalize">{t === "pending" ? "Waiting" : t}</p><p className="font-display font-extrabold text-3xl mt-1">{count(t)}</p></div>)}
      </div>
      {note && <p role="status" className="mt-4 font-medium">{note}</p>}

      <div role="tablist" className="tabs tabs-border mt-6">
        {(["pending", "approved", "rejected"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`tab h-12 ${tab === t ? "tab-active font-bold" : ""}`}>{t === "pending" ? "Waiting" : t[0].toUpperCase() + t.slice(1)} ({count(t)})</button>))}
      </div>

      {rows.length === 0 ? <p className="mt-6 panel p-6 text-center">{tab === "pending" ? "No requests waiting. New ones show up here." : "Nothing here yet."}</p> : (
        <>
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_130px_220px] gap-4 px-4 mt-4 text-sm font-medium opacity-80" aria-hidden="true"><span>Email</span><span>Business</span><span>Asked on</span><span /></div>
          <ul className="mt-2 space-y-3">
            {rows.map((i) => (
              <li key={i.id} className="panel p-4 grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_130px_220px] items-center gap-x-4 gap-y-2">
                <p className="font-bold break-all">{i.email}</p>
                <p className="text-sm">{[i.businessName, i.trade, i.chat ? "happy to chat" : ""].filter(Boolean).join(", ") || "No extra details"}</p>
                <p className="text-sm">{new Date(i.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <span className={`badge ${badge(i.status)}`}>{i.status}</span>
                  {i.status !== "approved" && <button className="btn btn-primary btn-sm" disabled={busyId === i.id} onClick={() => act(i.id, "approve")}>Approve</button>}
                  {i.status === "pending" && <button className="btn btn-outline btn-sm" disabled={busyId === i.id} onClick={() => act(i.id, "reject")}>Reject</button>}
                </div>
              </li>))}
          </ul>
        </>)}
    </Shell>
  );
}
