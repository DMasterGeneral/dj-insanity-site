# Landing designs: the contract

Three candidate landing pages live here, one folder each: `a/` (Club night), `b/` (Premium events),
`c/` (Gig poster). Plan: `docs/OVERHAUL_PLAN.md` §4.7 (designs), §4.3 (booking), §4.4 (live mode),
§4.8 (accessibility). `src/pages/landing/Designs.jsx` lazy-loads `designs/<x>/index.jsx` (default
export) at `/designs/<x>` and draws the floating design switcher bottom-left.

## Ownership and scope
- Work **only in your own folder**. Do not edit anything outside it: not `Designs.jsx`, the switcher,
  the shared components, `site.js`, `src/index.css` (frozen), `package.json` (no new dependencies).
  If you need a shared change, ask for it.
- One root element with your root class (`.design-a` / `.design-b` / `.design-c`). **Every CSS rule
  is scoped under it** (`.design-a h2`, `.design-a__hero`…). No `html`, `body`, `:root`, `*` or bare
  element selectors: the switcher moves between designs without a page reload, so every design's CSS
  stays loaded at once.
- Plain CSS in your folder (e.g. `a/a.css`, more files if you like). Tailwind classes work but are not
  required.
- Fonts: self-hosted `.woff2` files in your own folder, declared with `@font-face` in your CSS
  (`font-display: swap`). Inter Variable is already loaded globally. No Google Fonts links, no CDNs.
- Images you add go in your folder and are imported (`import hero from './hero.webp'`), so Vite hashes
  them. Keep them small; there are no real photos of the DJ yet (`site.photos.*.src` is `null`), so use
  graphics, not stock photos of other people.

## Content
- Import copy and data **only** from `src/content/site.js` (and icons from `src/content/icons.js`).
  Never hard-code copy that belongs in the content file; never invent testimonials, venues, client
  names, credentials, awards or numbers.
- Placeholder shape (documented at the top of `site.js`): a confirmed string is a plain string; an
  unconfirmed one is `{ text, placeholder: true }`; an unconfirmed record (testimonial, gear item,
  social, photo) has `placeholder: true` on the record. Helpers: `textOf(v)`, `isPlaceholder(v)`.
- Render every placeholder through `<Sample>` (`src/components/Sample.jsx`), which adds a small
  "sample" tag except on the production host:
  - `<Sample value={site.city} />` for a string
  - `<Sample when={t.placeholder}>…</Sample>` around inline content
  - `<Sample as="li" block when={t.placeholder}>…</Sample>` for a card (tag in its top-right corner)
- Icons: `site.services.items[].icon`, `site.gear.items[].icon` and `site.socials[].icon` are lucide
  names; render with `const Icon = CONTENT_ICONS[item.icon]` and `<Icon aria-hidden="true" />`. Do not
  import `icons` from lucide-react (it bundles every icon).

## Required sections and anchors
Hero, then sections with these ids (nav links in `site.nav` and `site.bookCta` point at them):

| id | content |
|---|---|
| `#about` | `site.about` (short + long), `site.city` / `site.area` |
| `#services` | `site.services` (event types, same list as the form) |
| `#gear` | `site.gear` ("What I bring", no prices) |
| `#testimonials` | `site.testimonials` |
| `#book` | `site.booking.heading`, `.intro`, and `<BookingForm idPrefix="a" />` (your letter) |
| `#contact` | `site.contact` (email, phone), `site.socials` |

Footer: `© {new Date().getFullYear()} {site.footer.text}`. Use one `<h1>` (the hero) and `<h2>` per
section; BookingForm's own result headings are `<h3>`.

## Shared pieces to use
- `BookingForm` (`src/components/BookingForm.jsx`): props `idPrefix` (required, your letter),
  `className`, `onSuccess(data)`. It handles validation, errors, sending, Turnstile, failure and
  success. Give it a normal block-level parent (it uses `container-type: inline-size`, so it must not
  sit in a shrink-to-fit box); it goes to two columns at 32rem wide.
- UI primitives (`src/components/ui/`): `Button` (`variant` primary|secondary|ghost, `size` md|sm,
  `href` renders a link), `Field`, `Dialog`, `Toast`. Import from `src/components/ui/index.js`.
- `useLiveStatus()` (`src/lib/useLiveStatus.js`) → `{ loading, live, eventName, requestsOpen,
  tipsEnabled }`. One fetch per page load; not live on any error.
- `apiGet` / `apiPost` (`src/lib/api.js`) if you ever need the API directly (you should not).

## Theming
Set the `--ui-*` variables on your root class; the form and primitives use nothing else:
`--ui-bg`, `--ui-surface`, `--ui-text`, `--ui-muted`, `--ui-accent`, `--ui-accent-text`,
`--ui-border`, `--ui-danger`, `--ui-radius`, `--ui-font`, `--ui-focus`, plus optional
`--ui-color-scheme` (`light` for a light design, so native date pickers match). Keep body text and
`--ui-muted` at 4.5:1 contrast or better against their backgrounds, and make `--ui-focus` clearly
visible against both `--ui-bg` and `--ui-surface`.
`Dialog` renders into `document.body`, outside your root: pass it a class (`className="design-a-portal"`)
and set your variables on `.design-a, .design-a-portal`.

## Behaviour and accessibility
- Live banner: when `live` is true, show `site.live.label` (+ `eventName` if set) with a link to
  `site.live.href`. Show nothing live-related otherwise (no hard-coded "Live now").
- Phones: a sticky "Book" button **bottom-right** (`site.bookCta`, links to `#book`), hidden or
  out of the way once `#book` is on screen. The design switcher is bottom-left; leave about 5rem
  of bottom padding at the end of the page so neither floating control covers the last links.
- Mobile-first; check 360×640, 390×844 and 1280×800 with no horizontal scroll:
  `node scripts/visual-check.mjs <baseUrl> /designs/a`.
- Visible focus on everything interactive, labels on icon-only buttons, `prefers-reduced-motion`
  respected for any animation (marquees included).
