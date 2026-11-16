// Booking notifications: email through Resend, plus an optional push (ntfy-style) to PUSH_URL.
// Resend without a verified domain delivers only to the Resend account owner's own address,
// which is the intended setup (the DJ notifying himself).

import { EVENT_TYPES, CONTACT_PREFERENCES, eventLengthMinutes } from '../../shared/contracts.js';

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'DJ Insanity Bookings <onboarding@resend.dev>';
const TIMEOUT_MS = 10_000;

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CONTACT_LABELS = { call: 'Call', text: 'Text', email: 'Email' };

/**
 * "2027-03-14" → "Sun, Mar 14 2027".
 * @param {string} ymd
 */
export function formatDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return ymd;
  return `${DAYS[date.getUTCDay()]}, ${MONTHS[m - 1]} ${d} ${y}`;
}

/**
 * "20:30" → "8:30 PM".
 * @param {string} hhmm
 */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return hhmm;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** @param {number} minutes */
function formatLength(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

/** @param {unknown} s */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {string} value */
function eventLabel(value) {
  return EVENT_TYPES.find((t) => t.value === value)?.label || value;
}

/**
 * The email's subject, plain text and HTML.
 * @param {import('../../shared/contracts.js').Booking} b
 * @param {{ id: string, origin: string }} meta
 */
export function bookingEmail(b, { id, origin }) {
  const type = eventLabel(b.eventType);
  const date = formatDate(b.date);
  const length = formatLength(eventLengthMinutes(b.startTime, b.endTime));
  const time = `${formatTime(b.startTime)} – ${formatTime(b.endTime)}${length ? ` (${length})` : ''}`;
  const pref = CONTACT_PREFERENCES.includes(b.contactPreference) ? CONTACT_LABELS[b.contactPreference] : b.contactPreference;
  const dashboard = `${origin.replace(/\/+$/, '')}/dj`;
  const subject = `New booking request — ${type}, ${date}`;

  /** @type {[string, string, string|null][]} label, text, html (null = escaped text) */
  const rows = [
    ['Name', b.name, null],
    [
      'Phone',
      b.phone || '—',
      b.phone
        ? `${escapeHtml(b.phone)} · <a href="tel:${escapeHtml(b.phone)}">Call</a> · <a href="sms:${escapeHtml(b.phone)}">Text</a>`
        : null,
    ],
    ['Email', b.email || '—', b.email ? `<a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a>` : null],
    ['Preferred contact', pref, null],
    ['Event type', type, null],
    ['Date', date, null],
    ['Time', time, null],
    ['Location', b.location || '—', null],
    ['Notes', b.notes || '—', null],
  ];

  const text = [
    `New booking request (${id})`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    ...(b.phone ? [`Call: tel:${b.phone}`, `Text: sms:${b.phone}`] : []),
    ...(b.email ? [`Email: mailto:${b.email}`] : []),
    `Dashboard: ${dashboard}`,
  ].join('\n');

  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<h2 style="margin:0 0 12px">New booking request</h2>
<table cellpadding="6" style="border-collapse:collapse">
${rows
  .map(
    ([label, value, rich]) =>
      `<tr><th align="left" valign="top" style="padding-right:16px">${escapeHtml(label)}</th><td style="white-space:pre-wrap">${rich ?? escapeHtml(value)}</td></tr>`,
  )
  .join('\n')}
</table>
<p><a href="${escapeHtml(dashboard)}">Open the DJ dashboard</a></p>
<p style="color:#666;font-size:12px">Booking ID ${escapeHtml(id)}</p>
</body></html>`;

  return { subject, text, html };
}

/**
 * Send the booking notifications. Never throws.
 * @param {Record<string, string|undefined>} env
 * @param {import('../../shared/contracts.js').Booking} booking
 * @param {{ id: string, origin: string }} meta
 * @returns {Promise<{ email: 'sent'|'skipped'|'failed', push: 'sent'|'skipped'|'failed', error?: string }>}
 */
export async function notifyBooking(env, booking, meta) {
  /** @type {string[]} */
  const errors = [];
  const { subject, text, html } = bookingEmail(booking, meta);

  /** @type {'sent'|'skipped'|'failed'} */
  let email = 'skipped';
  const to = (env.NOTIFY_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (env.RESEND_API_KEY && to.length) {
    try {
      /** @type {Record<string, unknown>} */
      const payload = { from: FROM, to, subject, text, html };
      if (booking.email) payload.reply_to = booking.email;
      const res = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) email = 'sent';
      else {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`.trim());
      }
    } catch (err) {
      email = 'failed';
      errors.push(`email: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** @type {'sent'|'skipped'|'failed'} */
  let push = 'skipped';
  if (env.PUSH_URL) {
    try {
      const type = eventLabel(booking.eventType);
      const lines = [
        `${type}, ${formatDate(booking.date)}, ${formatTime(booking.startTime)}-${formatTime(booking.endTime)}`,
        `${booking.name}${booking.phone ? ` ${booking.phone}` : ''}${booking.email ? ` ${booking.email}` : ''}`,
        `${meta.origin.replace(/\/+$/, '')}/dj`,
      ];
      const res = await fetch(env.PUSH_URL, {
        method: 'POST',
        // Header values must be ASCII; the title is fixed text.
        headers: { Title: 'New booking request', 'Content-Type': 'text/plain; charset=utf-8' },
        body: lines.join('\n'),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      push = 'sent';
    } catch (err) {
      push = 'failed';
      errors.push(`push: ${err instanceof Error ? err.message : err}`);
    }
  }

  return errors.length ? { email, push, error: errors.join('; ').slice(0, 300) } : { email, push };
}
