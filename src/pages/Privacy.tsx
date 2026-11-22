import Shell from "../components/Shell";
import { useConfig, usePageTitle } from "../api";

export default function Privacy() {
  const cfg = useConfig();
  const contact = cfg?.contactEmail ?? "the address on our emails";
  usePageTitle("Privacy");
  const co = cfg?.company;
  const h = "text-xl font-bold mt-8";
  return (
    <Shell>
      <div className="lg:grid lg:grid-cols-[minmax(0,42rem)_320px] lg:gap-12">
      <article>
        <h1 className="text-3xl font-extrabold">Privacy</h1>
        <p className="mt-3">This explains what {cfg?.name ?? "this service"} does with personal data, in plain English. Questions or requests: {contact}.</p>

        {co?.name && <p className="mt-2">Operated by {co.name}{co.number ? `, company number ${co.number}` : ""}{co.address ? `, ${co.address}` : ""}.</p>}

        <h2 className={h}>Who uses what</h2>
        <p className="mt-2">There are three groups of people: businesses who ask for early access or use the service, the people those businesses send quotes to (their clients), and visitors to this site.</p>

        <h2 className={h}>What we keep</h2>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li><b>Early-access requests:</b> email, optional business name, trade, and whether you are happy to chat. We use this only to decide who to invite and to send your invite. We don't email requesters anything else.</li>
          <li><b>Business accounts:</b> your email, business name, reply-to address, settings, and the quotes you log.</li>
          <li><b>Quotes:</b> the client's name and email, the amount, a one-line job description, and a history of what happened. We keep only what you type in.</li>
          <li><b>Passwords:</b> only a salted, one-way scrambled version of your password, never the password itself.</li>
          <li><b>Security:</b> sign-in records and your IP address for a short time, to limit abuse.</li>
        </ul>

        <h2 className={h}>Why we are allowed to use it</h2>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>For early-access requests: your consent, which you give by submitting the form. You can ask us to delete it at any time.</li>
          <li>For business accounts: to provide the service you asked for.</li>
          <li>For the follow-up emails to your clients: the business's legitimate interest in answering a quote that the client asked for. These emails relate to that quote only, are sent in the business's name, and every one has an unsubscribe link. We don't send marketing to your clients.</li>
        </ul>

        <h2 className={h}>Unsubscribing</h2>
        <p className="mt-2">Anyone who clicks Unsubscribe in a follow-up email is added to a list that applies across the whole service. They are not emailed again, whichever business sent the quote, and their open quotes are paused.</p>

        <h2 className={h}>Cookies and fonts</h2>
        <p className="mt-2">We use one essential cookie to keep you signed in. We don't use advertising or tracking cookies. The "I'm not a robot" check on the sign-in and early-access forms is provided by Cloudflare, and the text fonts are loaded from Google Fonts, so those providers can see your IP address when a page loads.</p>

        <h2 className={h}>Who else handles data</h2>
        <p className="mt-2">We use a hosting provider, a database provider, an email delivery provider, a bot-check provider and, for paid plans, a payment provider to run the service. The payment provider handles your card details and receipts. We never see or store your card number. They process data on our behalf.</p>

        <h2 className={h}>Deleting your data</h2>
        <p className="mt-2">Signed-in users can delete their account and all its data in Settings. This removes your quotes and history. Clients can ask the business, or us, to remove their details.</p>

        <h2 className={h}>Your rights</h2>
        <p className="mt-2">You can ask to see, correct or delete your data, and you can complain to the Information Commissioner's Office (ico.org.uk) if you are unhappy with how it is handled.</p>
      </article>
        <aside className="hidden lg:block panel p-5 self-start sticky top-24">
          <h2 className="font-bold text-lg">The short version</h2>
          <ul className="mt-3 space-y-2 text-sm list-disc pl-5"><li>We keep only what you type in.</li><li>One essential cookie keeps you signed in. No tracking cookies.</li><li>Every follow-up email has an unsubscribe link, and it is respected straight away.</li><li>You can download or delete your data at any time.</li></ul>
        </aside>
      </div>
    </Shell>
  );
}
