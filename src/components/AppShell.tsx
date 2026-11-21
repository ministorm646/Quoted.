import { NavLink, Link, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import Shell from "./Shell";
import { api, useMe, type Me } from "../api";

// Signed-in frame. Children only render once the user (and CSRF token) is loaded.
export default function AppShell({ children }: { children: ReactNode | ((me: Me) => ReactNode) }) {
  const me = useMe();
  const nav = useNavigate();
  const signOut = async () => { await api("/api/auth/logout", { method: "POST", body: {} }); nav("/", { replace: true }); };
  const tab = ({ isActive }: { isActive: boolean }) => `btn btn-sm ${isActive ? "btn-primary" : "btn-outline"}`;

  return (
    <Shell brandTo="/app" nav={<>
      {me?.isAdmin && <Link to="/admin" className="btn btn-sm btn-ghost">Admin</Link>}
      <button onClick={signOut} className="btn btn-sm btn-ghost">Sign out</button>
    </>}>
      {!me ? (
        <div className="space-y-4"><div className="skeleton h-10 w-2/3" /><div className="skeleton h-32 w-full" /></div>
      ) : (
        <>
          <nav aria-label="App" className="flex gap-2 mb-6 overflow-x-auto pb-1">
            <NavLink to="/app" end className={tab}>Quotes</NavLink>
            <NavLink to="/app/new" className={tab}>Add quote</NavLink>
            <NavLink to="/app/settings" className={tab}>Settings</NavLink>
          </nav>
          {typeof children === "function" ? children(me) : children}
        </>
      )}
    </Shell>
  );
}
