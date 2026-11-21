// Pure helpers for the guest request page. No React, no DOM: unit-tested in tests/request/.
import { TIP_MAX_CENTS, TIP_MIN_CENTS, TIP_PRESETS_CENTS, validateSongRequest } from '../../../shared/contracts.js';
import { ApiError } from '../../lib/api.js';

export const CLIENT_ID_KEY = 'djInsanity.clientId';
export const LAST_REQUEST_KEY = 'djInsanity.lastRequestAt';
export const COOLDOWN_MS = 30000;
export const SEARCH_MIN = 2;
export const SEARCH_MAX = 80; // the server answers 400 above this
export const SEARCH_DEBOUNCE_MS = 250;

const URL_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{22}$/;

// ---- Latest response wins -------------------------------------------------------------------

/**
 * Search-as-you-type bookkeeping: each begin() aborts the previous call, and a counter tells a
 * late response that it is no longer the latest so it can be dropped.
 */
export function createLatestOnly() {
  let seq = 0;
  /** @type {AbortController | null} */
  let controller = null;
  return {
    /** Start a call. @returns {{ signal: AbortSignal, isLatest: () => boolean }} */
    begin() {
      controller?.abort();
      controller = new AbortController();
      const id = ++seq;
      return { signal: controller.signal, isLatest: () => id === seq };
    },
    /** Abort the call in flight, and make every earlier call stale. */
    cancel() {
      controller?.abort();
      controller = null;
      seq++;
    },
  };
}

// ---- Device id and cool-down (localStorage, never required) -------------------------------

/**
 * localStorage, or null where it is blocked (private mode, disabled cookies).
 * @returns {Storage | null}
 */
export function browserStorage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/**
 * A random 22-character url-safe id (132 bits).
 * @param {(a: Uint8Array) => Uint8Array} [fill]
 */
export function randomClientId(fill = (a) => crypto.getRandomValues(a)) {
  const bytes = fill(new Uint8Array(22));
  let out = '';
  for (const b of bytes) out += URL_SAFE[b & 63];
  return out;
}

/** @type {string | null} */
let pageLoadId = null;

/**
 * This device's id: kept in storage, or one id per page load when storage does not work.
 * @param {Pick<Storage, 'getItem'|'setItem'> | null} storage
 * @param {() => string} [make]
 */
export function getClientId(storage, make = randomClientId) {
  if (!storage) return (pageLoadId ??= make());
  try {
    const saved = storage.getItem(CLIENT_ID_KEY);
    if (saved && CLIENT_ID_RE.test(saved)) return saved;
    const id = make();
    storage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    pageLoadId ??= make();
    return pageLoadId;
  }
}

/**
 * When the cool-down after the last successful request ends (ms timestamp; 0 = none).
 * A timestamp in the future (clock changed) is ignored.
 * @param {Pick<Storage, 'getItem'> | null} storage
 * @param {number} now
 */
export function cooldownUntil(storage, now) {
  try {
    const last = Number(storage?.getItem(LAST_REQUEST_KEY));
    if (!Number.isFinite(last) || last <= 0 || last > now) return 0;
    const until = last + COOLDOWN_MS;
    return until > now ? until : 0;
  } catch {
    return 0;
  }
}

/**
 * Record a successful request. Returns when its cool-down ends (works without storage too).
 * @param {Pick<Storage, 'setItem'> | null} storage
 * @param {number} now
 */
export function markRequestSent(storage, now) {
  try {
    storage?.setItem(LAST_REQUEST_KEY, String(now));
  } catch {
    // the cool-down still applies for this page load
  }
  return now + COOLDOWN_MS;
}

/** Whole seconds left, rounded up. */
export function secondsLeft(until, now) {
  return until > now ? Math.ceil((until - now) / 1000) : 0;
}

// ---- What the guest typed -----------------------------------------------------------------

/**
 * How a typed request would be stored, using the shared validator so the rules (link detection,
 * length) are the server's own.
 * @param {string} typed
 * @returns {{ ok: true, source: 'typed'|'link', text: string } | { ok: false, error: string }}
 */
export function describeTyped(typed) {
  const r = validateSongRequest({ typed, clientId: 'probe-client-id' });
  if (!r.ok) return { ok: false, error: r.errors.typed || r.errors.song || 'Type a song name.' };
  return { ok: true, source: /** @type {'typed'|'link'} */ (r.value.song.source), text: r.value.song.title };
}

/** Whether to ask the search API about this text at all. */
export function shouldSearch(text) {
  const q = text.trim();
  return q.length >= SEARCH_MIN && q.length <= SEARCH_MAX && !/^https?:\/\//i.test(q);
}

// ---- Tips ---------------------------------------------------------------------------------

/** The tip row's choices, in order: 'none' (the default), the preset amounts in cents, 'custom'. */
export const TIP_CHOICES = Object.freeze(['none', ...TIP_PRESETS_CENTS, 'custom']);

/** A checkout session is reused for this long; Stripe expires it after 31 min. */
export const TIP_REUSE_MS = 25 * 60 * 1000;

/**
 * Whether to offer tips: the server says they are on and the page was built with a publishable key.
 * @param {{ tipsEnabled?: boolean }} status
 * @param {string | undefined} publishableKey
 */
export function tipsAvailable(status, publishableKey) {
  return status.tipsEnabled === true && typeof publishableKey === 'string' && publishableKey.startsWith('pk_');
}

/** "$5" for 500. Tips are whole dollars. */
export function formatTip(cents) {
  return `$${Math.round(cents / 100)}`;
}

/**
 * A custom tip as typed (whole dollars; "$" and spaces allowed) in cents.
 * @param {string} text
 * @returns {{ ok: true, cents: number } | { ok: false, error: string }}
 */
export function parseTipDollars(text) {
  const t = String(text).replace(/[$\s]/g, '');
  const range = `Enter a whole-dollar tip from ${formatTip(TIP_MIN_CENTS)} to ${formatTip(TIP_MAX_CENTS)}.`;
  if (!/^\d{1,6}$/.test(t)) return { ok: false, error: range };
  const cents = Number(t) * 100;
  if (cents < TIP_MIN_CENTS || cents > TIP_MAX_CENTS) return { ok: false, error: range };
  return { ok: true, cents };
}

/**
 * The tip the guest chose, in cents (0 for none).
 * @param {(typeof TIP_CHOICES)[number]} choice
 * @param {string} customText
 * @returns {{ ok: true, cents: number } | { ok: false, error: string }}
 */
export function tipCentsFor(choice, customText) {
  if (choice === 'none') return { ok: true, cents: 0 };
  if (choice === 'custom') return parseTipDollars(customText);
  return { ok: true, cents: /** @type {number} */ (choice) };
}

/**
 * Whether the last tip checkout can be reopened instead of starting a new one: the same request
 * body (song, name, note, tip) and young enough that Stripe has not expired the session.
 * @param {{ key: string, createdAt: number } | null} saved
 * @param {string} key  JSON of the POST body without the Turnstile token
 * @param {number} now
 */
export function canReuseTip(saved, key, now) {
  return !!saved && saved.key === key && now - saved.createdAt < TIP_REUSE_MS;
}

/** Polls in a row that must say the checkout is still open before the thanks page gives up. */
export const OPEN_POLLS_TO_GIVE_UP = 3;

/**
 * One GET /api/requests/:id answer on the thanks page: the view to finish with (null = keep
 * polling) and the new count of consecutive "checkout still open" answers. Several in a row are
 * needed because right after an in-page confirm the session can still read as open briefly.
 * @param {number} openCount
 * @param {{ tipState?: string, checkout?: string }} answer
 * @returns {{ view: 'paid'|'failed'|'unfinished'|null, openCount: number }}
 */
export function thanksPoll(openCount, answer) {
  if (answer.tipState === 'paid' || answer.tipState === 'failed') return { view: answer.tipState, openCount: 0 };
  const n = answer.checkout === 'open' ? openCount + 1 : 0;
  return { view: n >= OPEN_POLLS_TO_GIVE_UP ? 'unfinished' : null, openCount: n };
}

// ---- Errors -------------------------------------------------------------------------------

export const RATE_LIMITED_MESSAGE = "You've sent a lot of requests — try again in a few minutes.";

/**
 * Turn a failed search into words for the guest.
 * @param {unknown} err
 */
export function searchErrorMessage(err) {
  if (err instanceof ApiError) {
    if (err.status === 502 && err.message) return err.message;
    if (err.code === 'network' || err.code === 'timeout') {
      return "Couldn't reach search. Check your connection, or request it as written below.";
    }
  }
  return "Search isn't working right now. You can still request it as written below.";
}

const FIELD_OF = { song: 'song', typed: 'song', note: 'note', requesterName: 'name', tipCents: 'tip' };

/**
 * Turn a failed POST /api/requests into what the page shows.
 *   closed: switch the page to the closed state
 *   fields: messages for the inputs ('song' | 'note' | 'name')
 *   message: the banner text (null when the field messages say it all)
 * @param {unknown} err
 * @returns {{ closed: boolean, fields: Record<string, string>, message: string|null }}
 */
export function submitErrorView(err) {
  if (!(err instanceof ApiError)) return { closed: false, fields: {}, message: 'Something went wrong. Please try again.' };
  if (err.status === 409 || err.code === 'requests_closed') return { closed: true, fields: {}, message: null };
  if (err.status === 429 || err.code === 'rate_limited') return { closed: false, fields: {}, message: RATE_LIMITED_MESSAGE };
  if (err.code === 'invalid' && err.fields) return fieldErrorView(err.fields);
  return { closed: false, fields: {}, message: err.message };
}

/**
 * Field errors from validateSongRequest (client- or server-side), mapped to the page's inputs.
 * Anything that is not a visible input (clientId, tipCents, form) becomes the banner.
 * @param {Record<string, string>} errors
 */
export function fieldErrorView(errors) {
  /** @type {Record<string, string>} */
  const fields = {};
  /** @type {string[]} */
  const other = [];
  for (const [k, v] of Object.entries(errors)) {
    const f = FIELD_OF[/** @type {keyof typeof FIELD_OF} */ (k)];
    if (f) fields[f] ??= v;
    else other.push(v);
  }
  return { closed: false, fields, message: other.length ? other.join(' ') : null };
}
