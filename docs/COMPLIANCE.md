# Lawful basis and unsubscribes (UK GDPR and PECR)

This is a working note, not legal advice. Have it checked before real customers use the service.

## Who is who
- The business using the service decides whom to follow up and why. The service sends emails on its behalf.
- Review whether you are the controller or a processor for client data, and set your contracts and privacy page to match.

## Lawful basis
- Early-access requests: consent (the person submits the form). Only invite and sign-in emails are ever sent to them.
- Business accounts: contract (providing the service they asked for).
- Follow-ups to a business's clients: the business's legitimate interest in answering a quote the client asked for. Keep a record of this assessment.

## PECR (email marketing rules)
- Follow-ups are about the client's own quote request, not marketing. Keep the wording to that quote only.
- Sole traders and partnerships are treated as individuals under PECR, so every email has a working unsubscribe link and honouring it is immediate.
- Do not add promotional content to the follow-up template.

## Unsubscribe handling
- Every follow-up has an unsubscribe link and a List-Unsubscribe header. The link opens a confirm page (so mail scanners cannot unsubscribe people by accident). Confirming adds the address to a service-wide list and pauses all of that address's open quotes.
- The scheduler checks that list before every send. An unsubscribed address is never emailed, whichever business logs a quote for it.
- The unsubscribe list keeps only the email address and the date, as a suppression list. It is not removed when a business deletes its account, because removing it would allow emailing that person again. Say so in the privacy page.

## Data kept and deleting it
- Stored: client name and email, amount, one-line job description, event history, sign-in and rate-limit records.
- Account deletion (Settings) removes the business, its quotes and history, and sign-in records.

## Passwords and payments
- Passwords are stored only as salted scrypt hashes. Sign-in is rate limited and protected by the bot check.
- Card details never reach this service. The payment provider takes payment and sends receipts, and acts as seller of record, which is why it holds the payment data. Add it to your list of processors.
- The privacy page and terms mention payments. Check them again with your adviser before you switch billing on.

## The launch email
The email to founding members tells existing customers about a change to their own account (the end of early access, when their free period finishes and their price). Keep it factual and about their account, and do not add promotions for other things. Check the wording with your adviser, and note that these people can reply to opt out of further messages.

## Legal pages need a proper review
The privacy page (/privacy) and terms of use (/terms) are plain-English drafts written to match how the service works. Before taking payments or signing up the public, have them reviewed by a solicitor, and add your company details (COMPANY_NAME, COMPANY_NUMBER, COMPANY_ADDRESS) so they show on the site.

## Other things to check
- Register with the ICO and pay the data protection fee if you are required to.
- Have a data processing agreement with the hosting, database and email providers.
