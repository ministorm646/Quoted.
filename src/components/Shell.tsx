import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useConfig } from "../api";

export default function Shell({ children, nav, brandTo = "/" }: { children: ReactNode; nav?: ReactNode; brandTo?: string }) {
  const cfg = useConfig();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b-2 border-[#10231c] bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <Link to={brandTo} className="font-display font-extrabold text-xl">{cfg?.name ?? "QuoteNudge"}</Link>
          <nav className="flex items-center gap-2">{nav ?? <Link to="/signin" className="btn btn-sm btn-outline">Sign in</Link>}</nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 md:py-8">{children}</main>
      <footer className="border-t-2 border-[#10231c] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm">Made for small UK service businesses.</div>
      </footer>
    </div>
  );
}
