// Payload shapes shared by the browser (src/, via Vite) and the server (functions/, via Pages).
// Plain JS, no dependencies, no Node- or DOM-only APIs: it must run in both places.
// Every validator returns { ok: true, value } or { ok: false, errors: { field: message } }.

/**
 * @typedef {Object} Song
 * @property {string} title
 * @property {string} artist             '' for typed and link requests
 * @property {string} [album]
 * @property {string} [artworkUrl]       https only
 * @property {boolean} explicit
 * @property {number} [durationSec]
 * @property {'deezer'|'itunes'|'both'|'typed'|'link'} [source]
 * @property {string} [deezerId]         digits, as a string
 * @property {string} [itunesId]         digits, as a string
 * @property {string} [isrc]             12 characters, upper case, no hyphens
 * @property {string} [url]              only for source 'link'
 */

/**
 * Body of POST /api/requests. Exactly one of `song` or `typed`.
 * @typedef {Object} SongRequestInput
 * @property {Partial<Song>} [song]      a search result
 * @property {string} [typed]            free text (1-120 chars); an http(s) URL becomes a 'link' request
 * @property {string} [note]             up to NOTE_MAX chars
 * @property {string} [requesterName]    up to NAME_MAX chars
 * @property {number} [tipCents]         0, or an integer TIP_MIN_CENTS..TIP_MAX_CENTS (missing = 0)
 * @property {string} clientId           8-64 url-safe chars, random per device
 * @property {string} [turnstileToken]   passed through untouched
 */

/**
 * Validated song request (the `value` of a successful validateSongRequest).
 * @typedef {Object} SongRequest
 * @property {Song} song
 * @property {string|null} note
 * @property {string|null} requesterName
 * @property {number} tipCents
 * @property {string} clientId
 * @property {string|null} turnstileToken
 */

/**
 * Body of POST /api/bookings (plus turnstileToken, which the server reads separately).
 * Phone or email is required; both are allowed.
 * @typedef {Object} BookingInput
 * @property {string} name                       1-80 chars
 * @property {string} [phone]                    normalised to digits with an optional leading +
 * @property {string} [email]                    lower-cased
 * @property {'call'|'text'|'email'} contactPreference
 * @property {string} date                       YYYY-MM-DD, not before `today`
 * @property {string} startTime                  HH:mm (24 h)
 * @property {string} endTime                    HH:mm (24 h); may be after midnight
 * @property {string} eventType                  one of EVENT_TYPES[].value
 * @property {string} [location]                 up to 160 chars
 * @property {string} [notes]                    up to 1000 chars
 */

/**
 * Validated booking (the `value` of a successful validateBooking). Missing optional fields are null.
 * @typedef {Object} Booking
 * @property {string} name
 * @property {string|null} phone
 * @property {string|null} email
 * @property {'call'|'text'|'email'} contactPreference
 * @property {string} date
 * @property {string} startTime
 * @property {string} endTime
 * @property {string} eventType
 * @property {string|null} location
 * @property {string|null} notes
 */

/** @typedef {{ ok: true, value: any } | { ok: false, errors: Record<string, string> }} Result */

export const EVENT_TYPES = Object.freeze([
  { value: 'wedding', label: 'Wedding' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'club_bar', label: 'Club / bar' },
  { value: 'school', label: 'School' },
  { value: 'private_party', label: 'Private party' },
  { value: 'other', label: 'Other' },
]);

export const CONTACT_PREFERENCES = Object.freeze(['call', 'text', 'email']);
export const SONG_SOURCES = Object.freeze(['deezer', 'itunes', 'both']);

export const TIP_PRESETS_CENTS = Object.freeze([500, 1000, 2000]);
export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 20000;
export const NOTE_MAX = 140;
export const NAME_MAX = 40;
export const TYPED_MAX = 120;

export const BOOKING_NAME_MAX = 80;
export const BOOKING_LOCATION_MAX = 160;
export const BOOKING_NOTES_MAX = 1000;
const SONG_TEXT_MAX = 200;
const URL_MAX = 500;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
const DIGITS_RE = /^\d{1,20}$/;

/** @param {unknown} v */
function text(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/** @param {unknown} v */
function isObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** @param {string} hhmm */
function toMinutes(hhmm) {
  const m = TIME_RE.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** @param {string} s */
function isRealDate(s) {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/**
 * Length of an event in minutes. An end time at or before the start time is taken to be
 * on the next day (e.g. 20:00 to 01:00 is 300). Equal times return 0.
 * Returns NaN if either time is not HH:mm.
 * @param {string} start HH:mm
 * @param {string} end   HH:mm
 * @returns {number}
 */
export function eventLengthMinutes(start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (Number.isNaN(s) || Number.isNaN(e)) return NaN;
  return (e - s + 1440) % 1440;
}

/**
 * Digits only, keeping a leading + if the input had one. '' when nothing usable.
 * @param {string} raw
 */
export function normalizePhone(raw) {
  const s = text(raw);
  const digits = s.replace(/\D/g, '');
  if (!digits) return '';
  return (s.startsWith('+') ? '+' : '') + digits;
}

/**
 * True for an absolute http(s) URL with no spaces.
 * @param {string} s
 */
function isHttpUrl(s) {
  if (!/^https?:\/\/\S+$/i.test(s)) return false;
  try {
    const u = new URL(s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && !!u.hostname;
  } catch {
    return false;
  }
}

/**
 * Validate a booking form.
 * @param {Partial<BookingInput>} input
 * @param {{ today: string }} opts  today's date as YYYY-MM-DD in the caller's own time zone
 * @returns {{ ok: true, value: Booking } | { ok: false, errors: Record<string, string> }}
 */
export function validateBooking(input, { today } = /** @type {any} */ ({})) {
  if (typeof today !== 'string' || !isRealDate(today)) {
    throw new TypeError('validateBooking: opts.today must be a YYYY-MM-DD string');
  }
  if (!isObject(input)) return { ok: false, errors: { form: 'Something went wrong. Please try again.' } };

  /** @type {Record<string, string>} */
  const errors = {};

  const name = text(input.name);
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > BOOKING_NAME_MAX) errors.name = `Keep your name under ${BOOKING_NAME_MAX} characters.`;

  const rawPhone = text(input.phone);
  const phone = normalizePhone(rawPhone);
  const phoneDigits = phone.replace('+', '').length;
  if (rawPhone && (phoneDigits < 7 || phoneDigits > 15)) errors.phone = 'Enter a valid phone number.';

  const email = text(input.email).toLowerCase();
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) errors.email = 'Enter a valid email address.';

  if (!rawPhone && !email) {
    errors.phone = 'Enter a phone number or an email.';
    errors.email = 'Enter a phone number or an email.';
  }

  const contactPreference = text(input.contactPreference);
  if (!CONTACT_PREFERENCES.includes(contactPreference)) {
    errors.contactPreference = 'Choose how you would like us to contact you.';
  } else if (contactPreference === 'email' && !email && !errors.email) {
    errors.email = 'Add an email so we can reply by email.';
  } else if (contactPreference !== 'email' && !rawPhone && !errors.phone) {
    errors.phone = `Add a phone number so we can ${contactPreference} you.`;
  }

  const date = text(input.date);
  if (!date) errors.date = 'Choose a date.';
  else if (!isRealDate(date)) errors.date = 'Enter a valid date.';
  else if (date < today) errors.date = 'Choose a date that is not in the past.';

  const startTime = text(input.startTime);
  const endTime = text(input.endTime);
  if (!startTime) errors.startTime = 'Choose a start time.';
  else if (!TIME_RE.test(startTime)) errors.startTime = 'Enter a valid time.';
  if (!endTime) errors.endTime = 'Choose an end time.';
  else if (!TIME_RE.test(endTime)) errors.endTime = 'Enter a valid time.';
  else if (!errors.startTime && eventLengthMinutes(startTime, endTime) === 0) {
    errors.endTime = 'End time must be different from the start time.';
  }

  const eventType = text(input.eventType);
  if (!eventType) errors.eventType = 'Choose an event type.';
  else if (!EVENT_TYPES.some((t) => t.value === eventType)) errors.eventType = 'Choose an event type from the list.';

  const location = text(input.location);
  if (location.length > BOOKING_LOCATION_MAX) errors.location = `Keep the location under ${BOOKING_LOCATION_MAX} characters.`;

  const notes = text(input.notes);
  if (notes.length > BOOKING_NOTES_MAX) errors.notes = `Keep notes under ${BOOKING_NOTES_MAX} characters.`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      phone: phone || null,
      email: email || null,
      contactPreference: /** @type {'call'|'text'|'email'} */ (contactPreference),
      date,
      startTime,
      endTime,
      eventType,
      location: location || null,
      notes: notes || null,
    },
  };
}

/**
 * Validate a song picked from search. Returns [song, error].
 * @param {Record<string, unknown>} s
 * @returns {[Song|null, string|null]}
 */
function validateSong(s) {
  const title = text(s.title);
  const artist = text(s.artist);
  if (!title) return [null, 'The song is missing a title.'];
  if (!artist) return [null, 'The song is missing an artist.'];
  if (title.length > SONG_TEXT_MAX || artist.length > SONG_TEXT_MAX) return [null, 'The song title or artist is too long.'];

  /** @type {Song} */
  const song = { title, artist, explicit: false };

  if (s.album !== undefined && s.album !== null) {
    const album = text(s.album);
    if (album.length > SONG_TEXT_MAX) return [null, 'The album name is too long.'];
    if (album) song.album = album;
  }
  if (s.artworkUrl !== undefined && s.artworkUrl !== null && s.artworkUrl !== '') {
    const url = text(s.artworkUrl);
    if (url.length > URL_MAX || !isHttpUrl(url) || !url.toLowerCase().startsWith('https://')) {
      return [null, 'The artwork link must be an https address.'];
    }
    song.artworkUrl = url;
  }
  if (s.explicit !== undefined && s.explicit !== null) {
    if (typeof s.explicit !== 'boolean') return [null, 'The explicit flag must be true or false.'];
    song.explicit = s.explicit;
  }
  if (s.durationSec !== undefined && s.durationSec !== null) {
    const d = s.durationSec;
    if (typeof d !== 'number' || !Number.isInteger(d) || d < 0 || d > 86400) return [null, 'The song length is not valid.'];
    song.durationSec = d;
  }
  if (s.source !== undefined && s.source !== null) {
    if (typeof s.source !== 'string' || !SONG_SOURCES.includes(s.source)) return [null, 'The song source is not valid.'];
    song.source = /** @type {'deezer'|'itunes'|'both'} */ (s.source);
  }
  for (const key of /** @type {const} */ (['deezerId', 'itunesId'])) {
    const v = s[key];
    if (v === undefined || v === null || v === '') continue;
    const id = typeof v === 'number' && Number.isInteger(v) && v >= 0 ? String(v) : text(v);
    if (!DIGITS_RE.test(id)) return [null, 'The song ID is not valid.'];
    song[key] = id;
  }
  if (s.isrc !== undefined && s.isrc !== null && s.isrc !== '') {
    const isrc = text(s.isrc).replace(/-/g, '').toUpperCase();
    if (!ISRC_RE.test(isrc)) return [null, 'The song ISRC is not valid.'];
    song.isrc = isrc;
  }
  return [song, null];
}

/**
 * Validate the body of POST /api/requests.
 * @param {Partial<SongRequestInput>} input
 * @returns {{ ok: true, value: SongRequest } | { ok: false, errors: Record<string, string> }}
 */
export function validateSongRequest(input) {
  if (!isObject(input)) return { ok: false, errors: { form: 'Something went wrong. Please try again.' } };

  /** @type {Record<string, string>} */
  const errors = {};
  /** @type {Song|null} */
  let song = null;

  const hasSong = input.song !== undefined && input.song !== null;
  const hasTyped = input.typed !== undefined && input.typed !== null && input.typed !== '';

  if (hasSong && hasTyped) {
    errors.song = 'Send a song from search or a typed request, not both.';
  } else if (hasSong) {
    if (!isObject(input.song)) {
      errors.song = 'Pick a song or type one in.';
    } else {
      const [s, err] = validateSong(/** @type {Record<string, unknown>} */ (input.song));
      if (err) errors.song = err;
      else song = s;
    }
  } else if (hasTyped) {
    const typed = text(input.typed);
    if (!typed) errors.typed = 'Type a song name.';
    else if (isHttpUrl(typed)) {
      // Links (Apple Music, Spotify, YouTube) are often longer than a typed title.
      if (typed.length > URL_MAX) errors.typed = 'That link is too long.';
      else song = { title: typed, artist: '', explicit: false, source: 'link', url: typed };
    } else if (typed.length > TYPED_MAX) errors.typed = `Keep it under ${TYPED_MAX} characters.`;
    else song = { title: typed, artist: '', explicit: false, source: 'typed' };
  } else {
    errors.song = 'Pick a song or type one in.';
  }

  const note = text(input.note);
  if (input.note !== undefined && input.note !== null && typeof input.note !== 'string') errors.note = 'The note must be text.';
  else if (note.length > NOTE_MAX) errors.note = `Keep the note under ${NOTE_MAX} characters.`;

  const requesterName = text(input.requesterName);
  if (input.requesterName !== undefined && input.requesterName !== null && typeof input.requesterName !== 'string') {
    errors.requesterName = 'Your name must be text.';
  } else if (requesterName.length > NAME_MAX) errors.requesterName = `Keep your name under ${NAME_MAX} characters.`;

  const tipCents = input.tipCents === undefined || input.tipCents === null ? 0 : input.tipCents;
  if (
    typeof tipCents !== 'number' ||
    !Number.isInteger(tipCents) ||
    (tipCents !== 0 && (tipCents < TIP_MIN_CENTS || tipCents > TIP_MAX_CENTS))
  ) {
    errors.tipCents = `Tips must be between $${TIP_MIN_CENTS / 100} and $${TIP_MAX_CENTS / 100}.`;
  }

  const clientId = typeof input.clientId === 'string' ? input.clientId : '';
  if (!CLIENT_ID_RE.test(clientId)) errors.clientId = 'Something went wrong. Please reload the page and try again.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      song: /** @type {Song} */ (song),
      note: note || null,
      requesterName: requesterName || null,
      tipCents: /** @type {number} */ (tipCents),
      clientId,
      turnstileToken: typeof input.turnstileToken === 'string' ? input.turnstileToken : null,
    },
  };
}
