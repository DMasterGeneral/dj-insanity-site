import { useEffect, useRef, useState } from 'react';
import { Disc3 } from 'lucide-react';
import BookingForm from '../../../../components/BookingForm.jsx';
import Sample from '../../../../components/Sample.jsx';
import { site } from '../../../../content/site.js';
import { CONTENT_ICONS } from '../../../../content/icons.js';
import { useLiveStatus } from '../../../../lib/useLiveStatus.js';
import Waveform from './Waveform.jsx';
import './a.css';

// Design A, "Club night" (plan section 4.7). Contract: ../README.md.

const [NAME_FIRST, ...NAME_REST] = site.name.split(' ');
const NAME_LAST = NAME_REST.join(' ');

/** In-page anchor links: smooth scroll unless the visitor asked for reduced motion, then focus the target. */
function onAnchorClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
  if (!link) return;
  const id = link.getAttribute('href').slice(1);
  const target = id ? document.getElementById(id) : null;
  if (!target) return;
  e.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  window.history.replaceState(window.history.state, '', `#${id}`);
  target.focus({ preventScroll: true });
}

/** A marked spot for one of the DJ's real photos (site.photos.*). Shows the photo once `src` is set. */
function PhotoSlot({ photo, className }) {
  if (photo.src) {
    return (
      <figure className={`design-a__photo ${className}`}>
        <img src={photo.src} alt={photo.alt} loading="lazy" />
      </figure>
    );
  }
  return (
    <Sample as="figure" block when={photo.placeholder} className={`design-a__photo design-a__photo--empty ${className}`}>
      <span className="design-a__photo-grooves" aria-hidden="true" />
      <figcaption className="design-a__photo-label">
        <span className="design-a__mono">Photo</span>
        {photo.alt}
      </figcaption>
    </Sample>
  );
}

export default function DesignA() {
  const { live: apiLive, eventName } = useLiveStatus();
  // Review aid: /designs/a?live=1 shows the live banner without turning live mode on.
  const live = apiLive || new URLSearchParams(window.location.search).get('live') === '1';

  const heroRef = useRef(/** @type {HTMLElement|null} */ (null));
  const bookRef = useRef(/** @type {HTMLElement|null} */ (null));
  // The phone "Book" button stays out of the way while the hero's own button or the form is on screen.
  const [fabHidden, setFabHidden] = useState(() => typeof IntersectionObserver !== 'undefined');

  useEffect(() => {
    const targets = [heroRef.current, bookRef.current].filter(Boolean);
    if (typeof IntersectionObserver === 'undefined' || !targets.length) return undefined;
    const showing = new Map();
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) showing.set(entry.target, entry.isIntersecting);
      setFabHidden([...showing.values()].some(Boolean));
    });
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const { about, services, gear, testimonials, booking, contact, bookCta } = site;

  return (
    <div className="design-a" onClick={onAnchorClick}>
      {live && (
        <div className="design-a__live" role="status">
          <span className="design-a__live-dot" aria-hidden="true" />
          <p>
            <strong>{site.live.label}</strong>
            {eventName ? <span className="design-a__live-event"> at {eventName}</span> : null}
          </p>
          <a href={site.live.href}>
            {site.live.cta}
            <span aria-hidden="true"> →</span>
          </a>
        </div>
      )}

      <header className="design-a__top">
        <div className="design-a__wrap design-a__top-inner">
          <a href="#a-top" className="design-a__brand">
            <Disc3 aria-hidden="true" />
            <span>{site.name}</span>
          </a>
          <nav aria-label="Sections" className="design-a__nav">
            <ul>
              {site.nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <a href={bookCta.href} className="design-a__top-book">
            {bookCta.label}
          </a>
        </div>
      </header>

      <main>
        <section id="a-top" ref={heroRef} tabIndex={-1} className="design-a__hero" aria-labelledby="a-title">
          <div className="design-a__lights" aria-hidden="true">
            <span className="design-a__beam design-a__beam--blue" />
            <span className="design-a__beam design-a__beam--gold" />
            <span className="design-a__beam design-a__beam--blue2" />
          </div>
          <div className="design-a__wrap design-a__hero-grid">
            <div className="design-a__hero-copy">
              <p className="design-a__mono design-a__hero-events">{site.eventsLine}</p>
              <h1 id="a-title" className="design-a__title">
                <span className="design-a__sr">{site.name}</span>
                <span aria-hidden="true" className="design-a__title-dj">
                  {NAME_FIRST}
                </span>
                <span aria-hidden="true" className="design-a__title-name">
                  {NAME_LAST}
                </span>
              </h1>
              <p className="design-a__hero-tagline">{site.tagline}</p>
              <div className="design-a__hero-actions">
                <a href={bookCta.href} className="design-a__cta">
                  {bookCta.label}
                  <span aria-hidden="true" className="design-a__cta-arrow">→</span>
                </a>
                <a href="#services" className="design-a__cta-ghost">
                  {services.intro}
                </a>
              </div>
              <p className="design-a__mono design-a__hero-where">
                <Sample value={site.area} />
              </p>
            </div>
            <PhotoSlot photo={site.photos.hero} className="design-a__photo--hero" />
          </div>
        </section>

        <Waveform size="lg" />

        <section id="about" tabIndex={-1} className="design-a__section design-a__about" aria-labelledby="a-about-title">
          <div className="design-a__wrap design-a__about-grid">
            <div className="design-a__about-copy">
              <p className="design-a__mono design-a__eyebrow">
                <Sample value={site.city} />
              </p>
              <h2 id="a-about-title" className="design-a__h2">{about.heading}</h2>
              <p className="design-a__lead">
                <Sample value={about.short} />
              </p>
              {about.long.map((para) => (
                <p key={para.text} className="design-a__body">
                  <Sample value={para} />
                </p>
              ))}
            </div>
            <PhotoSlot photo={site.photos.about} className="design-a__photo--about" />
          </div>
        </section>

        <section id="services" tabIndex={-1} className="design-a__section design-a__services" aria-labelledby="a-services-title">
          <div className="design-a__wrap">
            <div className="design-a__section-head">
              <p className="design-a__mono design-a__eyebrow">{services.intro}</p>
              <h2 id="a-services-title" className="design-a__h2">{services.heading}</h2>
            </div>
            <ul className="design-a__setlist">
              {services.items.map((item) => {
                const Icon = CONTENT_ICONS[item.icon];
                return (
                  <li key={item.value} className="design-a__set">
                    <Icon aria-hidden="true" className="design-a__set-icon" />
                    <h3 className="design-a__set-name">{item.label}</h3>
                    <p className="design-a__set-desc">
                      <Sample value={item.description} />
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <Waveform />

        <section id="gear" tabIndex={-1} className="design-a__section design-a__gear" aria-labelledby="a-gear-title">
          <div className="design-a__wrap">
            <div className="design-a__section-head">
              <h2 id="a-gear-title" className="design-a__h2">{gear.heading}</h2>
              <p className="design-a__body design-a__section-intro">{gear.intro}</p>
            </div>
            <ul className="design-a__rack">
              {gear.items.map((item) => {
                const Icon = CONTENT_ICONS[item.icon];
                return (
                  <Sample as="li" block when={item.placeholder} key={item.name} className="design-a__unit">
                    <span className="design-a__unit-led" aria-hidden="true" />
                    <Icon aria-hidden="true" className="design-a__unit-icon" />
                    <span className="design-a__unit-text">
                      <span className="design-a__unit-name">{item.name}</span>
                      <span className="design-a__unit-desc">{item.description}</span>
                    </span>
                  </Sample>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="testimonials" tabIndex={-1} className="design-a__section design-a__quotes" aria-labelledby="a-quotes-title">
          <div className="design-a__wrap">
            <div className="design-a__section-head">
              <h2 id="a-quotes-title" className="design-a__h2">{testimonials.heading}</h2>
            </div>
            <ul className="design-a__quote-list">
              {testimonials.items.map((t, i) => (
                <Sample as="li" block when={t.placeholder} key={i} className="design-a__quote">
                  <figure>
                    <blockquote>
                      <p>{t.quote}</p>
                    </blockquote>
                    <figcaption className="design-a__mono">
                      {t.author}, {t.event}
                    </figcaption>
                  </figure>
                </Sample>
              ))}
            </ul>
          </div>
        </section>

        <Waveform />

        <section id="book" ref={bookRef} tabIndex={-1} className="design-a__section design-a__book" aria-labelledby="a-book-title">
          <div className="design-a__wrap design-a__book-grid">
            <div className="design-a__book-copy">
              <h2 id="a-book-title" className="design-a__h2 design-a__book-title">{booking.heading}</h2>
              <p className="design-a__body">{booking.intro}</p>
              <div className="design-a__book-direct">
                <p className="design-a__mono">{contact.intro}</p>
                <a href={contact.email.href}>
                  <Sample value={contact.email} />
                </a>
                <a href={contact.phone.href}>
                  <Sample value={contact.phone} />
                </a>
              </div>
            </div>
            <div className="design-a__book-panel">
              <BookingForm idPrefix="a" />
            </div>
          </div>
        </section>

        <section id="contact" tabIndex={-1} className="design-a__section design-a__contact" aria-labelledby="a-contact-title">
          <div className="design-a__wrap design-a__contact-grid">
            <div>
              <h2 id="a-contact-title" className="design-a__h2">{contact.heading}</h2>
              <p className="design-a__body">{contact.intro}</p>
            </div>
            <ul className="design-a__contact-list">
              <li>
                <span className="design-a__mono">Email</span>
                <a href={contact.email.href} className="design-a__contact-link">
                  <Sample value={contact.email} />
                </a>
              </li>
              <li>
                <span className="design-a__mono">Phone</span>
                <a href={contact.phone.href} className="design-a__contact-link">
                  <Sample value={contact.phone} />
                </a>
              </li>
              {site.socials.map((s) => {
                const Icon = CONTENT_ICONS[s.icon];
                return (
                  <li key={s.label}>
                    <span className="design-a__mono">Social</span>
                    <Sample when={s.placeholder}>
                      <a href={s.href} className="design-a__contact-link design-a__social" target="_blank" rel="noopener noreferrer">
                        <Icon aria-hidden="true" />
                        {s.label}
                      </a>
                    </Sample>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>

      <footer className="design-a__footer">
        <Waveform />
        <div className="design-a__wrap design-a__footer-inner">
          <p className="design-a__footer-mark" aria-hidden="true">
            {site.name}
          </p>
          <p className="design-a__footer-copy">
            © {new Date().getFullYear()} {site.footer.text}
          </p>
        </div>
      </footer>

      <a
        href={bookCta.href}
        className="design-a__fab"
        data-hidden={fabHidden}
        aria-hidden={fabHidden || undefined}
        tabIndex={fabHidden ? -1 : undefined}
      >
        {bookCta.label}
      </a>
    </div>
  );
}
