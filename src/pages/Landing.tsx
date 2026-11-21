import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Shell from "../components/Shell";
import Turnstile from "../components/Turnstile";
import { api, useConfig } from "../api";
import { money } from "../lib";

const TRADES: [string, string][] = [
  ["cleaning", "Cleaner"], ["building", "Builder"], ["landscaping", "Landscaper or gardener"], ["removals", "Removals"],
  ["plumbing", "Plumber or heating engineer"], ["electrical", "Electrician"], ["roofing", "Roofer"],
  ["decorating", "Decorator or painter"], ["handyman", "Handyman"], ["agency", "Small agency"], ["other", "Something else"],
];
const LINKS: [string, string][] = [["#how", "How it works"], ["#email", "Sample email"], ["#faq", "Questions"], ["#access", "Early access"]];

function Header() {
  const cfg = useConfig();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 bg-white border-b-2 border-[#10231c]">
      <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
        <Link to="/" className="font-display font-extrabold text-xl">{cfg?.name ?? "QuoteMe"}</Link>
        <nav className="hidden md:flex items-center gap-5" aria-label="Main">
          {LINKS.map(([h, l]) => <a key={h} href={h} className="font-medium hover:underline">{l}</a>)}
          <Link to="/signin" className="btn btn-sm btn-outline">Sign in</Link>
        </nav>
        <button className="md:hidden btn btn-ghost btn-square" aria-label="Menu" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="mobile-menu" className="md:hidden border-t-2 border-[#10231c] bg-white px-4 py-3 flex flex-col" aria-label="Main">
          {LINKS.map(([h, l]) => <a key={h} href={h} onClick={() => setOpen(false)} className="py-3 font-medium border-b border-[#dfe5de]">{l}</a>)}
          <Link to="/signin" className="py-3 font-medium">Sign in</Link>
        </nav>
      )}
    </header>
  );
}

type Reply = "waiting" | "yes" | "question" | "no";
const REPLY_TEXT: Record<Reply, string> = { waiting: "", yes: "Said yes", question: "Has a question", no: "Not interested" };

function Demo() {
  const [reply, setReply] = useState<Reply>("waiting");
  const sam = 240000, priya = 245000;
  const waiting = priya + (reply === "waiting" ? sam : 0);
  return (
    <div className="hard-card p-5" aria-label="Live demo">
      <p className="font-medium">Waiting for a reply</p>
      <p className="font-display font-extrabold text-5xl mt-1" aria-live="polite"><span className="hl">{money(waiting)}</span></p>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex justify-between gap-3 border-2 border-[#10231c] rounded-lg p-3">
          <span><b>Sam Taylor</b><br />Kitchen repaint</span>
          <span className="text-right"><b>{money(sam)}</b><br />
            <span className={`badge ${reply === "yes" ? "badge-success" : reply === "waiting" ? "badge-warning" : "badge-info badge-outline"}`}>{reply === "waiting" ? "Waiting for a reply" : REPLY_TEXT[reply]}</span></span>
        </li>
        <li className="flex justify-between gap-3 border-2 border-[#dfe5de] rounded-lg p-3">
          <span><b>Priya Shah</b><br />Garden fence</span>
          <span className="text-right"><b>{money(priya)}</b><br /><span className="badge badge-info">Follow-up sent</span></span>
        </li>
      </ul>
      <p className="mt-4 font-medium text-sm">Try it: you are Sam, and you have just got a follow-up email.</p>
      <div className="mt-2 grid gap-2">
        <button className="btn btn-primary" onClick={() => setReply("yes")}>Yes, go ahead</button>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-outline" onClick={() => setReply("question")}>I have a question</button>
          <button className="btn btn-outline" onClick={() => setReply("no")}>Not interested</button>
        </div>
        {reply !== "waiting" && <button className="btn btn-ghost btn-sm" onClick={() => setReply("waiting")}>Start again</button>}
      </div>
    </div>
  );
}

function SampleEmail() {
  const [tapped, setTapped] = useState("");
  const btn = "btn w-full text-base";
  return (
    <div className="hard-card p-5 max-w-md mx-auto md:mx-0">
      <p className="text-sm">From: Bright Cleaners <span className="opacity-70">(replies go to you)</span></p>
      <p className="font-bold mt-1">Following up: Kitchen repaint</p>
      <div className="mt-4 space-y-3">
        <p>Hi Sam,</p>
        <p>Just checking in on the quote for the kitchen repaint. I know things get busy, so there is no pressure either way.</p>
        <p>A quick tap below lets me know where you stand.</p>
      </div>
      <div className="mt-4 space-y-2">
        <button className={`${btn} btn-primary`} onClick={() => setTapped("yes")}>Yes, go ahead</button>
        <button className={`${btn} btn-outline`} onClick={() => setTapped("question")}>I have a question</button>
        <button className={`${btn} btn-ghost bg-[#f4f6f3]`} onClick={() => setTapped("no")}>Not interested</button>
      </div>
      <p className="text-sm mt-4">Kind regards, Bright Cleaners</p>
      <p className="text-xs mt-3 opacity-80">Don't want these emails? Unsubscribe</p>
      {tapped && <p role="status" className="mt-4 text-sm border-2 border-[#10231c] rounded-lg p-3 bg-[#ffd84d]/40">In a real email this opens a page where your client confirms with one more tap. That way, mail scanners can't answer for them.</p>}
    </div>
  );
}

const FAQ: [string, string][] = [
  ["Will my clients know it is automatic?", "The emails go out in your business name, with your wording, and replies come straight to you. They are short and polite, and you can read exactly how they look in Settings before anything is sent."],
  ["How many emails does a client get?", "By default, three: on day 3, 7 and 14 after you log the quote. You can change the days. It stops straight away when the client taps any button, or when you mark the quote won, lost or paused."],
  ["What does it cost?", "Early-access members get three months free, and we don't ask for a card. We will tell you well before anything changes."],
  ["What if a client doesn't want emails?", "Every email has an unsubscribe link. Once used, that person never gets another email from the service, and any open quotes for them are paused."],
  ["What do you store about my clients?", "Only what you type in: their name and email, the amount and a one-line job description. You can delete a quote, or your whole account and data, at any time in Settings."],
  ["Who is it for?", "Small UK service businesses: cleaners, builders, landscapers, removals, trades and small agencies, anyone who sends quotes and then waits."],
];

function EarlyAccess() {
  const cfg = useConfig();
  const [sp] = useSearchParams();
  const ref = sp.get("ref") ?? "";
  const [f, setF] = useState({ email: "", business: "", trade: "", chat: false });
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    const r = await api("/api/waitlist", { body: { email: f.email, businessName: f.business, trade: f.trade, chat: f.chat, ref, turnstileToken: token } });
    setBusy(false);
    if (r.ok) return setDone(true);
    setError(r.data?.error ?? "Something went wrong. Please try again.");
    setReset((n) => n + 1);
  }
  return (
    <div className="hard-card p-6 max-w-lg mx-auto">
      {done ? (
        <div role="status"><h2 className="text-2xl font-bold">You're on the list</h2>
          <p className="mt-2">We will only email you if you are approved. Until then, you won't hear from us.</p></div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <h2 className="text-2xl font-bold">Ask for early access</h2>
          <label className="block"><span className="font-medium">Email</span>
            <input className="input input-bordered w-full mt-1" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          <label className="block"><span className="font-medium">Business name (optional)</span>
            <input className="input input-bordered w-full mt-1" maxLength={80} autoComplete="organization" value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} /></label>
          <label className="block"><span className="font-medium">What do you do?</span>
            <select className="select select-bordered w-full mt-1" value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })}>
              <option value="">Choose one</option>{TRADES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="checkbox mt-1" checked={f.chat} onChange={(e) => setF({ ...f, chat: e.target.checked })} />
            <span>I'm happy to have a 15-minute chat about how it works for me.</span></label>
          {cfg && <Turnstile siteKey={cfg.turnstileSiteKey} onToken={setToken} resetKey={reset} />}
          {error && <p role="alert" className="text-error font-medium">{error}</p>}
          <button className="btn btn-primary w-full text-base" disabled={busy || !token || !f.email}>{busy ? <span className="loading loading-spinner" /> : "Ask for a place"}</button>
          <p className="text-sm">We only use your email to send your invite and sign-in links. <Link className="link" to="/privacy">Privacy</Link></p>
        </form>
      )}
    </div>
  );
}

export default function Landing() {
  return (
    <Shell header={<Header />} wide>
      <div className="mx-auto max-w-5xl px-4">
        <section className="py-10 md:py-16 grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Quotes go quiet. <span className="hl">The work shouldn't.</span></h1>
            <p className="mt-5 text-lg max-w-prose">Log a quote in about ten seconds. We send polite follow-ups in your name until the customer replies, and you see what is still waiting and what you have won.</p>
            <a href="#access" className="btn btn-primary mt-6 text-base">Ask for early access</a>
          </div>
          <Demo />
        </section>

        <section id="how" className="py-10 scroll-mt-20">
          <h2 className="text-3xl font-extrabold">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[["1", "Log the quote", "Client name, email, amount and a one-line job. About ten seconds."],
              ["2", "We follow up for you", "Polite emails in your name, by default on day 3, 7 and 14. Replies come straight to you."],
              ["3", "They tap, you win it", "One tap tells you yes, question or no, and the chasing stops. You see your totals update."]].map(([n, t, d]) => (
              <li key={n} className="hard-card p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ffd84d] border-2 border-[#10231c] font-display font-extrabold">{n}</span>
                <h3 className="text-xl font-bold mt-3">{t}</h3><p className="mt-1">{d}</p>
              </li>))}
          </ol>
        </section>

        <section id="email" className="py-10 scroll-mt-20 grid gap-8 md:grid-cols-2 md:items-center">
          <div><h2 className="text-3xl font-extrabold">What your client sees</h2>
            <p className="mt-3 max-w-prose">Short, friendly and easy to answer on a phone. Three big buttons, your business name on it, and an unsubscribe link in every email. Try the buttons.</p></div>
          <SampleEmail />
        </section>

        <section className="py-10">
          <div className="hard-card p-6 md:p-8 max-w-xl mx-auto text-center">
            <p className="font-medium">Founding member</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-1"><span className="hl">Free for your first 3 months</span></h2>
            <ul className="mt-5 space-y-2 text-left max-w-sm mx-auto">
              {["Limited places while we are in early access", "No card needed", "Your feedback shapes what we build next", "Everything included, nothing locked"].map((t) => (
                <li key={t} className="flex gap-2"><span aria-hidden="true" className="font-bold text-[#0e7a55]">&#10003;</span><span>{t}</span></li>))}
            </ul>
            <a href="#access" className="btn btn-primary mt-6 text-base">Ask for a place</a>
          </div>
        </section>

        <section id="faq" className="py-10 scroll-mt-20 max-w-3xl">
          <h2 className="text-3xl font-extrabold">Questions</h2>
          <div className="mt-5 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="bg-white border-2 border-[#10231c] rounded-xl p-4">
                <summary className="font-bold">{q}</summary><p className="mt-3">{a}</p>
              </details>))}
          </div>
        </section>

        <section id="access" className="py-10 pb-16 scroll-mt-20"><EarlyAccess /></section>
      </div>
    </Shell>
  );
}
