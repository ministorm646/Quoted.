import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/AppShell";
import StatusBadge from "../components/StatusBadge";
import { api, usePageTitle } from "../api";
import { fmtDate, money, type QuoteRow } from "../lib";

type Stats = { waitingPence: number; wonPence: number; won: number; lost: number; winRate: number | null };
type Tab = "open" | "won" | "lost";
const TABS: [Tab, string, string[]][] = [
  ["open", "Open", ["waiting", "following_up", "paused", "question", "accepted"]],
  ["won", "Won", ["won"]],
  ["lost", "Lost", ["lost", "declined"]],
];

const Tile = ({ label, value, big }: { label: string; value: string; big?: boolean }) => (
  <div className={`panel p-4 ${big ? "col-span-2 lg:col-span-1 hard-card" : ""}`}>
    <p className="text-sm font-medium">{label}</p>
    <p className={`font-display font-extrabold mt-1 ${big ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"}`}>{big ? <span className="hl">{value}</span> : value}</p>
  </div>
);

function Quotes() {
  const [data, setData] = useState<{ quotes: QuoteRow[]; stats: Stats } | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("open");
  const [search, setSearch] = useState("");

  useEffect(() => { api<{ quotes: QuoteRow[]; stats: Stats }>("/api/quotes").then((r) => (r.ok ? setData(r.data) : setFailed(true))); }, []);
  if (failed) return <p role="alert" className="text-error font-medium">We couldn't load your quotes. Refresh the page to try again.</p>;
  if (!data) return <div className="space-y-4"><div className="skeleton h-28 w-full" /><div className="skeleton h-20 w-full" /><div className="skeleton h-20 w-full" /></div>;

  const { quotes, stats } = data;
  const inTab = (t: Tab) => quotes.filter((q) => TABS.find((x) => x[0] === t)![2].includes(q.status));
  const needle = search.trim().toLowerCase();
  const rows = inTab(tab).filter((q) => !needle || q.clientName.toLowerCase().includes(needle) || q.description.toLowerCase().includes(needle));
  const attention = quotes.filter((q) => q.status === "accepted" || q.status === "question");
  const upcoming = quotes.filter((q) => ["waiting", "following_up"].includes(q.status) && q.nextFollowupAt)
    .sort((a, b) => (a.nextFollowupAt! < b.nextFollowupAt! ? -1 : 1)).slice(0, 5);

  const panel = (title: string, items: QuoteRow[], empty: string, line: (q: QuoteRow) => string, always: boolean) => (
    <section className={`panel p-4 ${items.length || always ? "" : "hidden lg:block"}`} aria-label={title}>
      <h2 className="font-bold text-lg">{title}</h2>
      {items.length === 0 ? <p className="mt-2 text-sm">{empty}</p> : (
        <ul className="mt-2 divide-y-2 divide-(--line-soft)">
          {items.map((q) => (
            <li key={q.id}><Link to={`/app/quotes/${q.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:underline">
              <span className="min-w-0"><span className="block font-medium truncate">{q.clientName}</span><span className="block text-sm truncate">{q.description}</span></span>
              <span className="text-sm text-right whitespace-nowrap">{line(q)}</span>
            </Link></li>))}
        </ul>)}
    </section>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold">Your quotes</h1>
        <Link to="/app/new" className="btn btn-primary btn-sm hidden lg:inline-flex">Add a quote</Link>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile big label="Waiting for a reply" value={money(stats.waitingPence)} />
        <Tile label="Won so far" value={money(stats.wonPence)} />
        <Tile label="Win rate" value={stats.winRate === null ? "Not yet" : `${stats.winRate}%`} />
        <Tile label="Open quotes" value={String(inTab("open").length)} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-4 lg:col-start-2 lg:row-start-1">
          {panel("Needs your attention", attention, "Nothing needs you right now.", (q) => (q.status === "accepted" ? "Said yes" : "Has a question"), false)}
          {panel("Coming up", upcoming, "No follow-ups are due yet.", (q) => fmtDate(q.nextFollowupAt), false)}
        </div>

        <div className="lg:col-start-1 lg:row-start-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" className="tabs tabs-border">
              {TABS.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`tab h-12 ${tab === k ? "tab-active font-bold" : ""}`}>{label} ({inTab(k).length})</button>))}
            </div>
            {quotes.length >= 4 && <input className="input input-bordered w-full sm:w-64" type="search" placeholder="Search by client or job" aria-label="Search quotes" value={search} onChange={(e) => setSearch(e.target.value)} />}
          </div>

          {rows.length === 0 ? (
            <div className="mt-6 text-center py-10 panel">
              {quotes.length === 0 ? (<>
                <h2 className="text-2xl font-bold">No quotes yet</h2>
                <p className="mt-2 max-w-md mx-auto">Add the next quote you send. It takes about ten seconds, and we take it from there.</p>
                <Link to="/app/new" className="btn btn-primary mt-5">Add your first quote</Link>
              </>) : <p>{needle ? "No quotes match your search." : "Nothing here yet."}</p>}
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_110px_180px_130px] gap-4 px-4 mt-4 text-sm font-medium opacity-80" aria-hidden="true">
                <span>Client and job</span><span className="text-right">Amount</span><span>Status</span><span>Next follow-up</span>
              </div>
              <ul className="mt-2 md:mt-1 space-y-3">
                {rows.map((q) => (
                  <li key={q.id}>
                    <Link to={`/app/quotes/${q.id}`} className="panel grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_110px_180px_130px] items-center gap-x-4 gap-y-2 p-4 hover:bg-(--paper)">
                      <div className="min-w-0"><p className="font-bold truncate">{q.clientName}</p><p className="text-sm truncate">{q.description}</p></div>
                      <p className="font-display font-bold text-lg text-right">{money(q.amountPence)}</p>
                      <div className="col-span-2 md:contents flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 col-span-2 md:col-span-1"><StatusBadge status={q.status} /></div>
                        <span className="text-sm col-span-2 md:col-span-1">{q.nextFollowupAt ? <><span className="md:hidden">Next follow-up: </span>{fmtDate(q.nextFollowupAt)}</> : <span className="opacity-60">None planned</span>}</span>
                      </div>
                    </Link>
                  </li>))}
              </ul>
            </>)}
        </div>
      </div>
    </>
  );
}

export default function Dashboard() { usePageTitle("Your quotes"); return <AppShell><Quotes /></AppShell>; }
