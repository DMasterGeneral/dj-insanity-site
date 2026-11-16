# DJ Insanity

Website for a working DJ, live at https://dj-insanity-site.pages.dev. It has three parts:

- **Landing page and booking** (`/`): who the DJ is, what they play, and a booking form.
- **Live song requests** (`/request`): guests at an event search for a song and send it to the DJ (tips are built but stay hidden until Stripe is set up).
- **DJ dashboard** (`/dj`): the DJ signs in to see and work through requests and bookings, switch live mode on and off, and show a QR code for the request page.

An overhaul is in progress. The plan, with the architecture, phase order and what is waiting on the owner, is in [`docs/OVERHAUL_PLAN.md`](docs/OVERHAUL_PLAN.md). Read it before changing anything; `CLAUDE.md` has the project rules.

## Stack

- React 19 + Vite + Tailwind 4 (theme tokens in `src/index.css` under `@theme`), plain JavaScript with JSDoc types.
- Cloudflare Pages for hosting, Pages Functions (`functions/`) for the API.
- Firebase: Firestore for data, Auth for the DJ login. The browser never writes to Firestore; visitor writes go through `/api/*`, which talks to Firestore over REST as a service account. Security rules are in `firestore.rules`.
- Stripe (test mode) for tips, Cloudflare Turnstile for form protection, Resend for booking emails.
- Vitest for tests, ESLint for lint.

## Layout

```
src/
  App.jsx                router; every route is lazy-loaded
  pages/landing/         Classic.jsx (the original landing page), Designs.jsx + designs/a|b|c (redesign options)
  pages/request/         song request page, search, thank-you page
  pages/dj/              DJ dashboard (data/ holds the Firebase and demo data sources)
  intro/                 landing-page intro animation; config.js picks the engine and speed
  content/site.js        all landing copy and data; unconfirmed values are flagged as placeholders
  components/ui/         Button, Field, Dialog, Toast
  components/            booking form and the Classic page's cards
  lib/                   API client, Turnstile loader, live-status hook
shared/contracts.js      request/booking shapes and validation shared by the front end and the API
functions/api/           status.js, search/deezer.js, requests/index.js, requests/[id].js, bookings.js, [[catchall]].js
functions/_lib/          firestore.js, guard.js, ratelimit.js, notify.js, settings.js, search/
scripts/                 visual-check.mjs, make-admin.mjs, record-search-fixtures.mjs, make-share-images.mjs
tests/                   Vitest tests (functions, shared, request, dj) and recorded search fixtures
public/                  favicon, share image, _headers, robots.txt, intros/ (temporary intro showcase)
worker/                  old stand-alone Stripe Worker, being replaced by functions/
```

API endpoints (all JSON, same-origin):

| Endpoint | What it does |
|---|---|
| `GET /api/status` | Public settings: live, event name, requests open, tips enabled. Cached 15 s. |
| `GET /api/search/deezer?q=` | Deezer's song hits, unmerged (edge-cached 6 h). The request page fetches iTunes itself and merges the two in the browser, because iTunes answers 429 to Cloudflare's shared server IPs. |
| `POST /api/requests` | Create a song request. |
| `GET /api/requests/:id` | Status of one request, for the thank-you page. |
| `POST /api/bookings` | Create a booking and email the DJ. |
| anything else under `/api/` | JSON 404. |

## Commands

```bash
npm install
npm run dev            # Vite dev server (front end only; /api is not served)
npm run build          # production build to dist/
npm run lint           # ESLint
npm test               # Vitest, once
npm run dev:functions  # serve dist/ with the Pages Functions on http://localhost:8788
                       # (run `npm run build` first; reads server variables from .dev.vars)
npm run check:visual -- <baseUrl> <path>[,<path>...]
                       # headless-Chrome check at 360x640, 390x844 and 1280x800: screenshots to
                       # .visual/, fails on console errors or horizontal overflow
```

Scripts run with Node directly:

```bash
# Give a Firebase Auth user access to the dashboard (writes admins/{uid}).
# Refuses the production project unless --production is passed.
node scripts/make-admin.mjs --key <service-account.json> --uid <uid> [--email <email>]

# Re-record the Deezer/iTunes responses the search tests use.
node scripts/record-search-fixtures.mjs ["some song" ...]

# Re-render public/og-image.png and public/apple-touch-icon.png.
node scripts/make-share-images.mjs
```

The Chrome-based scripts use the default macOS Chrome; set `CHROME=/path/to/chrome` elsewhere.

## Environment variables

There are two sets, and both have example files:

- **Front end**, `.env.local` (copy `.env.example`). Build-time `VITE_*` values that end up in the browser, so nothing secret: the Firebase web config, the Stripe publishable key, the Turnstile site key.
- **Server**, `.dev.vars` (copy `.dev.vars.example`), read by `npm run dev:functions`. Secrets for the functions: `FIREBASE_SERVICE_ACCOUNT`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `NOTIFY_EMAIL_TO`, `TURNSTILE_SECRET_KEY`, `HASH_SALT`, `PUSH_URL`.

On Cloudflare, both sets are set in Pages → Settings → Variables and Secrets, separately for Production and Preview.

**Local and Preview values must point at a DEV Firebase project, never the production project `dj-insanity`.** Use Stripe test keys and the Turnstile always-pass test keys (in the example files). Every function degrades cleanly when its variable is missing, so leave unused ones blank.

## Deploys

The Cloudflare Pages project `dj-insanity-site` is connected to GitHub. Pushing `main` deploys https://dj-insanity-site.pages.dev; any other branch gets its own preview at `https://<branch>.dj-insanity-site.pages.dev` (overhaul work: https://overhaul.dj-insanity-site.pages.dev). There is no `wrangler.toml`; build settings live in the Pages dashboard. GitHub Actions runs lint, tests and build on every push and pull request. Ask the owner before merging to `main`. Tag `v1-original` is the site before the overhaul.

## Review URLs

Add these to a preview URL (or localhost):

| Path | Shows |
|---|---|
| `/designs/a`, `/designs/b`, `/designs/c` | The three landing-page redesign options, with a switcher. |
| `/classic` | The original landing page (also at `/` until a design is chosen). |
| `/intros/` | The four intro-animation candidates. |
| `/?intro=off` | Landing page with no intro. |
| `/?intro=stardust&speed=0.65` | Always play that intro at that speed. |
| `/request?preview=open` | The request page as if requests were open (not on production). |
| `/dj?demo=1` | The dashboard with demo data, no login (not on production). |
