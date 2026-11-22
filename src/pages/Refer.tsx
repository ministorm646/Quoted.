import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { api, usePageTitle } from "../api";

type R = { link: string; credited: number; cap: number; freeUntil: string };

function View() {
  const [r, setR] = useState<R | null>(null);
  const [copied, setCopied] = useState("");
  useEffect(() => { api<R>("/api/referrals").then((x) => x.ok && setR(x.data)); }, []);
  if (!r) return <div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-32 w-full" /></div>;

  const message = `I've been using a tool that follows up my quotes for me, so none go quiet. You can ask for a place here: ${r.link}`;
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(""), 2000); }
    catch { window.prompt("Copy this", text); }
  }
  const share = () => navigator.share?.({ title: "Early access", text: message }).catch(() => {});

  return (
    <>
      <h1 className="text-2xl md:text-3xl font-extrabold">Refer a friend</h1>
      <p className="mt-2 max-w-2xl">When a business you refer logs its first quote, you both get one extra free month. You can earn up to {r.cap}.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-6">
          <section className="hard-card p-5">
            <p className="font-medium">Your link</p>
            <p className="mt-2 break-all font-mono text-sm bg-(--paper) border-2 border-(--line) rounded-lg p-3">{r.link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn btn-primary" onClick={() => copy(r.link, "link")}>{copied === "link" ? "Copied" : "Copy link"}</button>
              {typeof navigator !== "undefined" && "share" in navigator && <button className="btn btn-outline" onClick={share}>Share</button>}
            </div>
          </section>
          <section className="panel p-5">
            <h2 className="font-bold text-lg">A message you can send</h2>
            <p className="mt-3 whitespace-pre-wrap bg-(--paper) border-2 border-(--line-soft) rounded-lg p-3 text-sm">{message}</p>
            <button className="btn btn-outline btn-sm mt-3" onClick={() => copy(message, "msg")}>{copied === "msg" ? "Copied" : "Copy message"}</button>
          </section>
          <ol className="grid gap-4 sm:grid-cols-3" aria-label="How it works">
            {[["1", "Share your link", "Send it to a friend with a business."], ["2", "They get a place", "They ask for early access and are approved."], ["3", "You both get a month", "When they log their first quote."]].map(([n, t, d]) => (
              <li key={n} className="panel p-4"><span className="grid h-8 w-8 place-items-center rounded-full bg-(--highlight) border-2 border-(--line) font-display font-extrabold">{n}</span><h3 className="font-bold mt-3">{t}</h3><p className="text-sm mt-1">{d}</p></li>))}
          </ol>
        </div>

        <aside className="panel p-5">
          <h2 className="font-bold text-lg">Your progress</h2>
          <p className="mt-3 font-display text-3xl font-extrabold"><span className="hl">{r.credited} of {r.cap}</span></p>
          <div className="mt-3 flex gap-2" aria-hidden="true">{Array.from({ length: r.cap }, (_, i) => <span key={i} className={`h-3 flex-1 rounded-full border-2 border-(--line) ${i < r.credited ? "bg-(--accent)" : ""}`} />)}</div>
          <p className="mt-3 text-sm">referrals credited</p>
          <p className="mt-4">Your free period runs until <b>{r.freeUntil}</b>.</p>
          <p className="mt-3 text-sm">Friends still need to be approved for early access, and places are limited.</p>
        </aside>
      </div>
    </>
  );
}

export default function Refer() { usePageTitle("Refer a friend"); return <AppShell><View /></AppShell>; }
