import BookingForm from '../../../../components/BookingForm.jsx';
import { site } from '../../../../content/site.js';
import { useLiveStatus } from '../../../../lib/useLiveStatus.js';
import './b.css';

// Stub for Design B, Premium events. Replace with the real design; keep the contract in ../README.md.
export default function DesignB() {
  const { live, eventName } = useLiveStatus();

  return (
    <div className="design-b">
      {live && (
        <p className="design-b__live">
          <strong>{site.live.label}</strong>
          {eventName ? ` at ${eventName}` : ''}. <a href={site.live.href}>{site.live.cta}</a>
        </p>
      )}
      <main className="design-b__main">
        <h1>Design B — Premium events (in progress)</h1>
        <section id="book" aria-labelledby="b-book-title" className="design-b__book">
          <h2 id="b-book-title">{site.booking.heading}</h2>
          <p>{site.booking.intro}</p>
          <BookingForm idPrefix="b" />
        </section>
      </main>
    </div>
  );
}
