import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import { api, usePageTitle } from "../api";

type R = { link: string; credited: number; cap: number; freeUntil: string };

function View() {
  const [r, setR] = useState<R | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { api<R>("/api/referrals").then((x) => x.ok && setR(x.data)); }, []);
  if (!r) return <div className="space-y-4"><div className="skeleton h-10 w-1/2" /><div className="skeleton h-32 w-full" /></div>;

  async function copy() {
    try { await navigator.clipboard.writeText(r!.link); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt("Copy this link", r!.link); }
  }
  const share = () => navigator.share?.({ title: "Early access", text: "Try this for following up quotes:", url: r.link }).catch(() => {});

  return (
    <div className="max-w-lg">
      <h1 className="text-3xl font-extrabold">Refer a friend</h1>
      <p className="mt-3">When a business you refer logs its first quote, you both get one extra free month. You can earn up to {r.cap} extra months.</p>
      <div className="hard-card p-5 mt-5">
        <p className="font-medium">Your link</p>
        <p className="mt-1 break-all font-mono text-sm bg-[#f4f6f3] border-2 border-[#10231c] rounded-lg p-3">{r.link}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
          {typeof navigator !== "undefined" && "share" in navigator && <button className="btn btn-outline" onClick={share}>Share</button>}
        </div>
      </div>
      <p className="mt-5 font-display text-2xl font-bold"><span className="hl">{r.credited} of {r.cap}</span> referrals credited</p>
      <p className="mt-2">Your free period runs until {r.freeUntil}.</p>
      <p className="mt-3 text-sm">Friends still need to be approved for early access, and places are limited.</p>
    </div>
  );
}

export default function Refer() {
  usePageTitle("Refer a friend"); return <AppShell><View /></AppShell>; }
