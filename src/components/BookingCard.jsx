import { useEffect, useRef, useState } from 'react';
import { Calendar, Phone, MessageSquare } from 'lucide-react';
import GlassCard from './GlassCard';
import { validateBooking } from '../../shared/contracts.js';
import { ApiError, apiPost } from '../lib/api.js';
import { createTurnstile } from '../lib/turnstile.js';

// The original (Classic) quick booking card. Sends to POST /api/bookings with the shared
// contract's field names (validateBooking); the browser never writes to Firestore.

// Generate time options in 30-minute increments
const generateTimeOptions = () => {
  const times = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hour = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      const display = `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      times.push({ display, value });
    }
  }
  return times;
};

// Format phone number as (555) 555-5555
const formatPhoneNumber = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const timeOptions = generateTimeOptions();

/** Today as YYYY-MM-DD in the visitor's own time zone. */
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY_FORM = {
  name: '',
  phone: '',
  contactPreference: 'text',
  date: '',
  startTime: '',
  endTime: '',
  eventType: ''
};

const FieldError = ({ message }) =>
  message ? <p className="text-sm font-semibold text-red-400 -mt-1">{message}</p> : null;

export default function BookingCard() {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [turnstile] = useState(() => createTurnstile('booking'));
  const cardRef = useRef(null);
  const turnstileBox = useRef(null);

  useEffect(() => () => turnstile.remove(), [turnstile]);

  // The request page's "Book" link points here (/#book); the card renders after the page loads.
  useEffect(() => {
    if (window.location.hash === '#book') cardRef.current?.scrollIntoView();
  }, []);

  const validate = () => {
    const result = validateBooking(formData, { today: localToday() });
    const newErrors = result.ok ? {} : { ...result.errors };

    // This card has no email field and takes US numbers only: exactly 10 digits
    delete newErrors.email;
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) newErrors.phone = 'Enter a 10-digit phone number.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !validate()) return;

    setSubmitting(true);
    setFailure(null);
    try {
      const token = await turnstile.getToken(turnstileBox.current);
      await apiPost('/api/bookings', token ? { ...formData, turnstileToken: token } : formData);
      setSubmitted(true);
      setFormData(EMPTY_FORM);
      setErrors({});
    } catch (error) {
      const fields = error instanceof ApiError && error.fields ? error.fields : null;
      if (fields && Object.keys(EMPTY_FORM).some((f) => fields[f])) setErrors(fields);
      else setFailure(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      turnstile.reset();
    }
    setSubmitting(false);
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 bg-white/5 border rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all placeholder:text-white/30 ${errors[field] ? 'border-red-500 ring-1 ring-red-500' : 'border-white/10'
    }`;

  const selectClass = (field) =>
    `w-full px-4 py-3 bg-white/5 border rounded-xl focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric transition-all ${errors[field]
      ? 'border-red-500 ring-1 ring-red-500 text-white/70'
      : 'border-white/10 text-white/70'
    }`;

  if (submitted) {
    return (
      <GlassCard className="flex flex-col items-center justify-center text-center">
        <div className="text-electric text-5xl mb-4">✓</div>
        <h2 className="font-bold text-xl mb-2">Request Received!</h2>
        <p className="text-white/60">We'll get back to you soon.</p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-electric underline"
        >
          Submit another
        </button>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col">
      <div id="book" ref={cardRef} className="flex items-center gap-2 text-electric mb-4 scroll-mt-12">
        <Calendar size={20} />
        <h2 className="font-bold text-lg">Quick Booking</h2>
      </div>

      <form
        onSubmit={handleSubmit}
        onFocus={() => turnstile.start(turnstileBox.current)}
        noValidate
        className="space-y-3 flex-1 flex flex-col"
      >
        {/* Name */}
        <input
          type="text"
          placeholder="Your Name"
          className={inputClass('name')}
          value={formData.name}
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: false });
          }}
        />
        <FieldError message={errors.name} />

        {/* Phone + Contact Preference */}
        <div className="flex gap-2">
          <input
            type="tel"
            placeholder="Phone Number"
            className={`${inputClass('phone')} flex-1`}
            value={formData.phone}
            onChange={(e) => {
              const formatted = formatPhoneNumber(e.target.value);
              setFormData({ ...formData, phone: formatted });
              if (errors.phone) setErrors({ ...errors, phone: false });
            }}
          />
          <div className="flex bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, contactPreference: 'call' })
              }
              className={`px-3 py-2 flex items-center gap-1 text-sm transition-all ${formData.contactPreference === 'call'
                  ? 'bg-electric text-white'
                  : 'text-white/50 hover:text-white/80'
                }`}
              title="Prefer Call"
            >
              <Phone size={16} />
            </button>
            <button
              type="button"
              onClick={() =>
                setFormData({ ...formData, contactPreference: 'text' })
              }
              className={`px-3 py-2 flex items-center gap-1 text-sm transition-all ${formData.contactPreference === 'text'
                  ? 'bg-electric text-white'
                  : 'text-white/50 hover:text-white/80'
                }`}
              title="Prefer Text"
            >
              <MessageSquare size={16} />
            </button>
          </div>
        </div>

        <FieldError message={errors.phone} />

        {/* Date */}
        <div className="relative">
          <input
            type="date"
            min={localToday()}
            className={`${inputClass('date')} [color-scheme:dark] appearance-none min-h-[48px]`}
            style={{
              color: formData.date ? 'rgba(255,255,255,0.7)' : 'transparent',
            }}
            value={formData.date}
            onChange={(e) => {
              setFormData({ ...formData, date: e.target.value });
              if (errors.date) setErrors({ ...errors, date: false });
            }}
          />
          {!formData.date && (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">
              Select Event Date
            </span>
          )}
        </div>

        <FieldError message={errors.date} />

        {/* Time Range */}
        <div className="flex gap-2 items-center">
          <select
            className={selectClass('startTime')}
            value={formData.startTime}
            onChange={(e) => {
              setFormData({ ...formData, startTime: e.target.value });
              if (errors.startTime) setErrors({ ...errors, startTime: false });
            }}
          >
            <option value="" disabled className="bg-midnight text-white/50">
              Start Time
            </option>
            {timeOptions.map((t) => (
              <option key={t.value} value={t.value} className="bg-midnight">
                {t.display}
              </option>
            ))}
          </select>
          <span className="text-white/40 text-sm whitespace-nowrap">to</span>
          <select
            className={selectClass('endTime')}
            value={formData.endTime}
            onChange={(e) => {
              setFormData({ ...formData, endTime: e.target.value });
              if (errors.endTime) setErrors({ ...errors, endTime: false });
            }}
          >
            <option value="" disabled className="bg-midnight text-white/50">
              End Time
            </option>
            {timeOptions.map((t) => (
              <option key={t.value} value={t.value} className="bg-midnight">
                {t.display}
              </option>
            ))}
          </select>
        </div>

        <FieldError message={errors.startTime || errors.endTime} />

        {/* Event Type */}
        <select
          className={selectClass('eventType')}
          value={formData.eventType}
          onChange={(e) => {
            setFormData({ ...formData, eventType: e.target.value });
            if (errors.eventType) setErrors({ ...errors, eventType: false });
          }}
        >
          <option value="" disabled className="bg-midnight text-white/50">
            Select Event Type
          </option>
          <option value="wedding" className="bg-midnight">
            Wedding
          </option>
          <option value="club_bar" className="bg-midnight">
            Club Night
          </option>
          <option value="private_party" className="bg-midnight">
            Private Party
          </option>
          <option value="corporate" className="bg-midnight">
            Corporate Event
          </option>
          <option value="other" className="bg-midnight">
            Other
          </option>
        </select>

        <FieldError message={errors.eventType} />

        <div ref={turnstileBox} className="empty:hidden" />

        {failure && (
          <p role="alert" className="rounded-xl border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">
            {failure}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="mt-auto w-full py-3 bg-gradient-to-r from-electric to-blue-400 rounded-xl font-bold hover:opacity-90 transition-all hover:scale-[1.02] disabled:opacity-50"
        >
          {submitting ? 'Sending...' : 'Check Availability'}
        </button>
      </form>
    </GlassCard>
  );
}
