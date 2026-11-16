import { describe, it, expect } from 'vitest'
import {
  EVENT_TYPES,
  TIP_PRESETS_CENTS,
  TIP_MIN_CENTS,
  TIP_MAX_CENTS,
  NOTE_MAX,
  NAME_MAX,
  eventLengthMinutes,
  normalizePhone,
  validateBooking,
  validateSongRequest,
} from '../../shared/contracts.js'

const TODAY = '2026-11-16'

const booking = (over = {}) => ({
  name: 'Sam Smith',
  phone: '+1 (555) 123-4567',
  email: '',
  contactPreference: 'text',
  date: '2026-12-31',
  startTime: '20:00',
  endTime: '01:00',
  eventType: 'wedding',
  location: '',
  notes: '',
  ...over,
})

const bookingErrors = (over) => {
  const r = validateBooking(booking(over), { today: TODAY })
  expect(r.ok).toBe(false)
  return r.errors
}

describe('constants', () => {
  it('exports the agreed values', () => {
    expect(TIP_PRESETS_CENTS).toEqual([500, 1000, 2000])
    expect(TIP_MIN_CENTS).toBe(100)
    expect(TIP_MAX_CENTS).toBe(20000)
    expect(NOTE_MAX).toBe(140)
    expect(NAME_MAX).toBe(40)
  })

  it('has value + label event types covering the agreed list', () => {
    expect(EVENT_TYPES.map((t) => t.value)).toEqual([
      'wedding', 'birthday', 'corporate', 'club_bar', 'school', 'private_party', 'other',
    ])
    for (const t of EVENT_TYPES) expect(typeof t.label).toBe('string')
  })
})

describe('eventLengthMinutes', () => {
  it('handles same-day events', () => expect(eventLengthMinutes('18:00', '23:30')).toBe(330))
  it('handles events past midnight', () => expect(eventLengthMinutes('20:00', '01:00')).toBe(300))
  it('returns 0 for equal times', () => expect(eventLengthMinutes('20:00', '20:00')).toBe(0))
  it('returns NaN for bad input', () => expect(eventLengthMinutes('8pm', '23:00')).toBeNaN())
})

describe('normalizePhone', () => {
  it('keeps digits and a leading +', () => expect(normalizePhone(' +1 (555) 123-4567 ')).toBe('+15551234567'))
  it('drops formatting without +', () => expect(normalizePhone('555.123.4567')).toBe('5551234567'))
  it('returns empty for no digits', () => expect(normalizePhone('call me')).toBe(''))
})

describe('validateBooking', () => {
  it('accepts a valid booking and normalises it', () => {
    const r = validateBooking(booking({ name: '  Sam Smith ', email: ' Sam@Example.COM ' }), { today: TODAY })
    expect(r).toEqual({
      ok: true,
      value: {
        name: 'Sam Smith',
        phone: '+15551234567',
        email: 'sam@example.com',
        contactPreference: 'text',
        date: '2026-12-31',
        startTime: '20:00',
        endTime: '01:00',
        eventType: 'wedding',
        location: null,
        notes: null,
      },
    })
  })

  it('requires opts.today', () => {
    expect(() => validateBooking(booking(), {})).toThrow(TypeError)
  })

  it('rejects a non-object', () => {
    const r = validateBooking(null, { today: TODAY })
    expect(r.ok).toBe(false)
    expect(r.errors.form).toBeTruthy()
  })

  it('requires a name of 1-80 chars', () => {
    expect(bookingErrors({ name: '   ' }).name).toBeTruthy()
    expect(bookingErrors({ name: 'x'.repeat(81) }).name).toBeTruthy()
    expect(validateBooking(booking({ name: 'x'.repeat(80) }), { today: TODAY }).ok).toBe(true)
  })

  it('requires a phone or an email', () => {
    const e = bookingErrors({ phone: '', email: '' })
    expect(e.phone).toBeTruthy()
    expect(e.email).toBeTruthy()
  })

  it('accepts email only', () => {
    const r = validateBooking(booking({ phone: '', email: 'a@b.co', contactPreference: 'email' }), { today: TODAY })
    expect(r.ok).toBe(true)
    expect(r.value.phone).toBeNull()
  })

  it('accepts both phone and email', () => {
    expect(validateBooking(booking({ email: 'a@b.co' }), { today: TODAY }).ok).toBe(true)
  })

  it('rejects a bad phone or email', () => {
    expect(bookingErrors({ phone: '12345' }).phone).toBeTruthy()
    expect(bookingErrors({ phone: '1'.repeat(16) }).phone).toBeTruthy()
    expect(bookingErrors({ email: 'not-an-email' }).email).toBeTruthy()
  })

  it('checks contact preference is one of call/text/email', () => {
    expect(bookingErrors({ contactPreference: 'fax' }).contactPreference).toBeTruthy()
    expect(bookingErrors({ contactPreference: undefined }).contactPreference).toBeTruthy()
    for (const p of ['call', 'text']) expect(validateBooking(booking({ contactPreference: p }), { today: TODAY }).ok).toBe(true)
  })

  it('needs the matching contact detail for the preference', () => {
    expect(bookingErrors({ contactPreference: 'email' }).email).toBeTruthy()
    expect(bookingErrors({ phone: '', email: 'a@b.co', contactPreference: 'call' }).phone).toBeTruthy()
  })

  it('checks the date format and that it is not in the past', () => {
    expect(bookingErrors({ date: '' }).date).toBeTruthy()
    expect(bookingErrors({ date: '12/31/2026' }).date).toBeTruthy()
    expect(bookingErrors({ date: '2026-02-30' }).date).toBeTruthy()
    expect(bookingErrors({ date: '2026-11-15' }).date).toBeTruthy()
    expect(validateBooking(booking({ date: TODAY }), { today: TODAY }).ok).toBe(true)
  })

  it('checks times are HH:mm and differ', () => {
    expect(bookingErrors({ startTime: '' }).startTime).toBeTruthy()
    expect(bookingErrors({ startTime: '8:00' }).startTime).toBeTruthy()
    expect(bookingErrors({ endTime: '24:00' }).endTime).toBeTruthy()
    expect(bookingErrors({ startTime: '20:00', endTime: '20:00' }).endTime).toBeTruthy()
  })

  it('checks the event type', () => {
    expect(bookingErrors({ eventType: '' }).eventType).toBeTruthy()
    expect(bookingErrors({ eventType: 'rave' }).eventType).toBeTruthy()
    for (const t of EVENT_TYPES) expect(validateBooking(booking({ eventType: t.value }), { today: TODAY }).ok).toBe(true)
  })

  it('limits location to 160 and notes to 1000', () => {
    expect(bookingErrors({ location: 'x'.repeat(161) }).location).toBeTruthy()
    expect(bookingErrors({ notes: 'x'.repeat(1001) }).notes).toBeTruthy()
    const r = validateBooking(booking({ location: ' Hall ', notes: 'x'.repeat(1000) }), { today: TODAY })
    expect(r.ok).toBe(true)
    expect(r.value.location).toBe('Hall')
  })
})

const song = (over = {}) => ({
  title: 'Mr. Brightside',
  artist: 'The Killers',
  album: 'Hot Fuss',
  artworkUrl: 'https://is1-ssl.mzstatic.com/image/x.jpg',
  explicit: false,
  durationSec: 222,
  source: 'both',
  deezerId: 3135556,
  itunesId: '1440898923',
  isrc: 'usir-1040-0004',
  ...over,
})

const req = (over = {}) => ({ song: song(), tipCents: 0, clientId: 'abcDEF12_-', ...over })

const requestErrors = (over) => {
  const r = validateSongRequest(req(over))
  expect(r.ok).toBe(false)
  return r.errors
}

describe('validateSongRequest', () => {
  it('accepts a full song and normalises ids and ISRC', () => {
    const r = validateSongRequest(req({ note: ' play it loud ', requesterName: ' Ana ', turnstileToken: 'tok' }))
    expect(r.ok).toBe(true)
    expect(r.value).toEqual({
      song: {
        title: 'Mr. Brightside',
        artist: 'The Killers',
        album: 'Hot Fuss',
        artworkUrl: 'https://is1-ssl.mzstatic.com/image/x.jpg',
        explicit: false,
        durationSec: 222,
        source: 'both',
        deezerId: '3135556',
        itunesId: '1440898923',
        isrc: 'USIR10400004',
      },
      note: 'play it loud',
      requesterName: 'Ana',
      tipCents: 0,
      clientId: 'abcDEF12_-',
      turnstileToken: 'tok',
    })
  })

  it('accepts a minimal song (title + artist)', () => {
    const r = validateSongRequest(req({ song: { title: 'WAP', artist: 'Cardi B' } }))
    expect(r.ok).toBe(true)
    expect(r.value.song).toEqual({ title: 'WAP', artist: 'Cardi B', explicit: false })
    expect(r.value.note).toBeNull()
    expect(r.value.turnstileToken).toBeNull()
  })

  it('requires song title and artist', () => {
    expect(requestErrors({ song: song({ title: ' ' }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ artist: '' }) }).song).toBeTruthy()
  })

  it('only allows https artwork', () => {
    expect(requestErrors({ song: song({ artworkUrl: 'http://x.com/a.jpg' }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ artworkUrl: 'javascript:alert(1)' }) }).song).toBeTruthy()
  })

  it('checks explicit, duration, source, ids and ISRC types', () => {
    expect(requestErrors({ song: song({ explicit: 'yes' }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ durationSec: -1 }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ durationSec: 1.5 }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ source: 'typed' }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ deezerId: 'abc' }) }).song).toBeTruthy()
    expect(requestErrors({ song: song({ isrc: 'nope' }) }).song).toBeTruthy()
    for (const s of ['deezer', 'itunes', 'both']) expect(validateSongRequest(req({ song: song({ source: s }) })).ok).toBe(true)
  })

  it('accepts typed text as a typed request', () => {
    const r = validateSongRequest(req({ song: undefined, typed: '  that song from the wedding ' }))
    expect(r.ok).toBe(true)
    expect(r.value.song).toEqual({ title: 'that song from the wedding', artist: '', explicit: false, source: 'typed' })
  })

  it('detects a pasted http(s) link', () => {
    const url = 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp'
    const r = validateSongRequest(req({ song: undefined, typed: url }))
    expect(r.ok).toBe(true)
    expect(r.value.song).toEqual({ title: url, artist: '', explicit: false, source: 'link', url })
    expect(validateSongRequest(req({ song: undefined, typed: 'http://example.com/x' })).value.song.source).toBe('link')
    expect(validateSongRequest(req({ song: undefined, typed: 'see https://x.com' })).value.song.source).toBe('typed')
  })

  it('limits typed to 1-120 chars', () => {
    expect(requestErrors({ song: undefined, typed: '   ' }).typed).toBeTruthy()
    expect(requestErrors({ song: undefined, typed: 'x'.repeat(121) }).typed).toBeTruthy()
    expect(validateSongRequest(req({ song: undefined, typed: 'x'.repeat(120) })).ok).toBe(true)
  })

  it('needs exactly one of song or typed', () => {
    expect(requestErrors({ song: undefined }).song).toBeTruthy()
    expect(requestErrors({ typed: 'also this' }).song).toBeTruthy()
  })

  it('limits note and requester name', () => {
    expect(requestErrors({ note: 'x'.repeat(NOTE_MAX + 1) }).note).toBeTruthy()
    expect(requestErrors({ requesterName: 'x'.repeat(NAME_MAX + 1) }).requesterName).toBeTruthy()
    expect(validateSongRequest(req({ note: 'x'.repeat(NOTE_MAX), requesterName: 'x'.repeat(NAME_MAX) })).ok).toBe(true)
  })

  it('allows tipCents 0 or an integer 100-20000', () => {
    for (const t of [0, 100, 500, 20000]) expect(validateSongRequest(req({ tipCents: t })).ok).toBe(true)
    for (const t of [50, 99, 20001, 150.5, '500', -100]) expect(requestErrors({ tipCents: t }).tipCents).toBeTruthy()
    expect(validateSongRequest(req({ tipCents: undefined })).value.tipCents).toBe(0)
  })

  it('requires an 8-64 char url-safe clientId', () => {
    expect(requestErrors({ clientId: 'short' }).clientId).toBeTruthy()
    expect(requestErrors({ clientId: 'x'.repeat(65) }).clientId).toBeTruthy()
    expect(requestErrors({ clientId: 'has spaces!!' }).clientId).toBeTruthy()
    expect(requestErrors({ clientId: undefined }).clientId).toBeTruthy()
    expect(validateSongRequest(req({ clientId: 'x'.repeat(64) })).ok).toBe(true)
  })

  it('rejects a non-object body', () => {
    expect(validateSongRequest('hello').ok).toBe(false)
  })
})
