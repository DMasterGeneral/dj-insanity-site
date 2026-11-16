// In-memory demo data for the DJ dashboard. Same interface as firebaseSource.js; nothing leaves
// the browser. A fake request arrives every ~20 s while something is listening, so alerts can be
// tried out.

import { useMemo, useSyncExternalStore } from 'react';
import { normalizeBooking, normalizeRequest } from './model.js';

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const ARRIVAL_MS = 20 * 1000;
const DEMO_USER = Object.freeze({ uid: 'demo', email: 'demo@example.com' });

/** @param {number} offsetDays */
function dateFromToday(offsetDays) {
  const d = new Date(Date.now() + offsetDays * DAY);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Generated cover art (a gradient square), so the demo makes no network requests.
function art(seed) {
  let hue = 0;
  for (const ch of seed) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 80% 55%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 70% 25%)"/></linearGradient></defs><rect width="10" height="10" fill="url(#g)"/><circle cx="5" cy="5" r="2.2" fill="none" stroke="rgba(255,255,255,.55)" stroke-width=".35"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function song(title, artist, explicit = false, seed = null) {
  return { title, artist, explicit, source: 'itunes', ...(seed ? { demoArt: art(seed) } : {}) };
}

/** normalizeRequest only keeps https artwork; demo art is a data: URL, so put it back. */
function demoRequest(id, data) {
  const r = normalizeRequest(id, data);
  return data.song?.demoArt ? { ...r, artworkUrl: data.song.demoArt } : r;
}

function initialRequests(now) {
  const raw = [
    ['d1', { song: song('Mr. Brightside', 'The Killers', false, 'brightside'), requesterName: 'Jess', note: 'For the bride!', tip: { amountCents: 2000, state: 'paid' }, ago: 2 }],
    ['d2', { song: song('Get Low', 'Lil Jon & The East Side Boyz', true, 'getlow'), tip: { amountCents: 0, state: 'none' }, ago: 4 }],
    ['d3', { song: song('September', 'Earth, Wind & Fire', false, 'september'), requesterName: 'Grandma Rose', note: 'Our anniversary song', tip: { amountCents: 500, state: 'paid' }, ago: 7 }],
    ['d4', { song: song('HUMBLE.', 'Kendrick Lamar', true, 'humble'), requesterName: 'Marcus', tip: { amountCents: 1000, state: 'failed' }, ago: 9 }],
    ['d5', { song: song('Dancing Queen', 'ABBA', false, 'dancingqueen'), note: 'Please play before cake!', tip: { amountCents: 0, state: 'none' }, ago: 12 }],
    ['d6', { song: song('Tití Me Preguntó', 'Bad Bunny', false, 'titi'), requesterName: 'Ana', tip: { amountCents: 1000, state: 'paid' }, ago: 15 }],
    ['d7', { song: { title: 'that song from the car commercial', artist: '', explicit: false, source: 'typed' }, requesterName: 'Dev', note: 'You know the one', tip: { amountCents: 0, state: 'none' }, ago: 18 }],
    ['d8', { song: song('Uptown Funk', 'Mark Ronson ft. Bruno Mars', false, 'uptown'), tip: { amountCents: 0, state: 'none' }, ago: 23 }],
    ['d9', { song: song('WAP', 'Cardi B ft. Megan Thee Stallion', true), note: 'Clean version maybe', tip: { amountCents: 0, state: 'none' }, ago: 31 }],
    ['d10', { song: song('Shout', 'The Isley Brothers', false, 'shout'), requesterName: 'Uncle Joe', tip: { amountCents: 500, state: 'paid' }, ago: 38 }],
    ['d11', { song: song('Blinding Lights', 'The Weeknd', false, 'blinding'), tip: { amountCents: 0, state: 'none' }, status: 'played', ago: 45 }],
    ['d12', { song: song('Cha Cha Slide', 'DJ Casper', false, 'chacha'), requesterName: 'Kids table', tip: { amountCents: 0, state: 'none' }, status: 'dismissed', ago: 52 }],
    ['d13', { song: song('Hidden while paying', 'Nobody', false), tip: { amountCents: 1500, state: 'pending' }, status: 'awaiting_payment', ago: 1 }],
  ];
  return raw.map(([id, { ago, status = 'pending', ...rest }]) =>
    demoRequest(id, { ...rest, status, createdAt: now - ago * MIN, updatedAt: now - ago * MIN }),
  );
}

function initialBookings(now) {
  const raw = [
    ['b1', { name: 'Priya Shah', phone: '+15555550142', email: 'priya@example.com', contactPreference: 'text', date: dateFromToday(12), startTime: '18:00', endTime: '23:00', eventType: 'wedding', location: 'Riverside Barn (sample)', notes: 'Indian-American fusion wedding, about 180 guests. Need Bollywood + top 40.', status: 'new', ago: 40 }],
    ['b2', { name: 'Tom Becker', phone: '+15555550199', contactPreference: 'call', date: dateFromToday(3), startTime: '20:00', endTime: '01:00', eventType: 'birthday', location: 'Backyard, Elm St (sample)', notes: '40th birthday, 80s and 90s please.', status: 'new', ago: 300 }],
    ['b3', { name: 'Acme Corp (sample)', email: 'events@example.com', contactPreference: 'email', date: dateFromToday(30), startTime: '17:30', endTime: '21:00', eventType: 'corporate', location: 'Downtown hotel ballroom (sample)', status: 'contacted', ago: 2 * 1440 }],
    ['b4', { name: 'Lena Ortiz', phone: '+15555550123', email: 'lena@example.com', contactPreference: 'call', date: dateFromToday(60), startTime: '19:00', endTime: '23:30', eventType: 'school', location: 'Central High gym (sample)', notes: 'Spring formal.', status: 'booked', ago: 6 * 1440 }],
    ['b5', { name: 'Chris Wu', phone: '+15555550177', contactPreference: 'text', date: dateFromToday(-10), startTime: '21:00', endTime: '02:00', eventType: 'club_bar', location: 'The Basement (sample)', status: 'declined', ago: 20 * 1440 }],
    ['b6', { name: 'Sam Rivera', email: 'sam@example.com', contactPreference: 'email', date: dateFromToday(-30), startTime: '15:00', endTime: '18:00', eventType: 'private_party', status: 'archived', ago: 45 * 1440 }],
  ];
  return raw.map(([id, { ago, ...rest }]) => normalizeBooking(id, { ...rest, createdAt: now - ago * MIN }));
}

const ARRIVALS = [
  { song: song('Yeah!', 'Usher ft. Lil Jon & Ludacris', false, 'yeah'), requesterName: 'Table 4' },
  { song: song('Don’t Stop Believin’', 'Journey', false, 'journey'), note: 'Everyone will sing!' },
  { song: song('In Da Club', '50 Cent', true, 'inda'), tip: { amountCents: 1500, state: 'paid' } },
  { song: song('Valerie', 'Amy Winehouse', false, 'valerie'), requesterName: 'Sophie' },
  { song: song('Levitating', 'Dua Lipa', false, 'levitating'), tip: { amountCents: 500, state: 'paid' } },
];

const startedAt = Date.now();
let state = {
  requests: initialRequests(startedAt),
  bookings: initialBookings(startedAt),
  settings: { live: true, requestsOpen: true, tipsEnabled: false, eventName: 'Shah–Patel wedding (demo)', updatedAt: startedAt - 90 * MIN },
};
const listeners = new Set();
let arrivalTimer = null;
let arrivalCount = 0;

function emit() {
  for (const fn of listeners) fn();
}

function addArrival() {
  const pick = ARRIVALS[arrivalCount % ARRIVALS.length];
  arrivalCount++;
  const now = Date.now();
  const req = demoRequest(`demo-new-${arrivalCount}`, {
    tip: { amountCents: 0, state: 'none' },
    ...pick,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  });
  state = { ...state, requests: [req, ...state.requests] };
  emit();
}

function subscribe(fn) {
  listeners.add(fn);
  if (!arrivalTimer) arrivalTimer = setInterval(addArrival, ARRIVAL_MS);
  return () => {
    listeners.delete(fn);
    if (!listeners.size && arrivalTimer) {
      clearInterval(arrivalTimer);
      arrivalTimer = null;
    }
  };
}

const getState = () => state;

function useDemoState() {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** Simulated network delay so the UI behaves as it would against a server. */
const later = () => new Promise((r) => setTimeout(r, 120));

export const isDemo = true;

export function useAuth() {
  return { user: DEMO_USER, loading: false, signIn: async () => {}, signOut: async () => {} };
}

export function useIsAdmin(user) {
  return { isAdmin: !!user, loading: false };
}

/** @param {{ includeDone?: boolean }} [opts] */
export function useRequests({ includeDone = false } = {}) {
  const { requests: all } = useDemoState();
  const requests = useMemo(
    () => all.filter((r) => r.status === 'pending' || (includeDone && (r.status === 'played' || r.status === 'dismissed'))),
    [all, includeDone],
  );
  return { requests, loading: false, error: null };
}

export function useBookings() {
  const { bookings } = useDemoState();
  return { bookings, loading: false, error: null };
}

export function useSettings() {
  const { settings } = useDemoState();
  return { settings, loading: false, error: null };
}

/** @param {string} id @param {string} status */
export async function setRequestStatus(id, status) {
  await later();
  const now = Date.now();
  state = { ...state, requests: state.requests.map((r) => (r.id === id ? { ...r, status, updatedAt: now } : r)) };
  emit();
}

/** @param {string} id @param {string} status */
export async function setBookingStatus(id, status) {
  await later();
  state = { ...state, bookings: state.bookings.map((b) => (b.id === id ? { ...b, status } : b)) };
  emit();
}

/** @param {Record<string, unknown>} patch */
export async function updateSettings(patch) {
  await later();
  state = { ...state, settings: { ...state.settings, ...patch, updatedAt: Date.now() } };
  emit();
}
