import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import { api, useMe, usePageTitle } from "../api";
import { money } from "../lib";

type S = {
  signupsPerWeek: { week: string; signups: number }[];
  waitlist: { pending: number; approved: number; rejected: number };
  users: { approved: number; active: number; threePlus: number };
  emails: { sent: number; testMode: number };
  wonAfterFollowUp: { count: number; pence: number };
  weekThree: { eligible: number; active: number };
  subscriptions: { active: number; founding: number; standard: number; pastDue: number; cancelled: number; estMonthlyPence: number };
};

const Card = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="hard-card p-4"><p className="text-sm font-medium">{label}</p><p className="font-display font-extrabold text-3xl mt-1">{value}</p>{sub && <p className="text-sm mt-1">{sub}</p>}</div>
);

export default function AdminStats() {
  usePageTitle("Stats");
  const me = useMe();
  const nav = useNavigate();
  const [s, setS] = useState<S | null>(null);
  useEffect(() => {
    if (!me) return;
    api<S>("/api/admin/stats").then((r) => (r.status === 403 ? nav("/app", { replace: true }) : r.ok && setS(r.data)));
  }, [me, nav]);

  const shell = (c: React.ReactNode) => <Shell nav={<><Link to="/admin" className="btn btn-sm btn-outline">Requests</Link><Link to="/admin/launch" className="btn btn-sm btn-outline">Launch</Link><Link to="/app" className="btn btn-sm btn-ghost">Back to app</Link></>}>{c}</Shell>;
  if (!s) return shell(<span className="loading loading-spinner loading-lg" aria-label="Loading" />);
  const max = Math.max(1, ...s.signupsPerWeek.map((w) => w.signups));
  const w3 = s.weekThree.eligible ? `${Math.round((s.weekThree.active / s.weekThree.eligible) * 100)}%` : "Not yet";

  return shell(
    <>
      <h1 className="text-3xl font-extrabold">Stats</h1>
      <p className="mt-1 text-sm">Totals only. No client names or emails are shown here.</p>

      <h2 className="text-xl font-bold mt-6">Signups per week</h2>
      <ul className="mt-3 space-y-2" aria-label="Signups per week">
        {s.signupsPerWeek.map((w) => (
          <li key={w.week} className="flex items-center gap-3">
            <span className="w-24 text-sm shrink-0">w/c {w.week.slice(5)}</span>
            <span className="h-6 bg-(--accent) border-2 border-(--line) rounded" style={{ width: `${(w.signups / max) * 100}%`, minWidth: w.signups ? 8 : 0 }} />
            <span className="font-bold">{w.signups}</span>
          </li>))}
      </ul>

      <h2 className="text-xl font-bold mt-8">People</h2>
      <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card label="Approved" value={s.users.approved} sub={`${s.waitlist.pending} waiting for a decision`} />
        <Card label="Active (logged a quote)" value={s.users.active} sub={`of ${s.users.approved} approved`} />
        <Card label="3 or more quotes" value={s.users.threePlus} />
        <Card label="Active in week 3" value={w3} sub={`${s.weekThree.active} of ${s.weekThree.eligible} who joined 3+ weeks ago`} />
      </div>

      <h2 className="text-xl font-bold mt-8">Subscriptions</h2>
      <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card label="Subscribers" value={s.subscriptions.active} sub={`${s.subscriptions.founding} founding, ${s.subscriptions.standard} standard`} />
        <Card label="Estimated monthly income" value={money(s.subscriptions.estMonthlyPence)} sub="From plan prices, before fees" />
        <Card label="Payment overdue" value={s.subscriptions.pastDue} />
        <Card label="Cancelled (still paid up)" value={s.subscriptions.cancelled} />
      </div>

      <h2 className="text-xl font-bold mt-8">Results</h2>
      <div className="mt-3 grid gap-3 grid-cols-2 md:grid-cols-3">
        <Card label="Emails sent" value={s.emails.sent} sub={`${s.emails.testMode} more in test mode`} />
        <Card label="Won after a follow-up" value={s.wonAfterFollowUp.count} sub="Real emails only" />
        <Card label="Value won after a follow-up" value={money(s.wonAfterFollowUp.pence)} />
      </div>
    </>,
  );
}
