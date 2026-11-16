import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowRight, Camera, Mail, MapPin, Menu, Phone, X } from 'lucide-react';
import BookingForm from '../../../../components/BookingForm.jsx';
import Sample from '../../../../components/Sample.jsx';
import { Button } from '../../../../components/ui/index.js';
import { CONTENT_ICONS } from '../../../../content/icons.js';
import { site, textOf } from '../../../../content/site.js';
import { useLiveStatus } from '../../../../lib/useLiveStatus.js';
import { copyB } from './copy.js';
import './b.css';

// Design B, Premium events (plan section 4.7): calm, spacious, photo-led; ivory and evergreen bands.
// Contract: ../README.md.

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** `?live=1` previews the live banner on this page only. */
const forceLive = () => new URLSearchParams(window.location.search).get('live') === '1';

/** Splits "DJ Insanity" into a small italic "DJ" over the name; any other name stays whole. */
function NameMark({ name }) {
  const m = /^(DJ)\s+(.+)$/.exec(name);
  if (!m) return <span className="design-b__name-main">{name}</span>;
  return (
    <>
      <span className="design-b__name-pre">{m[1]}</span> <span className="design-b__name-main">{m[2]}</span>
    </>
  );
}

const GROOVES = Array.from({ length: 21 }, (_, i) => 70 + i * 13);

/** A record rising like a sun inside the arch: the stand-in until a real photo exists. */
function FrameArt() {
  return (
    <svg className="design-b__frame-art" viewBox="0 0 400 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      {GROOVES.map((r, i) => (
        <circle key={r} cx="200" cy="560" r={r} fill="none" stroke="currentColor" strokeWidth={i % 4 === 0 ? 1.4 : 0.7} opacity={0.3 + (i % 3) * 0.12} />
      ))}
      <circle cx="200" cy="560" r="44" fill="currentColor" opacity="0.16" />
    </svg>
  );
}

/**
 * Arched photo frame. Shows the real photo when site.js has one, otherwise a finished-looking
 * graphic marked as a sample.
 * @param {{ photo: { src: string|null, alt: string, placeholder?: boolean }, className?: string }} props
 */
function PhotoFrame({ photo, className = '' }) {
  return (
    <Sample as="figure" block when={photo.placeholder} className={`design-b__frame ${className}`.trim()}>
      <div className="design-b__arch">
        {photo.src ? (
          <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
        ) : (
          <>
            <FrameArt />
            <span className="design-b__frame-label">
              <Camera size={16} aria-hidden="true" />
              {copyB.photoPending}
            </span>
          </>
        )}
      </div>
      {!photo.src && <figcaption className="design-b__frame-caption">{photo.alt}</figcaption>}
    </Sample>
  );
}

function Eyebrow({ children }) {
  return <p className="design-b__eyebrow">{children}</p>;
}

export default function DesignB() {
  const status = useLiveStatus();
  const [preview] = useState(forceLive);
  const live = status.live || preview;
  const eventName = status.live ? status.eventName : null;

  const [menuOpen, setMenuOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef(/** @type {HTMLElement|null} */ (null));
  const bookRef = useRef(/** @type {HTMLElement|null} */ (null));
  const menuButtonRef = useRef(/** @type {HTMLButtonElement|null} */ (null));

  // Phones: the floating Book button shows between the hero and the booking section only.
  useEffect(() => {
    const hero = heroRef.current;
    const book = bookRef.current;
    if (!hero || !book || !('IntersectionObserver' in window)) return undefined;
    const seen = { hero: true, book: false, bookPassed: false };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) seen.hero = e.isIntersecting;
        else {
          seen.book = e.isIntersecting;
          seen.bookPassed = !e.isIntersecting && e.boundingClientRect.top < 0;
        }
      }
      setStickyVisible(!seen.hero && !seen.book && !seen.bookPassed);
    });
    io.observe(hero);
    io.observe(book);
    return () => io.disconnect();
  }, []);

  /** In-page anchors: scroll smoothly (instantly with reduced motion) and move focus to the section. */
  function onClick(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = /** @type {HTMLElement} */ (e.target).closest?.('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    // Close the phone menu first so its height is gone before the scroll target is measured.
    flushSync(() => setMenuOpen(false));
    target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    window.history.pushState(window.history.state, '', `#${id}`);
    target.focus({ preventScroll: true });
  }

  function onHeaderKey(e) {
    if (e.key === 'Escape' && menuOpen) {
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    }
  }

  const { about, services, gear, testimonials, booking, contact, photos } = site;
  const how = copyB.howItWorks;

  return (
    <div className="design-b" onClick={onClick}>
      {live && (
        <a className="design-b__live" href={site.live.href}>
          <span className="design-b__live-dot" aria-hidden="true" />
          <strong>{site.live.label}</strong>
          {eventName && <span className="design-b__live-event">{eventName}</span>}
          <span className="design-b__live-cta">
            {site.live.cta}
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </a>
      )}

      <header className="design-b__header" onKeyDown={onHeaderKey}>
        <div className="design-b__wrap design-b__header-row">
          <a className="design-b__wordmark" href="#top">
            {site.name}
          </a>
          <nav className="design-b__nav" aria-label="Sections">
            <ul>
              {site.nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href}>{n.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <Button href={site.bookCta.href} size="sm" className="design-b__header-book">
            {site.bookCta.label}
          </Button>
          <button
            ref={menuButtonRef}
            type="button"
            className="design-b__menu-button"
            aria-expanded={menuOpen}
            aria-controls="b-menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            <span>{menuOpen ? copyB.menu.close : copyB.menu.open}</span>
          </button>
        </div>
        <nav id="b-menu" className="design-b__menu" aria-label="Sections, menu" hidden={!menuOpen}>
          <ul className="design-b__wrap">
            {site.nav.map((n) => (
              <li key={n.href}>
                <a href={n.href}>{n.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main>
        {/* ---- Hero ------------------------------------------------------------------------ */}
        <section id="top" ref={heroRef} tabIndex={-1} className="design-b__band design-b__hero" aria-labelledby="b-hero-title">
          <div className="design-b__wrap design-b__hero-grid">
            <div className="design-b__hero-text">
              <Eyebrow>{site.eventsLine}</Eyebrow>
              <h1 id="b-hero-title" className="design-b__hero-title">
                <NameMark name={site.name} />
              </h1>
              <p className="design-b__hero-lede">{site.tagline}</p>
              <div className="design-b__hero-actions">
                <Button href={site.bookCta.href} className="design-b__cta">
                  {site.bookCta.label}
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
                <Button href="#about" variant="secondary" className="design-b__cta">
                  {about.heading}
                </Button>
              </div>
              <p className="design-b__hero-place">
                <MapPin size={16} aria-hidden="true" />
                <Sample value={site.city} />
              </p>
            </div>
            <PhotoFrame photo={photos.hero} className="design-b__hero-frame" />
          </div>
        </section>

        {/* ---- About (dark) ---------------------------------------------------------------- */}
        <section id="about" tabIndex={-1} className="design-b__band design-b__dark" aria-labelledby="b-about-title">
          <div className="design-b__wrap design-b__about-grid">
            <PhotoFrame photo={photos.about} className="design-b__about-frame" />
            <div className="design-b__about-text">
              <Eyebrow>
                <Sample value={site.area} />
              </Eyebrow>
              <h2 id="b-about-title">{about.heading}</h2>
              <p className="design-b__lead">
                <Sample value={about.short} />
              </p>
              {about.long.map((p) => (
                <p key={textOf(p)} className="design-b__body">
                  <Sample value={p} />
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Events ---------------------------------------------------------------------- */}
        <section id="services" tabIndex={-1} className="design-b__band" aria-labelledby="b-services-title">
          <div className="design-b__wrap design-b__split">
            <div className="design-b__split-head">
              <Eyebrow>{services.intro}</Eyebrow>
              <h2 id="b-services-title">{services.heading}</h2>
            </div>
            <ul className="design-b__events">
              {services.items.map((s) => {
                const Icon = CONTENT_ICONS[s.icon];
                return (
                  <li key={s.value} className="design-b__event">
                    <span className="design-b__ring">
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{s.label}</h3>
                      <p>
                        <Sample value={s.description} />
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---- Testimonials (dark) --------------------------------------------------------- */}
        <section id="testimonials" tabIndex={-1} className="design-b__band design-b__dark" aria-labelledby="b-quotes-title">
          <div className="design-b__wrap">
            <h2 id="b-quotes-title" className="design-b__center-title">
              {testimonials.heading}
            </h2>
            <ul className="design-b__quotes">
              {testimonials.items.map((t) => (
                <Sample key={t.quote} as="li" block when={t.placeholder} className="design-b__quote">
                  <blockquote>
                    <p>{t.quote}</p>
                  </blockquote>
                  <p className="design-b__quote-by">
                    {t.author}
                    <span aria-hidden="true"> · </span>
                    <span className="design-b__quote-event">{t.event}</span>
                  </p>
                </Sample>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- How booking works ----------------------------------------------------------- */}
        <section className="design-b__band design-b__how" aria-labelledby="b-how-title">
          <div className="design-b__wrap">
            <h2 id="b-how-title" className="design-b__center-title">
              {how.heading}
            </h2>
            <ol className="design-b__steps">
              {how.steps.map((s, i) => (
                <li key={s.title} className="design-b__step">
                  <span className="design-b__step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3>{s.title}</h3>
                  <p>
                    <Sample value={s.text} />
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- What I bring (dark) --------------------------------------------------------- */}
        <section id="gear" tabIndex={-1} className="design-b__band design-b__dark" aria-labelledby="b-gear-title">
          <div className="design-b__wrap design-b__split">
            <div className="design-b__split-head">
              <h2 id="b-gear-title">{gear.heading}</h2>
              <p className="design-b__body">{gear.intro}</p>
            </div>
            <ul className="design-b__gear">
              {gear.items.map((g) => {
                const Icon = CONTENT_ICONS[g.icon];
                return (
                  <Sample key={g.name} as="li" block when={g.placeholder} className="design-b__gear-item">
                    <span className="design-b__ring">
                      <Icon aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{g.name}</h3>
                      <p>{g.description}</p>
                    </div>
                  </Sample>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ---- Booking --------------------------------------------------------------------- */}
        <section id="book" ref={bookRef} tabIndex={-1} className="design-b__band design-b__book" aria-labelledby="b-book-title">
          <div className="design-b__wrap design-b__book-grid">
            <div className="design-b__book-head">
              <h2 id="b-book-title">{booking.heading}</h2>
              <p className="design-b__body">{booking.intro}</p>
              <div className="design-b__book-aside">
                <p>{contact.intro}</p>
                <p>
                  <a href={contact.email.href}>
                    <Mail size={16} aria-hidden="true" />
                    <Sample value={contact.email} />
                  </a>
                </p>
                <p>
                  <a href={contact.phone.href}>
                    <Phone size={16} aria-hidden="true" />
                    <Sample value={contact.phone} />
                  </a>
                </p>
              </div>
            </div>
            <div className="design-b__form-card">
              <BookingForm idPrefix="b" />
            </div>
          </div>
        </section>

        {/* ---- Contact (dark) -------------------------------------------------------------- */}
        <section id="contact" tabIndex={-1} className="design-b__band design-b__dark design-b__contact" aria-labelledby="b-contact-title">
          <div className="design-b__wrap design-b__contact-grid">
            <div>
              <h2 id="b-contact-title">{contact.heading}</h2>
              <p className="design-b__body">{contact.intro}</p>
            </div>
            <ul className="design-b__contact-list">
              <li>
                <a href={contact.email.href}>
                  <Mail size={20} aria-hidden="true" />
                  <Sample value={contact.email} />
                </a>
              </li>
              <li>
                <a href={contact.phone.href}>
                  <Phone size={20} aria-hidden="true" />
                  <Sample value={contact.phone} />
                </a>
              </li>
              {site.socials.map((s) => {
                const Icon = CONTENT_ICONS[s.icon];
                return (
                  <li key={s.label}>
                    <a href={s.href} rel="noopener noreferrer" target="_blank">
                      <Icon size={20} aria-hidden="true" />
                      <Sample when={s.placeholder}>{s.label}</Sample>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="design-b__footer">
        <div className="design-b__wrap design-b__footer-row">
          <span className="design-b__wordmark design-b__wordmark--footer">{site.name}</span>
          <p>
            © {new Date().getFullYear()} {site.footer.text}
          </p>
        </div>
      </footer>

      <a
        href={site.bookCta.href}
        className={`design-b__sticky${stickyVisible ? ' is-visible' : ''}`}
        aria-hidden={stickyVisible ? undefined : 'true'}
        tabIndex={stickyVisible ? undefined : -1}
      >
        {site.bookCta.label}
      </a>
    </div>
  );
}
