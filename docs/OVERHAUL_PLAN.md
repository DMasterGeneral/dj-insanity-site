# DJ Insanity site — overhaul architecture and build plan

Written 2026-11-15. Status (2026-11-16): **Phases 0, 1, 2, 4, 5 and 6 are built on the `overhaul` branch; Phase 3 (tips) and parts of Phase 7 wait on the owner.** See section 9 for what was built, what changed from this plan, and what is still open.

Related: `CLAUDE.md` (repo conventions), git tag `v1-original` (the site exactly as it was before this work).

---

## 1. Where things stand

| Item | State |
|---|---|
| Live site | https://dj-insanity-site.pages.dev (Cloudflare Pages, auto-deploys `main`). Not public-facing yet. |
| Branch previews | `https://<branch>.dj-insanity-site.pages.dev` |
| Intro showcase | Live at `/intros/` — four candidates, five speeds. The DJ has not picked one yet. |
| Original site | Tagged `v1-original`. |
| Tip-payment Worker | `dj-insanity-tips`, deployed by hand, Stripe **test** mode. To be retired (section 3). |
| GitHub Pages copy | Broken (serves unbuilt source). To be switched off in Phase 7. |

### Decisions the owner has made
- Overhaul approved in full. Implementation will be done by a different model session, hence this document.
- **Search:** owner first asked for "Deezer first, iTunes backup". Testing (section 4.1) showed Deezer alone misses major originals. The owner then proposed making iTunes the base and bringing Deezer in for explicit songs. Section 4.1 implements that: **iTunes is the backbone; Deezer is a helper with two narrow jobs.**
- **Tips:** stay on Stripe. The DJ still has to finish Stripe onboarding. No Venmo/Cash App interim.
- **Bookings:** notify by **email**. Text only if free (see 4.3 — true SMS is not free; a free push alternative is proposed and awaits a yes/no).
- **Landing page:** redesign approved. Build **several design options live on the site**, keep the original reachable, owner picks one.
- **Mac Miller testimonials page:** leave in place for now. Do not remove or rewrite it.
- **Intro:** owner favours Stardust, Oscilloscope a close second; final choice and speed come from the DJ via `/intros/`.

### Still open (do not guess — ask the owner)
1. Which intro and at what speed.
2. Text alerts: accept a free push app (ntfy or Telegram) instead of SMS, or pay for SMS, or email only.
3. Real content: photos, bio, city, real testimonials, gear list, socials, contact email. Until supplied, use clearly marked placeholders (section 4.7).
4. Whether the DJ will get a domain. Not required by this plan.

---

## 2. What the review found (evidence, so nobody re-derives it)

**Broken or risky**
- **The database currently rejects every visitor write.** On 2026-11-15 an unauthenticated request in the exact format the site sends was refused (`403 PERMISSION_DENIED`), with and without a tip. Reads are refused too. So a made-up tip cannot be saved — but neither can a real song request. Bookings were not tested but go through the same path. The Firestore rules are not in the repo; the likely cause is expired "test mode" rules. The front end swallows these errors, so visitors see nothing.
- **Tip design is unsafe once rules are opened again.** `PaymentSuccess.jsx` writes the request (including the tip amount) from the browser after trusting `redirect_status=succeeded` in the URL. Nothing checks with Stripe. Pending requests live in `sessionStorage`, so a payment that returns in another tab loses the request and shows "All Set!".
- **The Worker** allows any origin, has no rate limit, and does not tie a PaymentIntent to a request.
- **Search:** iTunes ignores `explicit=Yes` (identical results with Yes / No / absent). Music search returns only clean or non-explicit versions with censored titles. All four Invidious fallback hosts are dead. The Worker's `/itunes` proxy exists but the front end never calls it. No debounce, no cancellation of stale searches, search on Enter only.
- **Bookings** are saved (when writes work) but shown nowhere and notify no one.
- **Silent failures:** `UserView.submitToFirebase` and `BookingCard.handleSubmit` catch errors and only `console.error`.
- **Intro:** 7.8 s, not skippable, replays on every return to `/`, blocks all content.
- **Phone layout:** nav clips "Contact"; the floating button covers "Submit Request"; gear details are hover-only.
- **Dead controls:** Book Now, About, Contact. "Live Now" is hard-coded.
- **Firebase Auth sign-up is probably open** (email/password sign-up is on by default). Any rule of the form `request.auth != null` would then let a stranger create an account and read bookings.

**Quality**
- One 627 KB script; Stripe and Firebase load on the landing page (`loadStripe` runs at import time in `TipDJ.jsx`).
- 6 lint errors; `npm audit` reports 6 issues (react-router, websocket-driver), all fixable by updating.
- Leftovers: `src/App.css`, `src/assets/react.svg`, `public/vite.svg` favicon, template `README.md`, unused `tailwind.config.js` (Tailwind 4 reads `@theme` in `src/index.css`; the token there should be `--font-sans`, not `--font-family-sans`), `hover:glow-blue` is not a real utility.
- `public/assets/celeb-photo.png` is 6 MB.
- No labels on form fields, icon buttons without accessible names, no focus styles, modal without focus trap or Escape, marquee ignores reduced motion.
- No social preview tags, hard-coded "© 2025".

---

## 3. Target architecture

Keep the stack: **React 19 + Vite + Tailwind 4, Firebase (Firestore + Auth), Stripe, Cloudflare Pages.** No framework change, no TypeScript migration (plain JS with JSDoc types on shared shapes).

The one structural change: **the browser never writes to the database.** Every visitor write goes through server functions that validate, rate-limit and (for tips) confirm with Stripe.

```
Browser (React SPA)
  ├─ GET  /api/status ───────────────┐
  ├─ GET  /api/search?q= ────────────┤   Cloudflare Pages Functions  (functions/api/*)
  ├─ POST /api/requests ─────────────┤     ├─ Deezer + iTunes (search, cached at the edge)
  ├─ GET  /api/requests/:id ─────────┤     ├─ Stripe REST (PaymentIntents) + webhook verify
  ├─ POST /api/bookings ─────────────┤     ├─ Firestore REST as a service account
  └─ Stripe.js (Payment / Express    │     ├─ Turnstile verify, KV rate limits
     Checkout Elements)              │     └─ Resend (email) [+ optional push]
Stripe ── POST /api/stripe/webhook ──┘
DJ dashboard ── Firebase Auth + Firestore SDK (read, status updates only; rules restrict to admins)
```

### 3.1 Why Pages Functions
The project is already a git-connected Pages project. A `functions/` folder deploys with every push — no Wrangler login, no separately deployed Worker. Cloudflare now steers *new* projects to Workers with static assets and says Pages "continues to work"; migrating is optional later and out of scope. The stand-alone `dj-insanity-tips` Worker is retired once Phase 3 ships.

Considered and rejected: moving data to Cloudflare D1 (would drop Firebase's realtime listener and its existing DJ login for little gain); keeping client-side writes with stricter rules (cannot verify payment).

### 3.2 Repo layout (target)
```
functions/
  api/
    status.js              GET   public settings
    search.js              GET   merged song search
    requests/index.js      POST  create request (and PaymentIntent when tipping)
    requests/[id].js       GET   status for the thank-you page
    bookings.js            POST  create booking + notify
    stripe/webhook.js      POST  Stripe events
  _lib/
    firestore.js           service-account token + REST helpers
    stripe.js              REST calls + webhook signature check (WebCrypto)
    search/                deezer.js, itunes.js, merge.js, junk.js
    notify.js              email (Resend) + optional push
    guard.js               Turnstile, rate limit, input validation, JSON responses
src/
  main.jsx, App.jsx        router with lazy routes
  content/site.js          ALL landing copy/data in one place (placeholders flagged)
  intro/                   IntroOverlay.jsx + engines/ (ported from public/intros)
  pages/
    landing/               Classic.jsx (original), DesignA.jsx, DesignB.jsx, DesignC.jsx, shared sections
    request/               RequestPage.jsx, SongSearch.jsx, TipSheet.jsx, Thanks.jsx
    dj/                    Dashboard.jsx, RequestsTab.jsx, BookingsTab.jsx, Login.jsx
    TestimonialsPage.jsx   (unchanged content)
  components/              BookingForm.jsx, ui primitives (Button, Field, Dialog, Toast)
  lib/                     api.js (fetch wrapper), firebase.js (auth + dashboard reads only), useDebounced.js …
public/
  intros/                  showcase (keep until the intro is chosen, then remove in Phase 7)
  _redirects, _headers
firestore.rules
wrangler.toml              pages_build_output_dir = "dist", compatibility_date, KV binding
tests/                     vitest unit tests + recorded search fixtures
scripts/                   make-admin.mjs, visual-check.mjs (headless Chrome over CDP)
docs/OVERHAUL_PLAN.md
```
`wrangler.toml` becomes the source of truth for Pages settings once present — generate it with `npx wrangler pages download config dj-insanity-site` rather than by hand, then add bindings. If that needs a Wrangler login the owner has not done, configure the KV binding in the dashboard instead and skip the file.

### 3.3 Data model (Firestore)
```
requests/{id}
  song:      { title, artist, album?, artworkUrl?, explicit: bool, durationSec?,
               source: 'deezer'|'itunes'|'both'|'typed'|'link', deezerId?, itunesId?, isrc?, url? }
  note?:     string ≤ 140          requesterName?: string ≤ 40
  status:    'awaiting_payment' | 'pending' | 'played' | 'dismissed'
  tip:       { amountCents: int, state: 'none'|'pending'|'paid'|'failed', paymentIntentId? }
  createdAt, updatedAt: timestamp   clientHash, ipHash: string (salted SHA-256, for rate limits only)

bookings/{id}
  name, phone, email, contactPreference: 'call'|'text'|'email'
  date (YYYY-MM-DD), startTime, endTime (HH:mm), eventType, location?, notes? ≤ 1000
  status: 'new'|'contacted'|'booked'|'declined'|'archived'      createdAt, updatedAt

settings/public        { live: bool, eventName?: string, requestsOpen: bool, tipsEnabled: bool, updatedAt }
admins/{uid}           { email }            // presence = may use the dashboard
stripeEvents/{eventId} { processedAt }      // webhook idempotency
```
Old documents (`type/content/title/tip:number/timestamp`) exist from 2025 testing. The dashboard must tolerate them or Phase 1 deletes them — ask the owner before deleting.

### 3.4 Security rules (`firestore.rules`, checked in)
```
function isAdmin() { return request.auth != null
  && exists(/databases/$(database)/documents/admins/$(request.auth.uid)); }

match /requests/{id}  { allow read: if isAdmin();
                        allow update: if isAdmin()
                          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','updatedAt']);
                        allow create, delete: if false; }
match /bookings/{id}  { allow read: if isAdmin();
                        allow update: if isAdmin()
                          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status','updatedAt']);
                        allow create, delete: if false; }
match /settings/{doc} { allow read, write: if isAdmin(); }
match /admins/{uid}   { allow read: if request.auth != null && request.auth.uid == uid;   // own entry only (dashboard gate)
                        allow write: if false; }
match /{document=**}  { allow read, write: if false; }
```
The service account used by the functions bypasses rules. Also **turn off public sign-up** in Firebase Auth (owner action, section 7).

### 3.5 API contracts
All responses are JSON `{ ok: true, … }` or `{ ok: false, error: { code, message } }` with a real HTTP status. Same-origin only; no CORS headers needed.

| Endpoint | Request | Response | Notes |
|---|---|---|---|
| `GET /api/status` | — | `{ live, eventName, requestsOpen, tipsEnabled }` | Cached 15 s at the edge. `tipsEnabled` is also false when Stripe secrets are absent. |
| `GET /api/search?q=` | `q` 2–80 chars | `{ results: Song[] }` (max 8) | Edge cache 6 h per normalised query, browser cache 5 min. |
| `POST /api/requests` | `{ song \| typed, note?, requesterName?, tipCents, clientId, turnstileToken }` | `{ id, status, clientSecret? }` | Refused when `requestsOpen` is false. `tipCents` 0 or 100–20000. With a tip: creates the PaymentIntent (metadata `requestId`), writes the doc as `awaiting_payment`, returns `clientSecret`. |
| `GET /api/requests/:id` | — | `{ status, tipState }` | IDs are 20+ random chars, so this is not enumerable. Used by the thank-you page to poll. |
| `POST /api/bookings` | form fields + `turnstileToken` | `{ id }` | Validates, writes, then sends notifications. A notification failure must not fail the booking; log it and set `notifyError` on the doc. |
| `POST /api/stripe/webhook` | Stripe event | `200` | Verify `Stripe-Signature` (HMAC-SHA256, 5 min tolerance). On `payment_intent.succeeded`: in one Firestore transaction, skip if `stripeEvents/{id}` exists; set request `status: 'pending'`, `tip.state: 'paid'`, `tip.amountCents = amount_received`. On `payment_intent.payment_failed`: `tip.state: 'failed'`. |

**Abuse limits** (KV counters keyed by `ipHash`, fixed windows): requests 6 per 10 min, bookings 3 per hour. Search is not counted (cached, read-only). Turnstile runs in invisible mode on the two POST forms so guests at a party see no challenge.

### 3.6 Secrets and variables (Cloudflare Pages → Settings → Variables and Secrets; set for **both** Production and Preview)
| Name | Kind | Used by |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | secret (the JSON key) | all functions that touch Firestore |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | secret | tips |
| `RESEND_API_KEY`, `NOTIFY_EMAIL_TO` | secret / plain | booking email |
| `TURNSTILE_SECRET_KEY` | secret | form protection |
| `HASH_SALT` | secret | ip/client hashing |
| `PUSH_URL` (optional) | secret | ntfy topic URL or Telegram bot URL |
| `VITE_FIREBASE_*`, `VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_TURNSTILE_SITE_KEY` | build-time plain | front end |
Local development: `.dev.vars` (git-ignored) and `npx wrangler pages dev -- npm run dev`. Every function must degrade cleanly when its secret is missing (tips hidden, notifications skipped, clear 503 for writes) so previews work before the owner finishes setup.

---

## 4. Feature specifications

### 4.1 Song search
**Test results that drive the design (2026-11-15, 58 queries).**
- Deezer returns explicit originals with real titles and has an explicit flag, ISRC, popularity `rank`, artwork and preview. iTunes never returns the explicit version and censors titles.
- Deezer **misses major originals** from this region: "Mr. Brightside" (remixes only), "Smells Like Teen Spirit" (no Nirvana), "In Da Club" (covers only), "Shots". iTunes had all four.
- iTunes misses others: "Tití Me Preguntó" (lullaby covers), "Blinding Lights" original, "I Wanna F*** You" (Akon).
- Deezer sends no cross-origin header (must be proxied) and limits to 50 calls per 5 s per IP (error code 4). iTunes returned one empty body in ~40 calls.
- Neither is good alone; together they covered every query tried.

**Server (`functions/api/search.js`)**
1. Normalise `q` (trim, collapse whitespace, lower-case, strip control chars). Reject < 2 chars.
2. Return the edge-cached response if present (`caches.default`, key = normalised query).
3. Fetch both in parallel with a 2.5 s timeout each, `Promise.allSettled`:
   `https://api.deezer.com/search?q=…&limit=15` and `https://itunes.apple.com/search?term=…&entity=song&limit=15&country=US`.
4. Map each hit to `Song`. Build a match key: title with `(feat. …)`, `[…]`, "- Single", "Remaster(ed) YYYY", "Radio Edit", "Explicit/Clean" tags removed, punctuation dropped, plus the first credited artist, both folded to ASCII lower-case. A censored iTunes title (`F**k`) must match the Deezer title (`Fuck`): treat `*` as "any letter" when comparing. Do **not** strip a parenthetical that is the junk marker itself (see step 5) — "F**k You (Official Karaoke Version)" must not match the real "Fuck You".
5. **Base list = iTunes, in iTunes's order**, with two clean-ups: collapse rows with the same match key (clean and explicit versions of one song are one row for a DJ), and push "junk" rows below everything else. Junk = karaoke, tribute, "originally performed", "made famous", "in the style of", instrumental, lullaby / Rockabye Baby / Twinkle Twinkle, Kidz Bop, Chipmunks, 8-bit, piano version, cover, workout, sped up, slowed, nightcore, type beat, parody — **unless the query itself contains that word**.
6. **Deezer job 1 — upgrade.** For each of Deezer's top 8 non-junk hits that matches a base row: take Deezer's title when the iTunes one contains `*`, set `explicit` from Deezer, attach the Deezer ID and ISRC. The row keeps its iTunes position.
7. **Deezer job 2 — fill one gap.** If Deezer's first non-junk hit matches no base row **and** every query word appears in its title+artist (accent-folded), insert it at row 2 — or at row 1 when the current first row is junk or does not contain the query words. Insert nothing else from Deezer.
8. **Fallbacks.** iTunes failed, timed out or returned nothing → return Deezer's non-junk list. Deezer failed → return the iTunes base as is. Both failed → `502` with a code the client turns into "Search is having trouble — type the song instead."
9. Return the top 8.

**Why not a looser rule.** The owner's suggestion was to blend Deezer in "only when its top results contain explicit songs". A simulation on 22 searches (2026-11-16) showed that trigger fires on most searches (15 of 22 — Deezer's top five nearly always includes something explicit), and freely adding Deezer's explicit rows pushed wrong songs up (an unknown "IN DA CLUB" above 50 Cent, a rapper's "Electric Slide" on top). Restricting Deezer to *upgrading rows iTunes already has* gave exactly the wanted effect — "Tonight (I'm Fuckin' You)", "I Don't Fuck With You", "Move Bitch", "HUMBLE.", "WAP", "Get Low" all came back uncensored and flagged, in iTunes's order — and the single gap-fill covers songs iTunes lacks ("Tití Me Preguntó", the original "Blinding Lights"). Treat steps 5–7 as the starting rules and tune them against the fixtures; the fixtures are the acceptance bar, not the wording here.

**Client (`SongSearch.jsx`)**
- Search as you type: 250 ms debounce, 2-character minimum, `AbortController` cancels the previous call, and a request counter discards late responses.
- Each row: artwork, title, artist, an "E" badge when explicit. Keyboard: arrow keys, Enter selects, Escape clears. `role="listbox"` semantics.
- Last row is always **Request "‹what they typed›" as written** → a `typed` request. This replaces the old "Paste Link" tab; a pasted URL is detected and stored as `source: 'link'`.
- Loading skeleton rows, a visible error state, and an empty state.

**Tests:** record the two providers' JSON for ~30 of the test queries into `tests/fixtures/search/` and assert the top result's artist (e.g. `mr brightside → The Killers`, `in da club → 50 Cent`, `smells like teen spirit → Nirvana`, `electric slide →` not an explicit rap track, `titi me pregunto → Bad Bunny`, `blinding lights →` The Weeknd's original within the top 2, `move bitch ludacris → Move Bitch` uncensored with `explicit: true`, `fuck you ceelo →` CeeLo Green's song within the top 2 and never the karaoke version). Target: every fixture passes; no network in unit tests.

### 4.2 Song requests and tips
- **Request page states:** closed (not live) → friendly "requests open during events" screen with a Book link; open → search → selected song card → optional name + note → tip choice → submit.
- **No tip:** `POST /api/requests`, then an inline confirmation with "Request another". A 30 s cool-down per device after a successful request.
- **With a tip** (only when `tipsEnabled`): preset amounts $5 / $10 / $20 plus custom ($1–$200). Submit calls `POST /api/requests`, which returns `clientSecret`. Open a bottom sheet with the **Express Checkout Element** (Apple Pay / Google Pay) above the **Payment Element**. Confirm with `redirect: 'if_required'`; `return_url` is `/request/thanks?rid=<id>`. The thanks page polls `GET /api/requests/:id` until `tipState` is `paid` or `failed` (max ~20 s, then "we'll add it as soon as the payment clears"). Nothing depends on `sessionStorage`.
- Abandoned `awaiting_payment` docs never show on the dashboard. The dashboard query ignores them; a cleanup of ones older than 24 h can run inside the webhook handler opportunistically.
- Stripe.js is loaded only when the tip sheet opens (`import()`), never on the landing page.
- Errors are always shown to the visitor in plain words with a retry.
- Until the DJ finishes Stripe onboarding, production runs with test keys or with `tipsEnabled: false`. Apple Pay needs the site's domain added under Stripe → Settings → Payment method domains (owner action).

### 4.3 Bookings and notifications
- **Form (`BookingForm.jsx`, shared by every landing design):** name, phone, email, preferred contact (call / text / email), date (not in the past), start and end time (end may pass midnight; show the computed length), event type, location, notes. Real `<label>`s, inline messages per field, a visible failure state, and success copy that says how and when they'll hear back. Phone or email required, not both.
- **Email:** `functions/_lib/notify.js` sends through **Resend** (free tier: 100/day, 3,000/month). With no verified domain, Resend delivers only to the address that owns the Resend account, which is exactly this use (the DJ notifying himself) — so the Resend account must be created under the address that should receive bookings. Confirm this limit at implementation. Subject `New booking request — ‹event type›, ‹date›`; body lists every field plus `tel:` / `mailto:` links and a link to the dashboard. Set `reply_to` to the customer's email when given.
- If the DJ later puts a domain on Cloudflare, Cloudflare Email Service can send to verified addresses free and can replace Resend behind the same `notify()` function. Not needed now.
- **Text:** true SMS cannot be done free. The carrier email-to-text gateways are shut down (AT&T, June 2025; T-Mobile failing since late 2024) or closing (Verizon, announced for March 2027). Paid SMS (e.g. Twilio) is roughly a cent a message plus a monthly number fee and carrier registration. **Proposed free substitute:** a push notification to the DJ's phone via ntfy or a Telegram bot — one `fetch` to `PUSH_URL`, arrives like a text. Build it behind the optional `PUSH_URL` secret so it is off until the owner says yes.
- The customer gets no automatic email in v1 (needs a sending domain); the success screen sets expectations instead.

### 4.4 Live mode
`settings/public.live` and `.requestsOpen` are flipped from the dashboard. The landing page shows a "Live now — request a song" banner and the floating button only while live. `/request` is always reachable by URL/QR but shows the closed state when `requestsOpen` is false. Remove the hard-coded "Live Now" text and the footer hint.

### 4.5 DJ dashboard
- **Login:** existing Firebase email/password. Friendly errors, `autocomplete` attributes, a "not authorised" screen for signed-in non-admins.
- **Requests tab:** phone-first cards (not a 12-column table). Live Firestore listener: `status == 'pending'`, ordered by `createdAt`, limited to 200. Sort toggle: newest / tips first (ties by time). Card shows artwork, title, artist, explicit badge, note, requester name, age, and a gold tip chip only when `tip.state == 'paid'`. Actions: **Played** and **Dismiss** (distinct statuses) with a 5 s Undo toast. Optional sound + vibration and a title-bar count on new requests (toggle, off by default; browsers require a tap first). A "Tonight" header with counts and total paid tips. "Show played/dismissed" filter. An `onSnapshot` error handler with a reconnect notice.
- **Bookings tab:** list by event date with status chips (new / contacted / booked / declined / archived), tap-to-call, tap-to-text, tap-to-email, and the notes. Unread count on the tab.
- **Controls:** Live switch, Requests open switch, event name, Tips on/off, and a QR code for `/request` to put on screen at gigs (generate client-side with a small dependency, or as SVG by hand).
- Fix the lint error (`useState(Date.now())` → lazy initialiser) and tick the clock every 30 s, not every second.

### 4.6 Intro animation
- Port the chosen engine from `public/intros/option-N-*.html` into `src/intro/engines/<name>.js` as an ES module exporting `play(container, { onComplete, speed, reducedMotion })` — the code is already structured that way (`DJIntro.play`, single time value, `setup()`/`render(t)`), including the speed option added for the showcase. Embedded glyph outlines stay embedded.
- `IntroOverlay.jsx`: a fixed overlay **above the already-rendered page** (the page is not withheld, so it does not hurt load metrics). Plays once per browser session (`sessionStorage`), skippable by tap or key, honours `prefers-reduced-motion` (short fade), and is lazy-loaded. On finish, fade the overlay out over ~400 ms. Never on `/request`, `/dj`, or the thanks page.
- Config in `src/content/site.js`: `intro: { engine: 'stardust', speed: 1 }`. Until the DJ decides, default to Stardust at 100% and keep `?intro=<name>&speed=<n>` working for review.
- Stardust is the heaviest option (median 6.9 ms/frame of script under a 6× CPU throttle on an M1, some dropped frames on desktop). Add a guard: if the first 30 frames average over 24 ms, halve the particle count for the rest of the run. Test on a real phone before calling it done — nobody has yet.
- The `/intros/` showcase stays until the choice is made, then Phase 7 removes it and its footer link.

### 4.7 Landing page redesign — several options live
- **Preserve the original** as `/classic` (current `LandingPage`, unchanged apart from imports) and in tag `v1-original`.
- **All copy and data move to `src/content/site.js`**: name, tagline, city, about text, services, gear, testimonials, socials, contact. Every placeholder carries `placeholder: true` and renders a small "sample" marker in non-production previews so invented content is never mistaken for real. Do not invent testimonials, venues or credentials as if real.
- **Build three clearly different directions**, each a full page using the shared `BookingForm`, the same sections (hero, about, what I play / event types, what I bring, testimonials, booking, contact, footer), mobile-first, with working Book Now / About / Contact anchors and the live-mode banner:
  - **A — Club night.** Near-black, electric blue and gold, oversized condensed display type, the intro's waveform as a recurring divider, full-bleed hero, sticky "Book" button on phones.
  - **B — Premium events.** Calm and spacious, a serif display face with Inter body, soft off-white sections alternating with dark, photo-led, aimed at wedding and corporate bookers.
  - **C — Gig poster.** Bold grid, huge marquee lettering, hard edges, one loud accent colour, tour-poster energy.
- Routes `/designs/a`, `/designs/b`, `/designs/c`, plus a small floating switcher (A · B · C · Classic) shown on those routes only, in the same spirit as the intro showcase. `/` keeps showing Classic until the owner picks; then the winner becomes `/`, the others and the switcher are deleted, Classic stays at `/classic` until the owner says to drop it.
- Gear becomes "what I bring" without purchase prices. Replace emoji with icons or photos.
- The Testimonials page and its image are left as they are (owner's instruction). It may be lazy-loaded so the 6 MB image does not affect other pages, but do not alter its content.
- Load the design skill/guidance available to the session before building these; the bar is a site that looks designed, not templated.

### 4.8 Speed, accessibility, sharing, housekeeping
- Lazy-load every route; Firebase only on `/dj`; Stripe only in the tip sheet. Target: landing JS under 120 KB gzipped (from 197 KB).
- Self-host Inter (variable, `@fontsource-variable/inter`) instead of the render-blocking Google Fonts `@import`; fix the `@theme` token name.
- Labels, accessible names on icon buttons, visible focus rings, a proper `Dialog` (focus trap, Escape, `aria-modal`), `prefers-reduced-motion` for the marquee, contrast of at least 4.5:1 for body text.
- `index.html`: real favicon and touch icon, Open Graph / Twitter tags, a share image, `theme-color`, JSON-LD (`LocalBusiness`/`EntertainmentBusiness`) once real details exist. `robots.txt`, dynamic copyright year.
- `public/_headers`: long-cache hashed assets; basic security headers.
- Update dependencies (`npm audit fix`, then minor bumps), zero lint errors, delete template leftovers, write a real `README.md`.
- GitHub Action: lint + test + build on push and pull request.

---

## 5. How to verify work (important in this environment)

- The owner often works over Remote Control with the app's browser pane hidden; browser-pane tools hang in that state. Use **headless Chrome driven over the DevTools protocol from Node 24's built-in `WebSocket`** — no extra packages. The pattern (device emulation, real-time waits, clicks, screenshots, console-error capture) was used to test `/intros/`; rebuild it as `scripts/visual-check.mjs`.
- Chrome's headless window has a ~500 px minimum width; emulate phones with `Emulation.setDeviceMetricsOverride`, not `--window-size`.
- `--virtual-time-budget` does not advance these canvas animations; wait in real time.
- Check 360×640, 390×844 and 1280×800 for every page; assert no horizontal overflow and no control hidden under a floating button.
- **Never write test data to the production Firestore.** Unit-test functions against a fake Firestore layer; do end-to-end checks on a preview deployment with an owner-approved test collection prefix or the Firebase emulator.
- Send the owner screenshots or the preview URL (`SendUserFile`) rather than describing visuals.

---

## 6. Build phases

Work on `overhaul` (preview: https://overhaul.dj-insanity-site.pages.dev). Commit per task. At the end of each phase: lint, tests, build, visual check, then report to the owner with the preview link and ask before merging to `main`.

**Phase 0 — Foundations**
- `npm audit fix` and safe updates; fix the 6 lint errors; delete template leftovers.
- Add Vitest; add the GitHub Action; add `scripts/visual-check.mjs`.
- Scaffold `functions/` with `_lib/guard.js` and a trivial `GET /api/status` returning defaults; confirm it deploys on the preview.
- Check in `firestore.rules` (section 3.4) — **not yet published**.
- Done when: CI green, preview serves `/api/status`, site otherwise unchanged.

**Phase 1 — Server data layer** *(first real priority: the site cannot currently save anything)*
- `_lib/firestore.js`: service-account JWT (RS256 via WebCrypto) → OAuth token (cached in memory until expiry) → `get`, `create`, `patch`, `runTransaction` over REST.
- `/api/search` with merge, junk filter, cache, fixtures and tests.
- `/api/requests` (no-tip path), `/api/requests/:id`, `/api/bookings` with validation, Turnstile, KV limits, `notify()`.
- `scripts/make-admin.mjs`; owner publishes the rules and disables sign-up.
- Done when: unit tests pass; on the preview, a request and a booking land in Firestore through the API and a direct browser write is refused; the booking email arrives.
- Blocked on owner: service-account key, Resend key, Turnstile keys (section 7). Build against fakes until they exist.

**Phase 2 — Request page**
- New `RequestPage`, `SongSearch`, selected-song card, name/note, submit, confirmation, closed state, error states; remove direct Firestore writes from the client; delete `iTunesSearch.jsx`, `UserView.jsx`.
- Done when: the 8 explicit-title checks and a typed request work on a phone-sized preview; nothing overlaps; a failed submit shows a message.

**Phase 3 — Tips** *(ship dark until Stripe is ready)*
- PaymentIntent in `/api/requests`, webhook with signature check and idempotency, `TipSheet` with Express Checkout + Payment Element, `Thanks` page; delete `TipDJ.jsx`, `PaymentSuccess.jsx`, `worker/`.
- Done when: in Stripe test mode a paid request appears on the dashboard with a paid chip, an abandoned payment never appears, a replayed webhook changes nothing, and a forged thanks URL does nothing.
- After owner confirmation: delete the `dj-insanity-tips` Worker.

**Phase 4 — Dashboard**
- Tabs, cards, Played/Dismiss + Undo, alerts, live and tips switches, bookings, QR code, admin gate.
- Done when: usable one-handed at 390 px; a new request appears within ~2 s; status changes survive reload.

**Phase 5 — Intro**
- Port the chosen engine, `IntroOverlay`, once-per-session, skip, reduced motion, frame-time guard.
- Blocked on the DJ's choice; default Stardust @ 100% if still undecided.
- Done when: page content is in the DOM under the overlay from first paint; second visit in a session shows no intro.

**Phase 6 — Landing designs**
- `content/site.js`, `BookingForm`, `Classic` at `/classic`, designs A/B/C with switcher.
- Done when: all three pass the three-viewport check and the booking form submits from each. Send the owner the three links.
- After the owner picks: promote the winner to `/`, remove the rest.

**Phase 7 — Finish**
- Section 4.8 in full; remove `/intros/` and its link; README.
- With the owner's go-ahead: turn off GitHub Pages (`gh api -X DELETE repos/DMasterGeneral/dj-insanity-site/pages`).
- Final pass: Lighthouse-style checks on the landing and request pages, console clean, merge to `main`.

Dependencies: 1 → 2 → 3 → 4 share the data model and should go in order. 5 and 6 are independent of 1–4 and of each other and can be done earlier if the owner prefers to see visual progress first.

---

## 7. Things only the owner or the DJ can do

1. **Firebase console** — Project settings → Service accounts → *Generate new private key* (becomes `FIREBASE_SERVICE_ACCOUNT`). Authentication → Settings → User actions → untick *Enable create (sign-up)*. Firestore → Rules → paste `firestore.rules` and publish (Phase 1). Optionally paste the current rules to the session first so the cause of today's refusals is confirmed.
2. **Cloudflare** — add the secrets in section 3.6 for Production and Preview; create a Turnstile widget (invisible) for `dj-insanity-site.pages.dev`. Alternative: run `npx wrangler login` once so the session can set these from the command line.
3. **Resend** — create a free account under the address that should receive booking emails; create an API key.
4. **Stripe (DJ)** — finish onboarding. If he is not a registered company, choosing *Individual / sole proprietor* and using his SSN in place of an EIN is the usual route — he should confirm on Stripe's form. Then: live keys, a webhook endpoint for `/api/stripe/webhook`, and the site's domain under Payment method domains for Apple Pay.
5. **Decisions** — intro and speed; text-alert option; landing design after Phase 6.
6. **Content** — photos, bio, city, real testimonials, gear list, socials, contact email.

## 8. Risks
- **Deezer quota from shared Cloudflare addresses** could trip the 50-per-5-s limit that other sites share. Mitigation: edge cache, iTunes as the other half, graceful single-source results. Watch for error code 4 in logs.
- **Deezer / iTunes are unofficial for this use** and can change without notice; the typed-request fallback keeps the page useful if both fail.
- **Resend's no-domain limit** (own address only) is from secondary sources — confirm early in Phase 1.
- **Pages Functions bindings** (KV) need either `wrangler.toml` or dashboard setup; if neither is available, fall back to Turnstile-only protection and note it.
- **Stardust on low-end phones** is untested.
- **Old test documents** in `requests` use the old shape.

---

## 9. Build log (2026-11-16)

Built by Opus "builder" sessions under a manager session, each phase in its own git worktree, then merged into `overhaul` and pushed (preview: https://overhaul.dj-insanity-site.pages.dev). Server code and rules were reviewed by GPT Sol over three rounds (approved).

**Done**
- Phase 0: lint clean, Vitest + CI, `scripts/visual-check.mjs`, `functions/` scaffold, `firestore.rules` (not yet published), `shared/contracts.js`, lazy routes.
- Phase 1: `/api/search`, `/api/status`, `POST /api/requests` (no-tip path), `GET /api/requests/:id`, `POST /api/bookings` + Resend/ntfy notify, `scripts/make-admin.mjs`. 31 recorded search fixtures are the acceptance tests.
- Phase 2: new `/request` page; Classic's booking card posts to `/api/bookings`; the browser no longer writes to Firestore anywhere (`src/lib/firebase.js` deleted).
- Phase 4: new `/dj` dashboard with a demo source (`/dj?demo=1` off production).
- Phase 5: Stardust ported to `src/intro/`, once per session, skippable; the old 7.8 s loader is gone.
- Phase 6: `content/site.js`, shared `BookingForm`, designs A/B/C at `/designs/*` with a switcher; original kept at `/` and `/classic`.

**Changed from the plan**
- No KV and no `wrangler.toml`: rate limits are Firestore counter docs (`rate/{kind}_{ipHash}_{window}`), so no binding or dashboard setup is needed. `rate/` is covered by the catch-all deny rule.
- Firestore auth uses the standard service-account → OAuth token exchange (cached), not a self-signed bearer JWT.
- Search gap-fill (§4.1 step 7) became a "dominant hit" rule: Deezer's first hit goes to row 1 only when its Deezer rank is ≥ 500,000 and ≥ 1.5× the next different song (or iTunes's top row is junk). The plain "insert at row 2" only added covers in the fixtures. Known side effects: "shots" puts Imagine Dragons above LMFAO; "shake it off" puts Taylor's Version first.
- Search split between browser and server: iTunes answers HTTP 429 to almost every call from Cloudflare's shared server IPs (a diagnostic header showed `itunes=HTTP 429` on every probe; 13 of 14 test searches came back Deezer-only), so iTunes is now fetched by the guest's browser (iTunes sends `Access-Control-Allow-Origin: *`; each guest has their own rate budget) and Deezer by the server (`GET /api/search/deezer`, no CORS header; one retry on its quota reply; edge-cached 6 h, empty lists included). The merge runs in the browser (`src/pages/request/searchSongs.js`) with the same rules, now in `shared/search/`. `/api/search` is gone.
- Intro config lives in `src/intro/config.js`, not `site.js`. Only Stardust is ported; another engine is a mechanical port of the same `play()` shape.
- Dashboard queries avoid composite indexes (order by `createdAt`, filter status client-side). Old 2025 docs without `createdAt` simply don't appear.
- Bookings: the server accepts dates from "UTC today minus one day" so US evening visitors are never refused; the browser blocks past dates in the visitor's own time zone.

**Waiting on the owner (section 7)**
- A **dev Firebase project** (Firestore + email/password auth + service-account key + web config) for end-to-end proof of requests, bookings and the dashboard. Nothing has been written to any Firestore yet.
- Production: service-account key and other secrets in Cloudflare, publish `firestore.rules`, disable public sign-up, run `make-admin.mjs` for the DJ's account.
- Resend key (booking emails); optional ntfy topic for push alerts.
- Stripe test keys → Phase 3 (tips) is not started.
- Decisions: intro + speed; landing design A/B/C; real content for the `sample`-tagged items.

**Not verified yet**: anything against a real Firestore, Resend, Turnstile with real keys, real phones/Safari, the intro on low-end phones.
