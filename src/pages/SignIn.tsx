import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import Shell from "../components/Shell";
import Turnstile from "../components/Turnstile";
import Icon from "../components/Icon";
import { api, useConfig, usePageTitle } from "../api";

export default function SignIn() {
  usePageTitle("Sign in");
  const cfg = useConfig();
  const nav = useNavigate();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [token, setToken] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    if (mode === "password") {
      const r = await api<{ error?: string }>("/api/auth/login", { body: { email, password, remember, turnstileToken: token } });
      setBusy(false);
      if (r.ok) return nav("/app", { replace: true });
      setError(r.data?.error ?? "Something went wrong. Please try again.");
    } else {
      const r = await api<{ message?: string; error?: string }>("/api/auth/request", { body: { email, turnstileToken: token } });
      setBusy(false);
      if (r.ok) return setMsg(r.data.message ?? "");
      setError(r.data?.error ?? "Something went wrong. Please try again.");
    }
    setReset((n) => n + 1);
  }
  const tab = (m: "password" | "link") => `tab h-11 flex-1 ${mode === m ? "tab-active font-bold" : ""}`;

  return (
    <Shell wide>
      <div className="mx-auto max-w-6xl px-4 py-8 md:py-14 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <h1 className="text-4xl font-extrabold leading-tight">Welcome back. <span className="hl">Your quotes are waiting.</span></h1>
          <ul className="mt-6 space-y-4 max-w-md">
            {["See what is still waiting for a reply, and what you have won.", "Follow-ups keep going in your name while you get on with the work.", "Add a quote from your phone in about ten seconds."].map((t) => (
              <li key={t} className="flex gap-3"><span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-(--accent) text-(--accent-content)"><Icon name="check" size={14} /></span><span>{t}</span></li>))}
          </ul>
          <p className="mt-8 text-sm">Early access is by invitation. <Link className="link" to="/#access">Ask for a place</Link></p>
        </div>

        <div className="hard-card p-6 w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
          <h2 className="text-2xl font-extrabold">Sign in</h2>
          <div role="tablist" className="tabs tabs-border mt-4">
            <button role="tab" aria-selected={mode === "password"} className={tab("password")} onClick={() => { setMode("password"); setMsg(""); setError(""); }}>Password</button>
            <button role="tab" aria-selected={mode === "link"} className={tab("link")} onClick={() => { setMode("link"); setMsg(""); setError(""); }}>Email me a link</button>
          </div>
          {msg ? (
            <p role="status" className="mt-5">{msg} The link works once and expires in 15 minutes.</p>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              <label className="block"><span className="font-medium">Email</span>
                <input className="input input-bordered w-full mt-1" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
              {mode === "password" && (<>
                <label className="block"><span className="font-medium">Password</span>
                  <input className="input input-bordered w-full mt-1" type={show ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox checkbox-sm" checked={remember} onChange={(e) => setRemember(e.target.checked)} />Remember me for 30 days</label>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="checkbox checkbox-sm" checked={show} onChange={(e) => setShow(e.target.checked)} />Show password</label>
                </div>
              </>)}
              {cfg && <Turnstile siteKey={cfg.turnstileSiteKey} onToken={setToken} resetKey={reset} />}
              {error && <p role="alert" className="text-error font-medium">{error}</p>}
              <button className="btn btn-primary w-full text-base" disabled={busy || !token || !email || (mode === "password" && !password)}>
                {busy ? <span className="loading loading-spinner" /> : mode === "password" ? "Sign in" : "Email me a sign-in link"}
              </button>
              {mode === "password"
                ? <p className="text-sm">Forgot your password, or haven't set one yet? <button type="button" className="link font-medium" onClick={() => setMode("link")}>Email me a sign-in link</button>, then set a new password.</p>
                : <p className="text-sm">Already set a password? <button type="button" className="link font-medium" onClick={() => setMode("password")}>Sign in with it</button></p>}
              {mode === "password" && <p className="text-xs">Untick "Remember me" on a shared computer.</p>}
            </form>
          )}
        </div>
      </div>
    </Shell>
  );
}
