import BookingForm from '../../../../components/BookingForm.jsx';
import { site } from '../../../../content/site.js';
import { useLiveStatus } from '../../../../lib/useLiveStatus.js';
import './c.css';

// Stub for Design C, Gig poster. Replace with the real design; keep the contract in ../README.md.
export default function DesignC() {
  const { live, eventName } = useLiveStatus();

  return (
    <div className="design-c">
      {live && (
        <p className="design-c__live">
          <strong>{site.live.label}</strong>
          {eventName ? ` at ${eventName}` : ''}. <a href={site.live.href}>{site.live.cta}</a>
        </p>
      )}
      <main className="design-c__main">
        <h1>Design C — Gig poster (in progress)</h1>
        <section id="book" aria-labelledby="c-book-title" className="design-c__book">
          <h2 id="c-book-title">{site.booking.heading}</h2>
          <p>{site.booking.intro}</p>
          <BookingForm idPrefix="c" />
        </section>
      </main>
    </div>
  );
}
