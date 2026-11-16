import { createElement, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Mail, MessageSquare, Phone } from 'lucide-react';
import {
  BOOKING_LOCATION_MAX,
  BOOKING_NAME_MAX,
  BOOKING_NOTES_MAX,
  EVENT_TYPES,
  eventLengthMinutes,
  validateBooking,
} from '../../shared/contracts.js';
import { site } from '../content/site.js';
import { ApiError, apiPost } from '../lib/api.js';
import Field from './ui/Field.jsx';
import Button from './ui/Button.jsx';
import Sample from './Sample.jsx';
import './ui/ui.css';
import './BookingForm.css';

// The booking form shared by every landing design (plan section 4.3). Themed by the --ui-* variables.
// Validation is shared/contracts.js validateBooking, the same function the server runs.

const FIELDS = ['name', 'phone', 'email', 'contactPreference', 'date', 'startTime', 'endTime', 'eventType', 'location', 'notes'];
const EMPTY = Object.fromEntries(FIELDS.map((f) => [f, '']));

const CONTACT_OPTIONS = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 ? 30 : 0;
  const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const label = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  return { value, label };
});

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_WAIT_MS = 10000;

/** Today as YYYY-MM-DD in the visitor's own time zone. */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** @param {number} minutes */
function formatLength(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const parts = [];
  if (h) parts.push(`${h} hour${h === 1 ? '' : 's'}`);
  if (m) parts.push(`${m} minutes`);
  return parts.join(' ');
}

/** @type {Promise<any> | null} */
let turnstileScript = null;
function loadTurnstile() {
  turnstileScript ??= new Promise((resolve) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => resolve(window.turnstile ?? null);
    s.onerror = () => {
      turnstileScript = null; // allow a later retry
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return turnstileScript;
}

/**
 * @param {{ idPrefix: string, className?: string, onSuccess?: (data: any) => void }} props
 *   idPrefix: makes every id unique on the page, e.g. "a" → "a-booking-name".
 */
export default function BookingForm({ idPrefix, className = '', onSuccess }) {
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState(/** @type {Record<string, boolean>} */ ({}));
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [status, setStatus] = useState(/** @type {'idle'|'sending'|'failed'|'done'} */ ('idle'));
  const [failure, setFailure] = useState(/** @type {string|null} */ (null));

  const successRef = useRef(/** @type {HTMLHeadingElement|null} */ (null));
  const turnstileBox = useRef(/** @type {HTMLDivElement|null} */ (null));
  const turnstile = useRef({ started: false, widgetId: /** @type {string|null} */ (null), token: /** @type {string|null} */ (null), waiters: /** @type {((t: string|null) => void)[]} */ ([]) });

  const id = (name) => `${idPrefix}-booking-${name}`;
  const today = localToday();
  const check = validateBooking(values, { today });
  const clientErrors = check.ok ? {} : check.errors;
  const errorFor = (name) => serverErrors[name] || ((touched[name] || attempted) && clientErrors[name]) || null;

  useEffect(() => {
    if (status === 'done') successRef.current?.focus();
  }, [status]);

  useEffect(() => {
    const ts = turnstile.current;
    return () => {
      if (ts.widgetId !== null) window.turnstile?.remove(ts.widgetId);
    };
  }, []);

  // ---- Turnstile (only when a site key is configured) ----------------------------------------

  function startTurnstile() {
    const ts = turnstile.current;
    if (!TURNSTILE_SITE_KEY || ts.started) return;
    ts.started = true;
    const settle = (token) => {
      ts.token = token;
      if (token) ts.waiters.splice(0).forEach((w) => w(token));
    };
    loadTurnstile().then((api) => {
      if (!api || !turnstileBox.current) {
        ts.started = false;
        ts.waiters.splice(0).forEach((w) => w(null));
        return;
      }
      ts.widgetId = api.render(turnstileBox.current, {
        sitekey: TURNSTILE_SITE_KEY,
        action: 'booking',
        appearance: 'interaction-only',
        callback: (token) => settle(token),
        'expired-callback': () => settle(null),
        'error-callback': () => settle(null),
      });
    });
  }

  /** @returns {Promise<string|null>} */
  function getTurnstileToken() {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(null);
    const ts = turnstile.current;
    startTurnstile();
    if (ts.token) return Promise.resolve(ts.token);
    return new Promise((resolve) => {
      ts.waiters.push(resolve);
      setTimeout(() => resolve(null), TOKEN_WAIT_MS);
    });
  }

  function resetTurnstile() {
    const ts = turnstile.current;
    ts.token = null; // tokens are single use
    if (ts.widgetId !== null) window.turnstile?.reset(ts.widgetId);
  }

  // ---- Field handlers -------------------------------------------------------------------------

  function setValue(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
    if (serverErrors[name]) {
      setServerErrors((errs) => {
        const next = { ...errs };
        delete next[name];
        return next;
      });
    }
  }

  function touch(name) {
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }));
  }

  /** Props shared by every text-like control. */
  function controlProps(name) {
    return {
      id: id(name),
      name,
      value: values[name],
      error: errorFor(name),
      onChange: (e) => setValue(name, e.target.value),
      onBlur: () => touch(name),
    };
  }

  /** @param {Record<string, string>} errors */
  function focusFirstInvalid(errors) {
    const name = FIELDS.find((f) => errors[f]);
    if (name) document.getElementById(id(name))?.focus();
  }

  async function submit() {
    if (status === 'sending') return;
    const result = validateBooking(values, { today: localToday() });
    if (!result.ok) {
      flushSync(() => setAttempted(true));
      focusFirstInvalid(result.errors);
      return;
    }
    setAttempted(true);
    setServerErrors({});
    setFailure(null);
    setStatus('sending');
    try {
      const token = await getTurnstileToken();
      const data = await apiPost('/api/bookings', token ? { ...values, turnstileToken: token } : { ...values });
      setStatus('done');
      onSuccess?.(data);
    } catch (err) {
      const fields = err instanceof ApiError && err.fields ? err.fields : null;
      if (fields && FIELDS.some((f) => fields[f])) {
        flushSync(() => {
          setServerErrors(fields);
          setStatus('idle');
        });
        focusFirstInvalid(fields);
      } else {
        setFailure(err instanceof ApiError ? err.message : null);
        setStatus('failed');
      }
    } finally {
      resetTurnstile();
    }
  }

  // ---- Render ---------------------------------------------------------------------------------

  const { booking, contact } = site;

  if (status === 'done') {
    return (
      <div className={`booking-form booking-form--done ${className}`.trim()}>
        <div className="booking-form__panel booking-form__panel--success">
          <h3 ref={successRef} tabIndex={-1} className="booking-form__panel-title">
            {booking.success.heading}
          </h3>
          <p>
            <Sample value={booking.success.text} />
          </p>
        </div>
      </div>
    );
  }

  const lengthMinutes = eventLengthMinutes(values.startTime, values.endTime);
  const pastMidnight = lengthMinutes > 0 && values.endTime < values.startTime;
  const contactError = errorFor('contactPreference');

  return (
    <form
      className={`booking-form ${className}`.trim()}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onFocus={startTurnstile}
    >
      <Field {...controlProps('name')} label="Your name" autoComplete="name" maxLength={BOOKING_NAME_MAX} />

      <div className="booking-form__row">
        <Field
          {...controlProps('phone')}
          label="Phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          hint="A phone number or an email: at least one."
        />
        <Field {...controlProps('email')} label="Email" type="email" inputMode="email" autoComplete="email" />
      </div>

      <fieldset
        className="booking-form__choices"
        aria-describedby={contactError ? id('contactPreference-error') : undefined}
        onBlur={(e) => {
          if (!e.currentTarget.contains(/** @type {Node|null} */ (e.relatedTarget))) touch('contactPreference');
        }}
      >
        <legend className="ui-field__label">How should I contact you?</legend>
        <div className="booking-form__segments">
          {CONTACT_OPTIONS.map(({ value, label, icon }, i) => (
            <label key={value} className="booking-form__segment">
              <input
                id={i === 0 ? id('contactPreference') : undefined}
                type="radio"
                name={id('contactPreference')}
                value={value}
                checked={values.contactPreference === value}
                onChange={() => setValue('contactPreference', value)}
                aria-invalid={contactError ? 'true' : undefined}
                aria-describedby={contactError ? id('contactPreference-error') : undefined}
              />
              {createElement(icon, { size: 18, 'aria-hidden': 'true' })}
              <span>{label}</span>
            </label>
          ))}
        </div>
        {contactError && (
          <p id={id('contactPreference-error')} className="ui-field__error">
            {contactError}
          </p>
        )}
      </fieldset>

      <Field {...controlProps('date')} label="Event date" type="date" min={today} />

      <div className="booking-form__row">
        <Field {...controlProps('startTime')} as="select" label="Start time">
          <option value="">Choose a time</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Field>
        <Field {...controlProps('endTime')} as="select" label="End time">
          <option value="">Choose a time</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Field>
      </div>
      <p className="booking-form__length" aria-live="polite">
        {lengthMinutes > 0 && (
          <>
            Length: <strong>{formatLength(lengthMinutes)}</strong>
            {pastMidnight && ' (ends after midnight, on the next day)'}
          </>
        )}
      </p>

      <div className="booking-form__row">
        <Field {...controlProps('eventType')} as="select" label="Event type">
          <option value="">Choose one</option>
          {EVENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Field>
        <Field
          {...controlProps('location')}
          label="Location"
          optional
          autoComplete="off"
          placeholder="Venue or city"
          maxLength={BOOKING_LOCATION_MAX}
        />
      </div>

      <Field
        {...controlProps('notes')}
        as="textarea"
        label="Notes"
        optional
        rows={4}
        maxLength={BOOKING_NOTES_MAX}
        hint="Guest count, music you love, songs to avoid: anything that helps."
      />

      <div ref={turnstileBox} className="booking-form__turnstile" />

      {status === 'failed' && (
        <div className="booking-form__panel booking-form__panel--failure" role="alert">
          <p className="booking-form__panel-title">{booking.failure.heading}</p>
          <p>{booking.failure.text}</p>
          {failure && <p className="booking-form__detail">{failure}</p>}
          <p className="booking-form__direct">
            <a href={contact.email.href}>
              <Sample value={contact.email} />
            </a>
            <a href={contact.phone.href}>
              <Sample value={contact.phone} />
            </a>
          </p>
          <Button variant="secondary" size="sm" onClick={submit}>
            {booking.failure.retryLabel}
          </Button>
        </div>
      )}

      <Button type="submit" className="booking-form__submit" disabled={status === 'sending'}>
        {status === 'sending' ? booking.sendingLabel : booking.submitLabel}
      </Button>
    </form>
  );
}
