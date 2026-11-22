import Shell from "../components/Shell";
import { useConfig, usePageTitle } from "../api";

export default function Terms() {
  usePageTitle("Terms of use");
  const cfg = useConfig();
  const who = cfg?.company?.name || cfg?.name || "the service";
  const h = "text-xl font-bold mt-8";
  return (
    <Shell>
      <div className="lg:grid lg:grid-cols-[minmax(0,42rem)_320px] lg:gap-12">
      <article>
        <h1 className="text-3xl font-extrabold">Terms of use</h1>
        <p className="mt-3">These are the rules for using {cfg?.name ?? "the service"}. By signing in you agree to them. "We" means {who}.</p>

        <h2 className={h}>The service</h2>
        <p className="mt-2">We help you follow up quotes by sending polite emails in your name to people you tell us about, and by showing you what is still waiting. Early access is free and comes without any promise of availability. Features and limits can change.</p>

        <h2 className={h}>Your responsibilities</h2>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>Only add people who asked you for a quote, and only for that quote.</li>
          <li>Use the service for follow-ups, not for advertising or mass marketing.</li>
          <li>Keep the details you enter accurate, and keep your sign-in links private.</li>
          <li>You are responsible for what your messages say. Don't send anything unlawful, misleading or abusive.</li>
          <li>Respect unsubscribes. Anyone who unsubscribes won't be emailed again, and you must not try to get around that.</li>
        </ul>

        <h2 className={h}>Your data</h2>
        <p className="mt-2">You keep ownership of what you put in. We use it to run the service for you, as described in the privacy notice. You can download your quotes at any time, and delete your account and data in Settings.</p>

        <h2 className={h}>Early access</h2>
        <p className="mt-2">Places are limited and by invitation. We may change, pause or end early access, and will tell you before charging for anything. We won't charge you without your agreement.</p>

        <h2 className={h}>Subscriptions</h2>
        <p className="mt-2">After early access, the service is paid for by subscription. The price, the billing period and any founding-member discount are shown on the plan page before you pay. Payments are taken by our payment provider. Subscriptions renew until you cancel, and you can cancel at any time from the billing page, keeping access until the end of the period you have paid for. If a payment fails we will tell you, and may pause follow-ups until it is fixed.</p>

        <h2 className={h}>Availability and changes</h2>
        <p className="mt-2">We work to keep the service running but cannot promise it will always be available or error-free. We may update these terms, and will make the current version available on this page.</p>

        <h2 className={h}>Stopping</h2>
        <p className="mt-2">You can stop at any time by deleting your account. We may suspend accounts that break these rules or put others at risk.</p>

        <h2 className={h}>Liability</h2>
        <p className="mt-2">Nothing in these terms limits liability that cannot be limited by law. Beyond that, we are not responsible for lost business or lost quotes caused by something outside our reasonable control, or by emails not being delivered or read.</p>

        <h2 className={h}>Law</h2>
        <p className="mt-2">These terms are governed by the law of England and Wales.</p>

        <h2 className={h}>Contact</h2>
        <p className="mt-2">Questions about these terms: {cfg?.contactEmail ?? "see the contact page"}.</p>
      </article>
        <aside className="hidden lg:block panel p-5 self-start sticky top-24">
          <h2 className="font-bold text-lg">The short version</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc pl-5"><li>Only add people who asked you for a quote.</li><li>Use it for follow-ups, not advertising.</li><li>Respect unsubscribes.</li><li>You can stop and delete your data at any time.</li></ul>
        </aside>
      </div>
    </Shell>
  );
}
