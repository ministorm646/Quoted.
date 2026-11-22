import Shell from "../components/Shell";
import { useConfig, usePageTitle } from "../api";

export default function Contact() {
  usePageTitle("Contact");
  const cfg = useConfig();
  const mail = cfg?.contactEmail;
  return (
    <Shell>
      <div className="max-w-xl">
        <h1 className="text-3xl font-extrabold">Contact</h1>
        <p className="mt-3">Questions, problems, or a request about your data? Send us an email.</p>
        {mail && <p className="mt-5"><a className="btn btn-primary" href={`mailto:${mail}`}>{mail}</a></p>}
        <h2 className="text-xl font-bold mt-8">Things we can help with</h2>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>Help using the service, or something that is not working.</li>
          <li>Seeing, correcting or deleting your personal data.</li>
          <li>If you got a follow-up email and no longer want them, use the Unsubscribe link at the bottom of that email. It stops all of them straight away.</li>
        </ul>
        <p className="mt-6 text-sm">Please don't send passwords or sign-in links by email. We will never ask for them.</p>
      </div>
    </Shell>
  );
}
