import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { useConfig } from "../api";
import Logo from "./Logo";

export default function Shell({ children, nav, brandTo = "/", header, wide }: {
  children: ReactNode; nav?: ReactNode; brandTo?: string; header?: ReactNode; wide?: boolean;
}) {
  const cfg = useConfig();
  const co = cfg?.company;
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:border-2 focus:border-[#10231c] focus:rounded-lg focus:px-4 focus:py-2 font-bold">Skip to content</a>
      {header ?? (
        <header className="border-b-2 border-[#10231c] bg-white sticky top-0 z-10">
          <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
            <Link to={brandTo} aria-label={`${cfg?.name ?? "QuoteMe"} home`}><Logo name={cfg?.name} /></Link>
            <nav className="flex items-center gap-2">{nav ?? <Link to="/signin" className="btn btn-sm btn-outline">Sign in</Link>}</nav>
          </div>
        </header>
      )}
      <main id="main" tabIndex={-1} className={wide ? "flex-1 outline-none" : "flex-1 outline-none mx-auto w-full max-w-5xl px-4 py-6 md:py-8"}>{children}</main>
      <footer className="border-t-2 border-[#10231c] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-bold">{co?.name || cfg?.name || "QuoteMe"}</p>
            {co?.number && <p>Company number {co.number}</p>}
            {co?.address && <p>{co.address}</p>}
            <p className="mt-1">Made for small UK service businesses.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 md:justify-end content-start">
            <Link className="link" to="/privacy">Privacy</Link><Link className="link" to="/terms">Terms</Link>
            <Link className="link" to="/contact">Contact</Link><Link className="link" to="/signin">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
