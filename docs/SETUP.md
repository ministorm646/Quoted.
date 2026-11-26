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
- COMPANY_NAME, COMPANY_NUMBER and COMPANY_ADDRESS: your registered company details. They appear in the footer, the privacy page and the bottom of Quoted's own emails. UK businesses that trade online are expected to show these.
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

## G. Passwords and signing in

- Invited people sign in once with the emailed link, then are asked to create a password. After that they sign in with email and password. "Remember me" keeps them signed in for 30 days; without it they are signed out when the browser closes (and after 12 hours at most).
- Forgot a password? On the sign-in page choose "Email me a link", sign in, and set a new one. Setting a new password signs out other devices.
- Too many wrong tries (8 for one email in 15 minutes) pauses sign-in for that email. Passwords are stored only as salted scrypt hashes.
- The first time the site starts after this update, it adds the new columns to your existing database by itself. Existing people keep their accounts and are marked as founding members.

## H. Subscriptions with Lemon Squeezy

Nothing changes for anyone until you set BILLING_ENABLED to true.

1. Sign up at lemonsqueezy.com and create a store. Live payments need their business verification, so start early.
2. Create a product (for example Quoted) with two subscription variants: Monthly and Annual. The prices must match PRICE_MONTHLY and PRICE_ANNUAL in Vercel (default 19 and 190 pounds, change them to what you want).
3. For each variant copy its checkout link and its variant id. Put the links in LS_CHECKOUT_MONTHLY and LS_CHECKOUT_ANNUAL, and the ids in LS_VARIANT_MONTHLY and LS_VARIANT_ANNUAL.
4. Founding discount: create a discount code (for example FOUNDER30) for the percentage you want, applying to subscription renewals for as long as the person stays subscribed, limited to your product. Put the code in FOUNDING_DISCOUNT_CODE and the percentage in FOUNDING_DISCOUNT_PERCENT. Everyone approved during early access is a founding member and gets the code applied at checkout.
5. Webhook: in Lemon Squeezy, Settings, Webhooks, add https://YOUR-DOMAIN/api/billing/webhook. Choose a long random signing secret, put the same value in LS_WEBHOOK_SECRET, and tick all the subscription events.
6. Use Lemon Squeezy's test mode first. Sign in as a test account, open Plan and billing, choose a plan and pay with their test card. Within a few seconds the page should show "You're subscribed". Check the discount shows on the checkout page for a founding member.
7. When you are ready, set BILLING_ENABLED to true and redeploy. From then on, businesses whose free period has ended cannot add quotes and are not followed up until they subscribe. They can still sign in, view and download everything.

## I. Launch day (ending early access)

This is the one-click switch. Do it when you are ready to charge.

1. Finish sections B, C, D and H (domain, Resend, the timer, Lemon Squeezy), then add real Turnstile keys and your company details. Set DRY_RUN to false and redeploy.
2. Sign in as the admin and open Admin, then Launch (YOUR-SITE/admin/launch). Every item marked "Needed" must show a tick. Fix any that don't in Vercel (Environment Variables), redeploy, and reload the page.
3. Rehearse first if you like: set BILLING_ENABLED to true for a test account to see the paywall, then set it back.
4. Type LAUNCH and press the button. What changes straight away, with no redeploy:
   - The early-access form on the home page is replaced by a free-trial sign-up (the length is TRIAL_DAYS, 14 by default, 0 for none).
   - Prices appear on the home page and the Plan page.
   - Founding members (everyone approved during early access) keep their free period, then get their discount code at checkout.
   - New customers get the trial, then pay full price.
   - Anyone whose free period has ended cannot add quotes and is not followed up until they subscribe. They can still sign in, view and download everything.
5. Press "Send the next 25" until it says everyone has been told. Each founding member gets one email: early access has ended, when their free period finishes, and their discounted price.
6. Check it as a customer: in a private window sign up with a new email, follow the link, add a quote, then use the Plan page to subscribe (use Lemon Squeezy's test mode first).
7. To undo: type REOPEN on the same page. Sign-up closes, the paywall turns off and the request form returns. Nothing is deleted.

## If something goes wrong

- /api/health lists missing settings by name.
- Vercel, Logs, filter by the path to see errors. Copy the error text (never a sign-in link or secret).
