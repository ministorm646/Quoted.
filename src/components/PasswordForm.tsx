import { useState, type FormEvent } from "react";
import { api } from "../api";

// Set or change the password. `needCurrent` is false for a new password, or right after an email-link sign-in.
export default function PasswordForm({ needCurrent, onDone, submitLabel = "Save password" }: { needCurrent: boolean; onDone: () => void; submitLabel?: string }) {
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const type = show ? "text" : "password";
  const strong = pw.length >= 10;

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (pw !== again) return setError("The two passwords don't match.");
    setBusy(true);
    const r = await api<{ error?: string }>("/api/password", { body: { current, password: pw } });
    setBusy(false);
    if (r.ok) onDone(); else setError(r.data?.error ?? "Something went wrong. Please try again.");
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {needCurrent && <label className="block"><span className="font-medium">Current password</span>
        <input className="input input-bordered w-full mt-1" type={type} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} /></label>}
      <label className="block"><span className="font-medium">New password</span>
        <input className="input input-bordered w-full mt-1" type={type} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pw-help" /></label>
      <label className="block"><span className="font-medium">Type it again</span>
        <input className="input input-bordered w-full mt-1" type={type} autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} /></label>
      <p id="pw-help" className="text-sm">{strong ? "Good length." : "Use at least 10 characters."} A few random words make a strong, easy to remember password.</p>
      <label className="flex items-center gap-2 cursor-pointer text-sm"><input type="checkbox" className="checkbox checkbox-sm" checked={show} onChange={(e) => setShow(e.target.checked)} />Show passwords</label>
      {error && <p role="alert" className="text-error font-medium">{error}</p>}
      <button className="btn btn-primary" disabled={busy || !pw || !again}>{busy ? <span className="loading loading-spinner" /> : submitLabel}</button>
    </form>
  );
}
