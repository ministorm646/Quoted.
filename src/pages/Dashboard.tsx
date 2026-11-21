import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import StatusBadge from "../components/StatusBadge";
import { api } from "../api";
import { fmtDate, money, type QuoteRow } from "../lib";

type Stats = { waitingPence: number; wonPence: number; won: number; lost: number; winRate: number | null };
type Tab = "open" | "won" | "lost";
const TABS: [Tab, string, string[]][] = [
  ["open", "Open", ["waiting", "following_up", "paused", "question", "accepted"]],
  ["won", "Won", ["won"]],
  ["lost", "Lost", ["lost", "declined"]],
];

function Quotes() {
  const [data, setData] = useState<{ quotes: QuoteRow[]; stats: Stats } | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("open");

  useEffect(() => {
    api<{ quotes: QuoteRow[]; stats: Stats }>("/api/quotes").then((r) => (r.ok ? setData(r.data) : setFailed(true)));
  }, []);

  if (failed) return <p role="alert" className="text-error font-medium">We couldn't load your quotes. Refresh the page to try again.</p>;
  if (!data) return <div className="space-y-4"><div className="skeleton h-36 w-full" /><div className="skeleton h-20 w-full" /><div className="skeleton h-20 w-full" /></div>;

  const { quotes, stats } = data;
  const rows = quotes.filter((q) => TABS.find((t) => t[0] === tab)![2].includes(q.status));
  const count = (t: Tab) => quotes.filter((q) => TABS.find((x) => x[0] === t)![2].includes(q.status)).length;

  return (
    <>
      <section className="hard-card p-5 md:p-6" aria-label="Summary">
        <p className="font-medium">Waiting for a reply</p>
        <p className="font-display font-extrabold text-5xl md:text-6xl mt-1"><span className="hl">{money(stats.waitingPence)}</span></p>
        <dl className="mt-5 grid grid-cols-2 gap-4">
          <div><dt className="text-sm">Won so far</dt><dd className="font-display text-2xl font-bold">{money(stats.wonPence)}</dd></div>
          <div><dt className="text-sm">Win rate</dt><dd className="font-display text-2xl font-bold">{stats.winRate === null ? "Not yet" : `${stats.winRate}%`}</dd></div>
        </dl>
      </section>

      <div role="tablist" className="tabs tabs-border mt-8">
        {TABS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`tab h-12 ${tab === k ? "tab-active font-bold" : ""}`}>
            {label} ({count(k)})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 text-center py-10">
          {quotes.length === 0 ? (
            <>
              <h2 className="text-2xl font-bold">No quotes yet</h2>
              <p className="mt-2">Add the next quote you send. It takes about ten seconds, and we take it from there.</p>
              <Link to="/app/new" className="btn btn-primary mt-5">Add your first quote</Link>
            </>
          ) : (
            <p>Nothing here yet.</p>
          )}
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((q) => (
            <li key={q.id}>
              <Link to={`/app/quotes/${q.id}`} className="block bg-white border-2 border-[#10231c] rounded-xl p-4 hover:bg-[#f4f6f3]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{q.clientName}</p>
                    <p className="text-sm truncate">{q.description}</p>
                  </div>
                  <p className="font-display font-bold text-lg whitespace-nowrap">{money(q.amountPence)}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadge status={q.status} />
                  {q.nextFollowupAt && <span className="text-sm">Next follow-up: {fmtDate(q.nextFollowupAt)}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function Dashboard() {
  return <AppShell><Quotes /></AppShell>;
}
