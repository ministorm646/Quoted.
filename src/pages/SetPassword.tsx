import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import PasswordForm from "../components/PasswordForm";
import { usePageTitle } from "../api";

export default function SetPassword() {
  usePageTitle("Password");
  const nav = useNavigate();
  return (
    <AppShell>{(me) => (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,480px)_1fr] lg:gap-12">
        <div>
          <h1 className="text-3xl font-extrabold">{me.hasPassword ? "Change your password" : "Create your password"}</h1>
          <p className="mt-2">{me.hasPassword ? "Other devices will be signed out when you change it." : "Next time, sign in with your email and password. You can still get an emailed sign-in link any time."}</p>
          <div className="hard-card p-5 mt-5"><PasswordForm needCurrent={me.hasPassword && !me.canResetPassword} onDone={() => nav("/app", { replace: true })} /></div>
        </div>
        <aside className="panel p-5 self-start hidden lg:block">
          <h2 className="font-bold text-lg">How your password is kept safe</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc pl-5">
            <li>We never store your password, only a scrambled version that can't be turned back into it.</li>
            <li>Too many wrong tries pauses sign-in for 15 minutes.</li>
            <li>Forgotten it? Email yourself a sign-in link from the sign-in page, then set a new one here.</li>
          </ul>
        </aside>
      </div>
    )}</AppShell>
  );
}
