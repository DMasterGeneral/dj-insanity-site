# DJ Insanity site

Website for a working DJ: landing page with booking form, a live song-request page for guests at events (with optional tips), and a DJ dashboard. Built by the owner (Michael) for the DJ; not public-facing yet.

**An approved overhaul is in progress. Read `docs/OVERHAUL_PLAN.md` before changing anything** — it holds the architecture, the feature specs, the phase order, what is blocked on the owner, and the evidence behind each decision.

## Commands
```bash
npm run dev      # Vite dev server
npm run build    # production build to dist/
npm run lint     # eslint
```

## Layout
- `src/` — React 19 + Vite + Tailwind 4 (theme tokens live in `src/index.css` under `@theme`; `tailwind.config.js` is unused).
- `public/intros/` — temporary showcase of four intro-animation candidates (self-contained HTML, canvas). Source for the eventual `src/intro/` port.
- `worker/` — old stand-alone Stripe Worker (`dj-insanity-tips`), deployed by hand. Being replaced by `functions/`.
- `docs/OVERHAUL_PLAN.md` — the plan.

## Deploying
- Cloudflare Pages project `dj-insanity-site`, connected to GitHub `DMasterGeneral/dj-insanity-site`. Pushing `main` deploys https://dj-insanity-site.pages.dev. Any other branch gets `https://<branch>.dj-insanity-site.pages.dev`.
- Overhaul work happens on the `overhaul` branch. Ask the owner before merging to `main`.
- Tag `v1-original` is the site before the overhaul. `/classic` must keep showing the original landing page until the owner says otherwise.

## Rules for this project
- The browser must not write to Firestore; visitor writes go through `functions/api/*`.
- Never write test data to the production Firestore, and never read booking contents (names, phone numbers) beyond what a task needs.
- Do not remove or change the Testimonials page content (owner's instruction, for now).
- Do not invent real-looking testimonials, venues or credentials; placeholders must be flagged in `src/content/site.js`.
- Tips stay hidden unless Stripe is configured and `tipsEnabled` is on. Stripe is in test mode.
- The owner often follows along from a phone with the browser pane hidden. Verify pages with headless Chrome (see section 5 of the plan) and send screenshots or preview links rather than describing visuals.
- Explain findings in plain language; the owner is technical but is relaying to a non-technical DJ.
