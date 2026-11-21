import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useConfig } from "../api";

export default function Shell({ children, nav, brandTo = "/", header, wide }: {
  children: ReactNode; nav?: ReactNode; brandTo?: string; header?: ReactNode; wide?: boolean;
}) {
  const cfg = useConfig();
  return (
    <div className="min-h-screen flex flex-col">
      {header ?? (
        <header className="border-b-2 border-[#10231c] bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
            <Link to={brandTo} className="font-display font-extrabold text-xl">{cfg?.name ?? "QuoteNudge"}</Link>
            <nav className="flex items-center gap-2">{nav ?? <Link to="/signin" className="btn btn-sm btn-outline">Sign in</Link>}</nav>
          </div>
        </header>
      )}
      <main className={wide ? "flex-1" : "flex-1 mx-auto w-full max-w-5xl px-4 py-6 md:py-8"}>{children}</main>
      <footer className="border-t-2 border-[#10231c] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm flex flex-wrap gap-x-6 gap-y-2 justify-between">
          <span>Made for small UK service businesses.</span>
          <span className="flex gap-4"><Link className="link" to="/privacy">Privacy</Link><Link className="link" to="/signin">Sign in</Link></span>
        </div>
      </footer>
    </div>
  );
}
