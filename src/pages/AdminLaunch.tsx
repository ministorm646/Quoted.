import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import Icon from "../components/Icon";
import { api, useMe, usePageTitle } from "../api";

type Check = { key: string; label: string; ok: boolean; required: boolean; hint: string };
type D = {
  launched: boolean; launchedAt: string | null; checks: Check[]; ready: boolean;
  counts: { total: number; founding: number; foundingFree: number; subscribers: number; emailsPending: number; waitlistPending: number };
};

export default function AdminLaunch() {
  usePageTitle("Launch");
  const me = useMe();
  const nav = useNavigate();
  const [d, setD] = useState<D | null>(null);
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await api<D>("/api/admin/launch");
    if (r.status === 403) return nav("/app", { replace: true });
    if (r.ok) setD(r.data);
  }, [nav]);
  useEffect(() => { if (me) load(); }, [me, load]);

  async function call(path: string, body: unknown, done: (data: any) => string) {
    setBusy(true); setNote(""); setError("");
    const r = await api<any>(path, { body });
    setBusy(false);
    if (r.ok) { setNote(done(r.data)); setWord(""); load(); }
    else setError(r.data?.failing ? `${r.data.error} Still to do: ${r.data.failing.join("; ")}.` : r.data?.error ?? "That didn't work.");
  }

  const links = <><Link to="/admin" className="btn btn-sm btn-outline">Requests</Link><Link to="/admin/stats" className="btn btn-sm btn-outline">Stats</Link><Link to="/app" className="btn btn-sm btn-ghost">Back to app</Link></>;
  if (!me || !d) return <Shell nav={links}><span className="loading loading-spinner loading-lg" aria-label="Loading" /></Shell>;
  const c = d.counts;
  const Tile = ({ label, value }: { label: string; value: number }) => <div className="panel p-4"><p className="text-sm font-medium">{label}</p><p className="font-display font-extrabold text-3xl mt-1">{value}</p></div>;

  return (
    <Shell nav={links}>
      <h1 className="text-2xl md:text-3xl font-extrabold">Launch</h1>

      <section className={`mt-4 p-5 ${d.launched ? "hard-card" : "panel"}`} aria-label="Status">
        <p className="font-medium">Right now</p>
        <p className="font-display font-extrabold text-2xl md:text-3xl mt-1"><span className="hl">{d.launched ? "Launched. Early access is closed." : "Early access is open."}</span></p>
        <p className="mt-2">{d.launched
          ? `Launched on ${d.launchedAt ? new Date(d.launchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "an earlier date"}. Anyone can sign up for a free trial, and everyone subscribes when their free period ends.`
          : "Invite-only and free. Nobody is asked to pay yet."}</p>
      </section>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Founding members" value={c.founding} /><Tile label="Still in free period" value={c.foundingFree} />
        <Tile label="Subscribers" value={c.subscribers} /><Tile label="Requests waiting" value={c.waitlistPending} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <section className="panel p-5" aria-label="Checklist">
          <h2 className="text-xl font-bold">Is everything ready?</h2>
          <ul className="mt-3 divide-y-2 divide-(--line-soft)">
            {d.checks.map((k) => (
              <li key={k.key} className="py-3 flex gap-3">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${k.ok ? "bg-success text-success-content" : "border-2 border-(--line)"}`}>{k.ok ? <Icon name="check" size={14} /> : <span className="text-xs font-bold">!</span>}</span>
                <div><p className="font-medium">{k.label} {!k.ok && <span className={`badge badge-sm ${k.required ? "badge-error" : "badge-warning"}`}>{k.required ? "Needed" : "Advised"}</span>}</p>
                  {!k.ok && <p className="text-sm mt-0.5">{k.hint}</p>}</div>
              </li>))}
          </ul>
          <p className="mt-3 text-sm">Settings are changed in Vercel, under Environment Variables. Reload this page after you redeploy.</p>
        </section>

        <div className="space-y-6">
          {!d.launched ? (
            <section className="hard-card p-5" aria-label="Launch">
              <h2 className="text-xl font-bold">Launch</h2>
              <p className="mt-2 text-sm">When you press the button:</p>
              <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                <li>Early access closes. The request form is replaced by a free-trial sign-up.</li>
                <li>Founding members keep their free period, then get their discount when they subscribe.</li>
                <li>New customers get a free trial, then pay the full price.</li>
                <li>Businesses whose free period has ended can't add quotes or be followed up until they subscribe.</li>
              </ul>
              <p className="mt-3 text-sm">You can undo it later, and nothing is deleted.</p>
              <label className="block mt-4"><span className="font-medium">Type LAUNCH to confirm</span>
                <input className="input input-bordered w-full mt-1" value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" /></label>
              <button className="btn btn-primary w-full mt-3 text-base" disabled={busy || word !== "LAUNCH" || !d.ready} onClick={() => call("/api/admin/launch", { confirm: "LAUNCH" }, () => "Launched. Now tell your founding members below.")}>
                {busy ? <span className="loading loading-spinner" /> : "Close early access and launch"}
              </button>
              {!d.ready && <p className="mt-2 text-sm text-error font-medium">Finish the items marked "Needed" first.</p>}
            </section>
          ) : (
            <>
              <section className="hard-card p-5" aria-label="Founding members">
                <h2 className="text-xl font-bold">Tell your founding members</h2>
                <p className="mt-2 text-sm">Emails them that early access has ended, when their free period finishes, and their founding discount. Each person is emailed once.</p>
                <p className="mt-3 font-display text-2xl font-extrabold"><span className="hl">{c.emailsPending}</span> still to email</p>
                <button className="btn btn-primary mt-3" disabled={busy || c.emailsPending === 0} onClick={() => call("/api/admin/launch/emails", {}, (r) => `Sent ${r.sent}. ${r.remaining} to go.${r.dryRun ? ` ${r.dryRun} were test-mode only and not counted.` : ""}${r.failed ? ` ${r.failed} failed and will be retried.` : ""}`)}>
                  {busy ? <span className="loading loading-spinner" /> : c.emailsPending === 0 ? "Everyone has been told" : "Send the next 25"}
                </button>
              </section>
              <section className="border-2 border-error rounded-xl p-5" aria-label="Reopen">
                <h2 className="text-xl font-bold">Reopen early access</h2>
                <p className="mt-2 text-sm">Closes sign-up, turns the paywall off and reopens the request form. Accounts already created stay as they are.</p>
                <label className="block mt-3"><span className="font-medium">Type REOPEN to confirm</span>
                  <input className="input input-bordered w-full mt-1" value={word} onChange={(e) => setWord(e.target.value)} autoCapitalize="characters" /></label>
                <button className="btn btn-error mt-3" disabled={busy || word !== "REOPEN"} onClick={() => call("/api/admin/reopen", { confirm: "REOPEN" }, () => "Early access is open again.")}>Reopen early access</button>
              </section>
            </>)}
          {note && <p role="status" className="font-medium">{note}</p>}
          {error && <p role="alert" className="text-error font-medium">{error}</p>}
        </div>
      </div>
    </Shell>
  );
}
