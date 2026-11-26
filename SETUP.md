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

## C. Resend (free plan is enough to start)

The free plan allows 100 emails a day, 3,000 a month, 2 sends a second and one domain. Quoted is built around that: DAILY_SEND_CAP defaults to 60 follow-ups a day so sign-in links and client notices always have room, sends are spaced out automatically, and if Resend ever answers "slow down" the follow-up simply waits for the next timer run (it is not counted as a failure). Check resend.com/pricing for the current limits.

1. Sign up at resend.com (free). Domains, Add Domain, enter YOUR-DOMAIN.
2. Resend shows DNS records (SPF, DKIM and a return path). Add each one exactly at the place your domain's DNS is managed (your registrar, or Vercel if you use Vercel's nameservers). Press Verify in Resend. This can take from minutes to a few hours.
3. Resend, API Keys, Create API Key with "Sending access" for your domain. Copy it once.
4. Vercel environment variables: RESEND_API_KEY = the key, FROM_EMAIL = hello@YOUR-DOMAIN (an address on the verified domain).
5. Leave DAILY_SEND_CAP alone (60) on the free plan. If you upgrade Resend later, raise it.

Until a domain is verified, Resend only lets you send to your own Resend account email, so real testing with other people needs step 1 to 4 first.

## D. The every-15-minutes timer (free, from cron-job.org)

Vercel's free plan only runs a scheduled job once a day, so use a free outside timer. Quoted only sends between 8am and 7pm UK time, and each follow-up is claimed before it is sent, so running the timer often (or twice at once) can never send an email twice.

1. In Vercel, Settings, Environment Variables, make sure CRON_SECRET is a long random string (20+ characters). Redeploy if you changed it.
2. Sign up at cron-job.org (free). Cronjobs, Create cronjob.
3. Title: Quoted follow-ups. URL: https://YOUR-DOMAIN/api/cron . Execution schedule: every 15 minutes.
4. Advanced, Headers: add the name `Authorization` with the value `Bearer YOUR_CRON_SECRET` (the same value as in Vercel, with the word Bearer and a space before it).
5. Request method GET. Save, then press "Test run". The result should be 200 with {"ok":true,...}. A 403 means the secret does not match; a 503 means CRON_SECRET is not set in Vercel.
6. Turn on "Notify me when the job fails" in the job's settings so you hear about it if the timer stops.

The daily job in vercel.json stays as a harmless back-up. Each run handles up to 20 due follow-ups, and the rest wait for the next run.

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

## H. Subscriptions with Stripe (work in progress, leave switched off for now)

The Stripe code is in place but dormant. Until you set STRIPE_SECRET_KEY nothing in the app can take a payment: the Plan page shows no pay buttons and the checkout route answers "Payments are not switched on yet". You do not need a Stripe account during early access. Do this section only once you are ready to charge.

1. Sign up at stripe.com. Live payments need their business verification, so start early.
2. Products, add a product (for example Quoted) with two recurring prices in GBP: monthly and yearly. They must match PRICE_MONTHLY and PRICE_ANNUAL in Vercel (default 19 and 190). Copy each price id (starts with price_) into STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL.
3. Founding discount: Products, Coupons, create a percentage coupon (for example 30% off) with duration Forever. Copy its id into STRIPE_COUPON_FOUNDING and put the same percentage in FOUNDING_DISCOUNT_PERCENT. Founding members get it applied automatically at checkout.
4. Customer portal: Settings, Billing, Customer portal. Switch it on and allow cancelling and updating the card. This powers the "Manage billing and invoices" button.
5. Webhook: Developers, Webhooks, Add endpoint, URL https://YOUR-DOMAIN/api/billing/webhook. Select these events: customer.subscription.created, customer.subscription.updated, customer.subscription.deleted. Copy the signing secret (starts whsec_) into STRIPE_WEBHOOK_SECRET.
6. Put your secret key in STRIPE_SECRET_KEY. Start with the test one (sk_test_...) in Stripe's test mode, redeploy, and set BILLING_ENABLED to true for a rehearsal. Open Plan and billing, choose a plan and pay with the test card 4242 4242 4242 4242. Within a few seconds the page should show "You're subscribed". Check the founding discount shows on the Stripe checkout page for a founding member.
7. When you are ready for real money, swap in the live key (sk_live_...), the live price ids, coupon and webhook secret, and redeploy. The Launch page only counts Stripe as ready with a live key.

Known gaps while this is work in progress: it has never been run against real Stripe, and a failed payment is shown as "past due" only after Stripe's own retry period, as Stripe reports it.

## I. Launch day (ending early access)

This is the one-click switch. Do it when you are ready to charge.

1. Finish sections B, C, D and H (domain, Resend, the timer, Stripe), then add real Turnstile keys and your company details. Set DRY_RUN to false and redeploy.
2. Sign in as the admin and open Admin, then Launch (YOUR-SITE/admin/launch). Every item marked "Needed" must show a tick. Fix any that don't in Vercel (Environment Variables), redeploy, and reload the page.
3. Rehearse first if you like: set BILLING_ENABLED to true for a test account to see the paywall, then set it back.
4. Type LAUNCH and press the button. What changes straight away, with no redeploy:
   - The early-access form on the home page is replaced by a free-trial sign-up (the length is TRIAL_DAYS, 14 by default, 0 for none).
   - Prices appear on the home page and the Plan page.
   - Founding members (everyone approved during early access) keep their free period, then get their discount code at checkout.
   - New customers get the trial, then pay full price.
   - Anyone whose free period has ended cannot add quotes and is not followed up until they subscribe. They can still sign in, view and download everything.
5. Press "Send the next 25" until it says everyone has been told. Each founding member gets one email: early access has ended, when their free period finishes, and their discounted price.
6. Check it as a customer: in a private window sign up with a new email, follow the link, add a quote, then use the Plan page to subscribe (use Stripe's test mode first).
7. To undo: type REOPEN on the same page. Sign-up closes, the paywall turns off and the request form returns. Nothing is deleted.

## If something goes wrong

- /api/health lists missing settings by name.
- Vercel, Logs, filter by the path to see errors. Copy the error text (never a sign-in link or secret).
