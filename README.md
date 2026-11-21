# QuoteMe (working name) on Vercel

Follow-ups for quotes that go quiet. Vite + React site, one Hono API served by a single Vercel Function, Turso (SQLite) database, Cloudflare Turnstile, Resend.

## Folder layout (keep it exactly like this)

    package.json, vercel.json, vite.config.mts, tsconfig.json, index.html, .gitignore, .env.example
    api/index.ts                 the one Vercel Function (all /api/... requests)
    server/                      index.ts, admin.ts, quotes.ts, settings.ts, db.ts, env.ts, schema.ts, types.ts
    server/lib/                  accounts.ts, crypto.ts, email.ts, security.ts, template.ts, util.ts
    src/                         main.tsx, api.ts, lib.ts, index.css
    src/components/              AppShell.tsx, Celebrate.tsx, Shell.tsx, StatusBadge.tsx, Turnstile.tsx
    src/pages/                   AddQuote, Admin, AdminStats, Dashboard, Landing, Privacy, QuoteDetail, Refer, Respond, Settings, SignIn, Unsubscribe, Verify (.tsx)
    public/                      manifest.webmanifest, icons, favicon.svg
    tests/ and docs/             automated tests; setup and compliance guides

The repo must have package.json and vercel.json at its top level, not inside a subfolder.

## Settings (Vercel > Project > Settings > Environment Variables)

See .env.example. The tables are created automatically the first time the API runs, so there is no SQL to paste.
Open /api/health on your site: {"ok":true} means setup is complete. If it says "Setup incomplete", it lists the missing settings by name.

## Notes

- DRY_RUN=true (the default) logs emails, including sign-in links, to Vercel's runtime logs instead of sending them. Set DRY_RUN=false once Resend is ready.
- Vercel's Hobby plan is for non-commercial use and allows cron jobs only once a day. The follow-up scheduler (Phase 3) needs something that runs every 15 minutes: Vercel Pro cron, or an outside scheduler that calls the API.

## Guides

- docs/SETUP.md: step-by-step setup, testing, domain, Resend, timer and going live.
- docs/COMPLIANCE.md: lawful basis and unsubscribe handling.

## Follow-up scheduler

- /api/cron runs the scheduler. It needs the setting CRON_SECRET and the header `Authorization: Bearer <CRON_SECRET>`. Vercel Cron sends that header itself.
- vercel.json asks Vercel to call it once a day (the most the Hobby plan allows). For every 15 minutes, add a free outside timer (for example cron-job.org) that calls https://YOUR-SITE/api/cron with that header, or use Vercel Pro.
- Emails only go out between 8am and 7pm UK time. Run the tests with `npm test`.
