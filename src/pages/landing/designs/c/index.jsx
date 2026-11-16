import { useEffect, useRef } from 'react';
import { ArrowRight, ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import BookingForm from '../../../../components/BookingForm.jsx';
import Sample from '../../../../components/Sample.jsx';
import { CONTENT_ICONS } from '../../../../content/icons.js';
import { site, textOf } from '../../../../content/site.js';
import { useLiveStatus } from '../../../../lib/useLiveStatus.js';
import Ticker from './Ticker.jsx';
import StickyBook from './StickyBook.jsx';
import PhotoSpot from './PhotoSpot.jsx';
import './c.css';

// Design C, "Gig poster" (plan section 4.7): a hard-edged grid, one loud orange on ink and paper,
// event types as a tour listing, gear as a rider, testimonials as press clippings.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `?live=1` previews the live banner on this page only. */
const forceLive = () => new URLSearchParams(window.location.search).get('live') === '1';

/** Scroll to an in-page target (smoothly unless reduced motion) and move focus there. */
function jumpTo(hash, smooth) {
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return false;
  target.scrollIntoView({ behavior: smooth && !reducedMotion() ? 'smooth' : 'auto', block: 'start' });
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
  return true;
}

/** Section header: a small poster label, the big h2 and an optional intro line. */
function Head({ id, label, title, intro, tone = 'paper' }) {
  return (
    <div className={`c-head c-head--${tone}`}>
      <p className="c-head__label" aria-hidden="true">
        {label}
      </p>
      <h2 id={id} className="c-head__title">
        {title}
      </h2>
      {intro && <p className="c-head__intro">{intro}</p>}
    </div>
  );
}

export default function DesignC() {
  const status = useLiveStatus();
  const live = status.live || forceLive();
  const heroCta = useRef(/** @type {HTMLAnchorElement|null} */ (null));
  const year = new Date().getFullYear();
  const [first, ...rest] = site.name.split(' ');

  // This page loads lazily, after the browser has already tried to honour #book and the like.
  useEffect(() => {
    if (window.location.hash) jumpTo(window.location.hash, false);
  }, []);

  /** In-page links: smooth scroll (respecting reduced motion), hash kept in the address bar. */
  function onClick(e) {
    const a = /** @type {HTMLElement} */ (e.target).closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hash = a.getAttribute('href');
    if (!hash || hash.length < 2) return;
    if (jumpTo(hash, true)) {
      e.preventDefault();
      window.history.pushState(window.history.state, '', hash);
    }
  }

  return (
    <div className="design-c" onClick={onClick}>
      <a className="c-skip" href="#book">
        Skip to booking
      </a>

      {live && (
        <div className="c-live">
          <p className="c-live__inner">
            <span className="c-live__dot" aria-hidden="true" />
            <strong className="c-live__label">{site.live.label}</strong>
            {status.eventName && <span className="c-live__event">{status.eventName}</span>}
            <a className="c-live__link" href={site.live.href}>
              {site.live.cta}
              <ArrowRight aria-hidden="true" />
            </a>
          </p>
        </div>
      )}

      <header className="c-top">
        <div className="c-top__inner">
          <span className="c-top__logo">{site.name}</span>
          <nav className="c-top__nav" aria-label="Sections">
            <ul>
              {site.nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <a className="c-top__book" href={site.bookCta.href}>
            {site.bookCta.label}
          </a>
        </div>
      </header>

      <main>
        {/* ---- Hero: the poster ------------------------------------------------------------ */}
        <section className="c-hero" aria-labelledby="c-title">
          <div className="c-hero__grid">
            <p className="c-hero__strip">
              <span>{site.eventsLine}</span>
              <span className="c-hero__city">
                <MapPin aria-hidden="true" />
                <Sample value={site.city} />
              </span>
            </p>
            <h1 id="c-title" className="c-hero__name">
              <span>{first}</span> {rest.length > 0 && <span>{rest.join(' ')}</span>}
            </h1>
            <div className="c-hero__photo">
              <PhotoSpot photo={site.photos.hero} />
            </div>
            <div className="c-hero__pitch">
              <p className="c-hero__tagline">{site.tagline}</p>
              <a ref={heroCta} className="c-hero__cta" href={site.bookCta.href}>
                <span>{site.bookCta.label}</span>
                <ArrowRight aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>

        <Ticker words={[site.name, ...site.eventsLine.split('•').map((s) => s.trim())]} />

        {/* ---- About ----------------------------------------------------------------------- */}
        <section className="c-section c-section--paper" aria-labelledby="c-about-title" id="about">
          <div className="c-wrap">
            <Head id="c-about-title" label="Headliner" title={site.about.heading} />
            <div className="c-about">
              <p className="c-about__short">
                <Sample value={site.about.short} />
              </p>
              <div className="c-about__long">
                {site.about.long.map((p) => (
                  <p key={textOf(p)}>
                    <Sample value={p} />
                  </p>
                ))}
              </div>
              <dl className="c-about__facts">
                <div>
                  <dt>Based in</dt>
                  <dd>
                    <Sample value={site.city} />
                  </dd>
                </div>
                <div>
                  <dt>Plays</dt>
                  <dd>
                    <Sample value={site.area} />
                  </dd>
                </div>
              </dl>
              <div className="c-about__photo">
                <PhotoSpot photo={site.photos.about} />
              </div>
            </div>
          </div>
        </section>

        {/* ---- Events, as a tour listing ----------------------------------------------------- */}
        <section className="c-section c-section--paper c-section--ruled" aria-labelledby="c-services-title" id="services">
          <div className="c-wrap">
            <Head id="c-services-title" label="Tour dates" title={site.services.heading} intro={site.services.intro} />
            <ul className="c-dates">
              {site.services.items.map((s) => {
                const Icon = CONTENT_ICONS[s.icon];
                return (
                  <li key={s.value} className="c-date">
                    <span className="c-date__icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <h3 className="c-date__name">{s.label}</h3>
                    <p className="c-date__desc">
                      <Sample value={s.description} />
                    </p>
                    <a className="c-date__book" href={site.bookCta.href} aria-label={`${site.bookCta.label}: ${s.label}`}>
                      <span aria-hidden="true">Book</span>
                      <ArrowUpRight aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---- Gear, as a tech rider ---------------------------------------------------------- */}
        <section className="c-section c-section--ink" aria-labelledby="c-gear-title" id="gear">
          <div className="c-wrap">
            <Head id="c-gear-title" label="Tech rider" title={site.gear.heading} intro={site.gear.intro} tone="ink" />
            <ul className="c-rider">
              {site.gear.items.map((g) => {
                const Icon = CONTENT_ICONS[g.icon];
                return (
                  <Sample as="li" block when={g.placeholder} key={g.name} className="c-rider__item">
                    <Icon aria-hidden="true" className="c-rider__icon" />
                    <h3 className="c-rider__name">{g.name}</h3>
                    <p className="c-rider__desc">{g.description}</p>
                  </Sample>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---- Testimonials, as press clippings ---------------------------------------------- */}
        <section className="c-section c-section--paper" aria-labelledby="c-testimonials-title" id="testimonials">
          <div className="c-wrap">
            <Head id="c-testimonials-title" label="Press" title={site.testimonials.heading} />
            <ul className="c-press">
              {site.testimonials.items.map((t) => (
                <Sample as="li" block when={t.placeholder} key={t.quote} className="c-press__item">
                  <figure>
                    <blockquote>
                      <p>{t.quote}</p>
                    </blockquote>
                    <figcaption>
                      {t.author}
                      {t.event && <span> · {t.event}</span>}
                    </figcaption>
                  </figure>
                </Sample>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Booking ----------------------------------------------------------------------- */}
        <section className="c-section c-section--ink c-book" aria-labelledby="c-book-title" id="book">
          <div className="c-wrap c-book__grid">
            <div className="c-book__intro">
              <Head id="c-book-title" label="Box office" title={site.booking.heading} tone="ink" />
              <p className="c-book__text">{site.booking.intro}</p>
            </div>
            <div className="c-book__form">
              <BookingForm idPrefix="c" />
            </div>
          </div>
        </section>

        {/* ---- Contact ----------------------------------------------------------------------- */}
        <section className="c-section c-section--hot" aria-labelledby="c-contact-title" id="contact">
          <div className="c-wrap">
            <Head id="c-contact-title" label="Info" title={site.contact.heading} intro={site.contact.intro} tone="hot" />
            <ul className="c-contact">
              <li>
                <a href={site.contact.email.href}>
                  <Mail aria-hidden="true" />
                  <Sample value={site.contact.email} />
                </a>
              </li>
              <li>
                <a href={site.contact.phone.href}>
                  <Phone aria-hidden="true" />
                  <Sample value={site.contact.phone} />
                </a>
              </li>
              {site.socials.map((s) => {
                const Icon = CONTENT_ICONS[s.icon];
                return (
                  <li key={s.href}>
                    <a href={s.href} rel="noopener noreferrer" target="_blank">
                      <Icon aria-hidden="true" />
                      <Sample when={s.placeholder}>{s.label}</Sample>
                      <span className="c-sr"> (opens in a new tab)</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="c-foot">
        <p className="c-foot__name" aria-hidden="true">
          {site.name}
        </p>
        <p className="c-foot__legal">
          © {year} {site.footer.text}
        </p>
      </footer>

      <StickyBook heroCta={heroCta} />
    </div>
  );
}
