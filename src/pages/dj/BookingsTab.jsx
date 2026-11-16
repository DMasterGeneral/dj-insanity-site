import { useState } from 'react';
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import { Button } from '../../components/ui';
import { source } from './data/source.js';
import { BOOKING_STATUSES, formatDate, formatTimeRange, localDateKey, sortBookings } from './data/model.js';

const STATUS_LABELS = { new: 'New', contacted: 'Contacted', booked: 'Booked', declined: 'Declined', archived: 'Archived' };
const PREF_LABELS = { call: 'a call', text: 'a text', email: 'an email' };

/**
 * @param {{ bookings: import('./data/model.js').DashBooking[], loading: boolean, now: number,
 *           notify: (text: string) => void }} props
 */
export default function BookingsTab({ bookings, loading, now, notify }) {
  const today = localDateKey(now);
  const sorted = sortBookings(bookings, today);
  const upcoming = sorted.filter((b) => b.date !== null && b.date >= today);
  const past = sorted.filter((b) => !(b.date !== null && b.date >= today));

  if (loading) {
    return (
      <p className="dj-empty" role="status">
        Loading bookings…
      </p>
    );
  }
  if (!bookings.length) return <p className="dj-empty">No booking requests yet.</p>;

  return (
    <div className="dj-stack">
      <section aria-labelledby="dj-upcoming-title" className="dj-stack">
        <h2 id="dj-upcoming-title" className="dj-section-title">
          Upcoming
        </h2>
        {upcoming.length ? (
          <ul className="dj-cards">
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} notify={notify} />
            ))}
          </ul>
        ) : (
          <p className="dj-empty">No upcoming events.</p>
        )}
      </section>
      {past.length > 0 && (
        <section aria-labelledby="dj-past-title" className="dj-stack">
          <h2 id="dj-past-title" className="dj-section-title">
            Past or undated
          </h2>
          <ul className="dj-cards">
            {past.map((b) => (
              <BookingCard key={b.id} b={b} notify={notify} past />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** @param {{ b: import('./data/model.js').DashBooking, notify: (text: string) => void, past?: boolean }} props */
function BookingCard({ b, notify, past = false }) {
  // Shows the chosen status straight away while the write is in flight.
  const [saving, setSaving] = useState(/** @type {string|null} */ (null));
  const status = saving ?? b.status;
  const selectId = `dj-booking-status-${b.id}`;
  const time = formatTimeRange(b.startTime, b.endTime);

  function onStatus(e) {
    const next = e.target.value;
    setSaving(next);
    source.setBookingStatus(b.id, next).then(
      () => setSaving(null),
      () => {
        setSaving(null);
        notify("Couldn't change the status. Check the connection and try again.");
      },
    );
  }

  return (
    <li className={`dj-card dj-booking ${past ? 'is-past' : ''}`}>
      <div className="dj-booking__head">
        <div>
          <h3 className="dj-booking__name">{b.name}</h3>
          <p className="dj-booking__type">{b.eventTypeLabel}</p>
        </div>
        <span className={`dj-status dj-status--${status}`}>{STATUS_LABELS[status]}</span>
      </div>

      <p className="dj-booking__when">
        <strong>{formatDate(b.date)}</strong>
        {time && <span>{time}</span>}
      </p>
      {b.location && (
        <p className="dj-booking__line">
          <MapPin size={16} aria-hidden="true" /> {b.location}
        </p>
      )}
      {(b.phone || b.email) && <p className="dj-booking__line dj-muted">{[b.phone, b.email].filter(Boolean).join(' · ')}</p>}
      {b.notes && <p className="dj-booking__notes">{b.notes}</p>}
      {b.contactPreference && <p className="dj-muted">Prefers {PREF_LABELS[b.contactPreference]}.</p>}

      <div className="dj-booking__contact">
        {b.phone && (
          <Button href={`tel:${b.phone}`} variant={b.contactPreference === 'call' ? 'primary' : 'secondary'} size="sm" aria-label={`Call ${b.name}`}>
            <Phone size={16} aria-hidden="true" /> Call
          </Button>
        )}
        {b.phone && (
          <Button href={`sms:${b.phone}`} variant={b.contactPreference === 'text' ? 'primary' : 'secondary'} size="sm" aria-label={`Text ${b.name}`}>
            <MessageSquare size={16} aria-hidden="true" /> Text
          </Button>
        )}
        {b.email && (
          <Button href={`mailto:${b.email}`} variant={b.contactPreference === 'email' ? 'primary' : 'secondary'} size="sm" aria-label={`Email ${b.name}`}>
            <Mail size={16} aria-hidden="true" /> Email
          </Button>
        )}
      </div>

      <div className="dj-booking__status">
        <label htmlFor={selectId}>Status</label>
        <select id={selectId} className="ui-field__control" value={status} onChange={onStatus}>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </li>
  );
}
