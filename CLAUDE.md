# DJ Insanity site

Website for a working DJ: landing page with booking form, a live song-request page for guests at events (with optional tips), and a DJ dashboard. Built by the owner (Michael) for the DJ; not public-facing yet.

**An approved overhaul is in progress. Read `docs/OVERHAUL_PLAN.md` before changing anything** — it holds the architecture, the feature specs, the phase order, what is blocked on the owner, and the evidence behind each decision.

## Commands
```bash
npm run dev            # Vite dev server (front end only)
npm run build          # production build to dist/
npm run lint           # eslint, must be 0 problems
npm test               # vitest: shared contracts, functions (fake Firestore), page helpers, search fixtures
npm run dev:functions  # wrangler pages dev dist --port 8788 (build first; secrets from .dev.vars)
node scripts/visual-check.mjs <baseUrl> /path,/path [--wait ms]   # headless Chrome at 360/390/1280
```

## Layout
- `src/pages/landing/` — `Classic.jsx` (the original page, at `/` and `/classic`), `designs/a|b|c/` (three redesign options at `/designs/*`, each self-contained), `DesignSwitcher`.
- `src/pages/request/` — guest song requests (`/request`) and the tip thanks page (`/request/thanks`).
- `src/pages/dj/` — DJ dashboard (`/dj`); `data/` holds the Firebase source and a demo source behind one hook interface.
- `src/intro/` — Stardust intro overlay; `config.js` is the one place to change engine/speed.
- `src/content/site.js` — all landing copy; unconfirmed values are flagged `placeholder: true`.
- `src/components/` — `BookingForm`, `Sample`, `ui/` primitives (themed by `--ui-*` CSS variables). `src/index.css` is shared with Classic; don't restyle it.
- `shared/contracts.js` — request/booking validation used by BOTH the browser and `functions/`.
- `functions/api/*` — Pages Functions (status, search, requests, bookings); `functions/_lib/*` — Firestore REST client, search merge, rate limits (Firestore counter docs, no KV), notify (Resend + optional ntfy).
- `public/intros/` — temporary showcase of the four intro candidates; remove once the DJ picks.
- `worker/` — old Stripe Worker (`dj-insanity-tips`); retire after tips move to `functions/`.
- `docs/OVERHAUL_PLAN.md` — the plan, with a build log at the end.

## Deploying
- Cloudflare Pages project `dj-insanity-site`, connected to GitHub `DMasterGeneral/dj-insanity-site`. Pushing `main` deploys https://dj-insanity-site.pages.dev. Any other branch gets `https://<branch>.dj-insanity-site.pages.dev`.
- Overhaul work happens on the `overhaul` branch. Ask the owner before merging to `main`.
- Tag `v1-original` is the site before the overhaul. `/classic` must keep showing the original landing page until the owner says otherwise.

## Rules for this project
- The browser must not write to Firestore; visitor writes go through `functions/api/*`.
- Never write test data to the production Firestore (project `dj-insanity`), and never read booking contents (names, phone numbers) beyond what a task needs. Local `.dev.vars` / `.env.local` and Cloudflare Preview variables must point at a separate dev Firebase project.
- In visual checks of landing pages add `?intro=off` (or wait ~7 s); otherwise the intro overlay is reported as covering every control.
- Do not remove or change the Testimonials page content (owner's instruction, for now).
- Do not invent real-looking testimonials, venues or credentials; placeholders must be flagged in `src/content/site.js`.
- Tips stay hidden unless Stripe is configured and `tipsEnabled` is on. Stripe is in test mode.
- The owner often follows along from a phone with the browser pane hidden. Verify pages with headless Chrome (see section 5 of the plan) and send screenshots or preview links rather than describing visuals.
- Explain findings in plain language; the owner is technical but is relaying to a non-technical DJ.
