import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { api, useMe } from "../api";

type Item = { id: string; email: string; status: string; createdAt: string; businessName: string; trade: string; chat: boolean };
type Data = { items: Item[]; seats: { used: number; cap: number } };

export default function Admin() {
  const me = useMe();
  const nav = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState("");

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
    else if (what === "approve") setNote(r.data.dryRun ? "Approved. Dry run is on, so the invite was logged, not emailed." : r.data.emailed ? "Approved. Invite sent." : "Approved, but the invite email failed to send. Check the Resend settings.");
    load();
  }

  if (!me || !data) return <Shell><span className="loading loading-spinner loading-lg" aria-label="Loading" /></Shell>;
  const badge = (s: string) => s === "approved" ? "badge-success" : s === "rejected" ? "badge-neutral" : "badge-warning";

  return (
    <Shell nav={<Link to="/app" className="btn btn-sm btn-outline">Back to app</Link>}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Early-access requests</h1>
        <p className="font-bold">Seats used: <span className="hl">{data.seats.used} of {data.seats.cap}</span></p>
      </div>
      {note && <p role="status" className="mt-4 font-medium">{note}</p>}
      {data.items.length === 0 && <p className="mt-6">No requests yet. They will show up here.</p>}
      <ul className="mt-6 space-y-3">
        {data.items.map((i) => (
          <li key={i.id} className="hard-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold break-all">{i.email}</p>
              <p className="text-sm">{[i.businessName, i.trade, i.chat ? "happy to chat" : ""].filter(Boolean).join(", ") || "No extra details"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${badge(i.status)}`}>{i.status}</span>
              {i.status !== "approved" && (
                <button className="btn btn-primary btn-sm" disabled={busyId === i.id} onClick={() => act(i.id, "approve")}>Approve</button>
              )}
              {i.status === "pending" && (
                <button className="btn btn-outline btn-sm" disabled={busyId === i.id} onClick={() => act(i.id, "reject")}>Reject</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
