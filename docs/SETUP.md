# Setup guide (phone friendly)

Everything below uses website dashboards. No command line.

## A. First test, with DRY_RUN on (nothing is emailed)

1. In Vercel, Settings, Environment Variables: check DRY_RUN is `true` and CRON_SECRET is set (a long random string).
2. Open YOUR-SITE/api/health. It should say {"ok":true}.
3. Sign in at /signin with your ADMIN_EMAIL. Find the link in Vercel, Logs: search `DRY_RUN`, copy the link after `LINKS:`.
4. In a private browser window, fill in the early-access form on the home page with a different email. In your signed-in window open /admin and press Approve. The invite link appears in the Logs too.
5. Sign in as that second person (invite link), then Add quote with a client email you own.
6. Open the quote and press "Email me a test". In test mode the email is logged, so copy its three button links from the Logs. Open the Yes link, press Confirm. Go back: the status says "Said yes" and the dashboard figures changed.
7. Open the Unsubscribe link from the same email and confirm. Add a second quote for the same client email. It shows a note that the client has unsubscribed, and no follow-up is ever sent for it.

## B. A domain, so emails can really be sent

Resend only lets you send to anyone from a domain you own and have verified.

1. Buy a domain from any registrar (a .co.uk is about 10 pounds a year).
2. Vercel, your project, Settings, Domains, Add. Follow the DNS instructions it shows, at your registrar. Wait until it says Valid.
3. Set APP_URL to https://YOUR-DOMAIN (no trailing slash). Redeploy.
4. Cloudflare Turnstile dashboard: add YOUR-DOMAIN to the widget's hostnames (or create real keys now) and put the real keys in TURNSTILE_SITE_KEY and TURNSTILE_SECRET.

## B2. Company details (recommended before launch)

In Vercel environment variables add, then redeploy:
- COMPANY_NAME, COMPANY_NUMBER and COMPANY_ADDRESS: your registered company details. They appear in the footer, the privacy page and the bottom of QuoteMe's own emails. UK businesses that trade online are expected to show these.
- SUPPORT_EMAIL: where customers write to you (the Contact page shows it). Defaults to FROM_EMAIL.

Share previews: when someone pastes your site link into a chat or social post, it shows a card with the image in public/og-image.png. The site address comes from APP_URL (or Vercel's production address) at build time, so redeploy after setting APP_URL or adding a domain.

Search engines: /robots.txt and /sitemap.xml are created automatically. Signed-in pages and client reply pages are marked so they are not indexed.

## C. Resend

1. Sign up at resend.com. Domains, Add Domain, enter YOUR-DOMAIN.
2. Resend shows DNS records (SPF, DKIM and a return path). Add each one exactly at the place your domain's DNS is managed (your registrar, or Vercel if you use Vercel's nameservers). Press Verify in Resend. This can take from minutes to a few hours.
3. Resend, API Keys, Create API Key with "Sending access" for your domain. Copy it once.
4. Vercel environment variables: RESEND_API_KEY = the key, FROM_EMAIL = hello@YOUR-DOMAIN (an address on the verified domain).

## D. The every-15-minutes timer

Vercel's free plan only runs a scheduled job once a day. Use a free outside timer:

1. Sign up at cron-job.org. Create cronjob.
2. URL: https://YOUR-DOMAIN/api/cron . Schedule: every 15 minutes.
3. Advanced, Headers: add `Authorization` with value `Bearer YOUR_CRON_SECRET` (the same value as in Vercel).
4. Save, then press Run now. The job history should show a 200 response with {"ok":true,...}.

## E. Go live

1. Do the test in section A once more, now with DRY_RUN still `true`.
2. Set DRY_RUN to `false` and redeploy.
3. Add a quote with your own email. Open the quote, press "Email me a test". A real email arrives. Check it looks right on your phone, tap each button and confirm.
4. Check the Resend dashboard shows the email as delivered, not bounced.
5. Optional: set PRODUCT_NAME if you rename the product, and edit name in public/manifest.webmanifest.

## F. Put it on your phone's home screen

iPhone (Safari): Share, Add to Home Screen. Android (Chrome): menu, Install app or Add to Home screen.

## If something goes wrong

- /api/health lists missing settings by name.
- Vercel, Logs, filter by the path to see errors. Copy the error text (never a sign-in link or secret).
