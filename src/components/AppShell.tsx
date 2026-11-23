import { Link, NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { api, useConfig, useMe, type Me } from "../api";
import Logo from "./Logo";
import Icon from "./Icon";

const NAV = [
  { to: "/app", end: true, label: "Quotes", icon: "list" },
  { to: "/app/new", label: "Add quote", icon: "plus" },
  { to: "/app/refer", label: "Refer", icon: "gift" },
  { to: "/app/billing", label: "Plan", icon: "card" },
  { to: "/app/settings", label: "Settings", icon: "sliders" },
] as const;

function Banners({ me }: { me: Me }) {
  const a = me.access;
  const box = "panel p-3 md:p-4 flex flex-wrap items-center justify-between gap-3";
  const items: ReactNode[] = [];
  if (a?.enforced && a.state === "expired") items.push(
    <div key="x" role="alert" className={`${box} border-error`}><p className="font-medium">Your free period has ended. Follow-ups are paused and you can't add new quotes.</p><Link to="/app/billing" className="btn btn-primary btn-sm">Choose a plan</Link></div>);
  else if (a?.state === "past_due") items.push(
    <div key="p" role="alert" className={`${box} border-warning`}><p className="font-medium">Your last payment didn't go through. Update your card to keep follow-ups running.</p><Link to="/app/billing" className="btn btn-primary btn-sm">Fix payment</Link></div>);
  else if (a?.enforced && a.state === "free" && a.daysLeft !== null && a.daysLeft <= 14) items.push(
    <div key="t" className={`${box} callout`}><p className="font-medium">{a.daysLeft} day{a.daysLeft === 1 ? "" : "s"} left of your free {me.business?.founding ? "period" : "trial"}.{me.business?.founding ? " Founding members get a discount." : ""}</p><Link to="/app/billing" className="btn btn-primary btn-sm">See plans</Link></div>);
  if (!me.hasPassword) items.push(
    <div key="w" className={box}><p className="font-medium">Set a password so you can sign in faster next time.</p><Link to="/app/password" className="btn btn-outline btn-sm">Set a password</Link></div>);
  return items.length ? <div className="space-y-3 mb-5">{items}</div> : null;
}

// The signed-in frame. A side menu on a computer, a bottom tab bar on a phone.
export default function AppShell({ children }: { children: ReactNode | ((me: Me) => ReactNode) }) {
  const me = useMe();
  const cfg = useConfig();
  const nav = useNavigate();
  const signOut = async () => { await api("/api/auth/logout", { method: "POST", body: {} }); nav("/", { replace: true }); };
  const side = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium border-2 ${isActive ? "bg-(--accent) text-(--accent-content) border-(--accent)" : "border-transparent hover:bg-(--paper)"}`;
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? "text-(--accent-text)" : "opacity-80"}`;
  const a = me?.access;
  const status = !a ? "" : a.state === "subscribed" ? "Subscribed" : a.state === "past_due" ? "Payment due" : a.state === "cancelled" ? `Ends ${a.until}` : a.state === "expired" ? "Free period ended" : `Free until ${a.until}`;

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-(--card) focus:border-2 focus:border-(--line) focus:rounded-lg focus:px-4 focus:py-2 font-bold">Skip to content</a>

      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 sticky top-0 h-screen border-r-2 border-(--line) bg-(--card) p-4">
        <Link to="/app" aria-label="Home" className="px-2 py-2"><Logo name={cfg?.name} /></Link>
        <nav aria-label="App" className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={"end" in n} className={side}><Icon name={n.icon} />{n.label === "Refer" ? "Refer a friend" : n.label === "Plan" ? "Plan and billing" : n.label}</NavLink>)}
          {me?.isAdmin && <NavLink to="/admin" className={side}><Icon name="shield" />Admin</NavLink>}
        </nav>
        <div className="mt-auto space-y-3">
          {me && <div className="panel p-3 text-sm"><p className="font-bold truncate">{me.business?.name ?? me.email}</p><p className="opacity-80">{status}</p>{me.business?.founding && <p className="mt-1"><span className="badge badge-success badge-sm">Founding member</span></p>}</div>}
          <button onClick={signOut} className="btn btn-ghost btn-sm w-full justify-start gap-3"><Icon name="out" size={18} />Sign out</button>
          <p className="px-1 text-xs opacity-80 space-x-3"><Link className="link" to="/privacy">Privacy</Link><Link className="link" to="/terms">Terms</Link><Link className="link" to="/contact">Contact</Link></p>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden sticky top-0 z-20 bg-(--card) border-b-2 border-(--line) h-14 px-4 flex items-center justify-between">
          <Link to="/app" aria-label="Home"><Logo name={cfg?.name} size={26} /></Link>
          <div className="flex items-center gap-1">
            {me?.isAdmin && <Link to="/admin" className="btn btn-ghost btn-sm">Admin</Link>}
            <button onClick={signOut} className="btn btn-ghost btn-sm">Sign out</button>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="flex-1 w-full max-w-[1400px] mx-auto px-4 pt-4 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12 outline-none">
          {!me ? <div className="space-y-4"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-32 w-full" /></div> : (
            <>
              <Banners me={me} />
              {typeof children === "function" ? children(me) : children}
            </>
          )}
        </main>
      </div>

      <nav aria-label="App" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-(--card) border-t-2 border-(--line) flex pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={"end" in n} className={tab}>
            {n.icon === "plus"
              ? <span className="grid h-9 w-9 place-items-center rounded-full bg-(--accent) text-(--accent-content) -mt-4 border-2 border-(--line)"><Icon name="plus" size={20} /></span>
              : <Icon name={n.icon} />}
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
