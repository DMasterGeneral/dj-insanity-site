// Pure mapping, sorting and formatting helpers for the DJ dashboard. No React, no Firebase:
// both data sources and the tests use these.

import { EVENT_TYPES, eventLengthMinutes } from '../../../../shared/contracts.js';

export const REQUEST_STATUSES = Object.freeze(['awaiting_payment', 'pending', 'played', 'dismissed']);
export const BOOKING_STATUSES = Object.freeze(['new', 'contacted', 'booked', 'declined', 'archived']);
export const TIP_STATES = Object.freeze(['none', 'pending', 'paid', 'failed']);
export const TONIGHT_WINDOW_MS = 12 * 60 * 60 * 1000;

/** @param {unknown} v */
function str(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/** @param {unknown} v */
function obj(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? /** @type {Record<string, any>} */ (v) : {};
}

/**
 * Milliseconds since epoch from a Firestore Timestamp, a Date, a number, or a {seconds} object.
 * null when there is nothing usable.
 * @param {unknown} v
 * @returns {number|null}
 */
export function toMillis(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (v && typeof v === 'object') {
    const t = /** @type {any} */ (v);
    if (typeof t.toMillis === 'function') {
      try {
        const ms = t.toMillis();
        return Number.isFinite(ms) ? ms : null;
      } catch {
        return null;
      }
    }
    if (typeof t.seconds === 'number') return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  }
  return null;
}

/**
 * @typedef {Object} DashRequest
 * @property {string} id
 * @property {string} title
 * @property {string} artist
 * @property {string|null} artworkUrl
 * @property {boolean} explicit
 * @property {string|null} url            for link requests
 * @property {string|null} note
 * @property {string|null} requesterName
 * @property {'awaiting_payment'|'pending'|'played'|'dismissed'|'unknown'} status
 * @property {{ amountCents: number, state: 'none'|'pending'|'paid'|'failed' }} tip
 * @property {number|null} createdAt     ms
 * @property {number|null} updatedAt     ms
 */

/**
 * Map a requests/{id} document to a flat, safe shape. Tolerates old 2025 test docs
 * (`type/content/title/tip:number/timestamp`) and anything else odd: it never throws.
 * An old numeric `tip` was never verified, so it maps to state 'none'.
 * @param {string} id
 * @param {unknown} data
 * @returns {DashRequest}
 */
export function normalizeRequest(id, data) {
  const d = obj(data);
  const song = obj(d.song);
  const title = str(song.title) || str(d.title) || str(d.content) || 'Untitled request';
  const artist = str(song.artist);
  const artwork = str(song.artworkUrl);
  const url = str(song.url) || (/^https?:\/\//i.test(str(d.content)) ? str(d.content) : '');
  const tipObj = obj(d.tip);
  const amount = Number.isInteger(tipObj.amountCents) && tipObj.amountCents > 0 ? tipObj.amountCents : 0;
  const state = TIP_STATES.includes(tipObj.state) ? tipObj.state : 'none';
  const status = REQUEST_STATUSES.includes(d.status) ? d.status : 'unknown';
  return {
    id: String(id),
    title,
    artist,
    artworkUrl: /^https:\/\//i.test(artwork) ? artwork : null,
    explicit: song.explicit === true,
    url: url || null,
    note: str(d.note) || null,
    requesterName: str(d.requesterName) || null,
    status: /** @type {DashRequest['status']} */ (status),
    tip: { amountCents: amount, state: /** @type {DashRequest['tip']['state']} */ (state) },
    createdAt: toMillis(d.createdAt),
    updatedAt: toMillis(d.updatedAt),
  };
}

/** Paid tip in cents; 0 unless the tip is confirmed paid. @param {DashRequest} r */
export function paidTipCents(r) {
  return r.tip.state === 'paid' ? r.tip.amountCents : 0;
}

/** True when the gold tip chip should show. @param {DashRequest} r */
export function hasPaidTip(r) {
  return paidTipCents(r) > 0;
}

/** @param {{ createdAt: number|null }} a @param {{ createdAt: number|null }} b */
function byNewest(a, b) {
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

/** Newest first. Returns a new array. @param {DashRequest[]} list */
export function sortNewest(list) {
  return [...list].sort(byNewest);
}

/** Biggest paid tip first; equal tips (including none) newest first. Returns a new array. @param {DashRequest[]} list */
export function sortTipsFirst(list) {
  return [...list].sort((a, b) => paidTipCents(b) - paidTipCents(a) || byNewest(a, b));
}

/**
 * Counts for the "Tonight" header: requests created in the last 12 hours.
 * @param {DashRequest[]} list
 * @param {number} now ms
 */
export function tonightTotals(list, now) {
  const since = now - TONIGHT_WINDOW_MS;
  let pending = 0;
  let played = 0;
  let tipsCents = 0;
  for (const r of list) {
    if (r.createdAt === null || r.createdAt < since) continue;
    if (r.status === 'pending') pending++;
    else if (r.status === 'played') played++;
    if (r.status !== 'awaiting_payment') tipsCents += paidTipCents(r);
  }
  return { pending, played, tipsCents };
}

/**
 * @typedef {Object} DashBooking
 * @property {string} id
 * @property {string} name
 * @property {string|null} phone
 * @property {string|null} email
 * @property {'call'|'text'|'email'|null} contactPreference
 * @property {string|null} date            YYYY-MM-DD
 * @property {string|null} startTime       HH:mm
 * @property {string|null} endTime         HH:mm
 * @property {string} eventType
 * @property {string} eventTypeLabel
 * @property {string|null} location
 * @property {string|null} notes
 * @property {'new'|'contacted'|'booked'|'declined'|'archived'} status
 * @property {number|null} createdAt
 */

/**
 * Map a bookings/{id} document. Never throws; unknown status reads as 'new'.
 * @param {string} id
 * @param {unknown} data
 * @returns {DashBooking}
 */
export function normalizeBooking(id, data) {
  const d = obj(data);
  const eventType = str(d.eventType);
  const known = EVENT_TYPES.find((t) => t.value === eventType);
  const pref = str(d.contactPreference);
  const date = str(d.date);
  const start = str(d.startTime);
  const end = str(d.endTime);
  return {
    id: String(id),
    name: str(d.name) || 'No name given',
    phone: str(d.phone) || null,
    email: str(d.email) || null,
    contactPreference: pref === 'call' || pref === 'text' || pref === 'email' ? pref : null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    startTime: /^\d{2}:\d{2}$/.test(start) ? start : null,
    endTime: /^\d{2}:\d{2}$/.test(end) ? end : null,
    eventType,
    eventTypeLabel: known ? known.label : eventType || 'Event',
    location: str(d.location) || null,
    notes: str(d.notes) || null,
    status: BOOKING_STATUSES.includes(d.status) ? d.status : 'new',
    createdAt: toMillis(d.createdAt) ?? toMillis(d.timestamp),
  };
}

/** Local YYYY-MM-DD for a time. @param {number} ms */
export function localDateKey(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Upcoming events (today or later) soonest first, then past events most recent first, then
 * bookings with no date (newest enquiry first).
 * @param {DashBooking[]} list
 * @param {string} today YYYY-MM-DD
 */
export function sortBookings(list, today) {
  const rank = (b) => (b.date === null ? 2 : b.date >= today ? 0 : 1);
  return [...list].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || '');
    if (ra === 1) return b.date.localeCompare(a.date);
    return byNewest(a, b);
  });
}

// ---- Formatting ------------------------------------------------------------------------------

/** "$12" or "$12.50". @param {number} cents */
export function formatMoney(cents) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** "just now", "4 min ago", "2 h ago", "3 days ago". @param {number|null} ms @param {number} now */
export function formatAge(ms, now) {
  if (ms === null) return 'unknown time';
  const min = Math.floor((now - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** "Sat, Dec 6, 2026" from YYYY-MM-DD. @param {string|null} date */
export function formatDate(date) {
  if (!date) return 'Date not given';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** "8:00 PM" from HH:mm. @param {string} hhmm */
export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "8:00 PM – 1:00 AM (5 h)" or null. @param {string|null} start @param {string|null} end */
export function formatTimeRange(start, end) {
  if (!start || !end) return start ? formatTime(start) : null;
  const len = eventLengthMinutes(start, end);
  let length = '';
  if (Number.isFinite(len) && len > 0) {
    const h = Math.floor(len / 60);
    const m = len % 60;
    length = ` (${h ? `${h} h` : ''}${h && m ? ' ' : ''}${m ? `${m} min` : ''})`;
  }
  return `${formatTime(start)} – ${formatTime(end)}${length}`;
}
