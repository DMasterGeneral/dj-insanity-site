import BookingForm from '../../../../components/BookingForm.jsx';
import { site } from '../../../../content/site.js';
import { useLiveStatus } from '../../../../lib/useLiveStatus.js';
import './a.css';

// Stub for Design A, Club night. Replace with the real design; keep the contract in ../README.md.
export default function DesignA() {
  const { live, eventName } = useLiveStatus();

  return (
    <div className="design-a">
      {live && (
        <p className="design-a__live">
          <strong>{site.live.label}</strong>
          {eventName ? ` at ${eventName}` : ''}. <a href={site.live.href}>{site.live.cta}</a>
        </p>
      )}
      <main className="design-a__main">
        <h1>Design A — Club night (in progress)</h1>
        <section id="book" aria-labelledby="a-book-title" className="design-a__book">
          <h2 id="a-book-title">{site.booking.heading}</h2>
          <p>{site.booking.intro}</p>
          <BookingForm idPrefix="a" />
        </section>
      </main>
    </div>
  );
}
