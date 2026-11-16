import { describe, it, expect } from 'vitest'
import {
  CLIENT_ID_KEY,
  COOLDOWN_MS,
  LAST_REQUEST_KEY,
  RATE_LIMITED_MESSAGE,
  cooldownUntil,
  createLatestOnly,
  describeTyped,
  fieldErrorView,
  getClientId,
  markRequestSent,
  randomClientId,
  searchErrorMessage,
  secondsLeft,
  shouldSearch,
  submitErrorView,
} from '../../src/pages/request/requestLogic.js'
import { ApiError } from '../../src/lib/api.js'
import { TYPED_MAX, validateSongRequest } from '../../shared/contracts.js'

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
  }
}

const throwingStorage = {
  getItem() {
    throw new Error('SecurityError')
  },
  setItem() {
    throw new Error('QuotaExceededError')
  },
}

describe('createLatestOnly', () => {
  it('only the newest call is latest, and starting one aborts the previous', () => {
    const latest = createLatestOnly()
    const a = latest.begin()
    expect(a.isLatest()).toBe(true)
    const b = latest.begin()
    expect(a.signal.aborted).toBe(true)
    expect(a.isLatest()).toBe(false)
    expect(b.isLatest()).toBe(true)
    expect(b.signal.aborted).toBe(false)
  })

  it('a late response from an earlier call is discarded', async () => {
    const latest = createLatestOnly()
    const shown = []
    const respond = (call, value, ms) =>
      new Promise((r) => setTimeout(r, ms)).then(() => {
        if (call.isLatest()) shown.push(value)
      })
    const slow = respond(latest.begin(), 'mo', 30)
    const fast = respond(latest.begin(), 'move bitch', 5)
    await Promise.all([slow, fast])
    expect(shown).toEqual(['move bitch'])
  })

  it('cancel aborts the call in flight and makes it stale', () => {
    const latest = createLatestOnly()
    const a = latest.begin()
    latest.cancel()
    expect(a.signal.aborted).toBe(true)
    expect(a.isLatest()).toBe(false)
  })
})

describe('client id', () => {
  it('is 22 url-safe characters that the contract accepts', () => {
    const id = randomClientId()
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    expect(validateSongRequest({ typed: 'x', clientId: id }).ok).toBe(true)
    expect(randomClientId()).not.toBe(id)
  })

  it('is created once and then reused from storage', () => {
    const storage = memoryStorage()
    const first = getClientId(storage)
    expect(storage.data.get(CLIENT_ID_KEY)).toBe(first)
    expect(getClientId(storage)).toBe(first)
  })

  it('replaces a malformed stored id', () => {
    const storage = memoryStorage({ [CLIENT_ID_KEY]: 'bad id!' })
    const id = getClientId(storage, () => 'B'.repeat(22))
    expect(id).toBe('B'.repeat(22))
    expect(storage.data.get(CLIENT_ID_KEY)).toBe(id)
  })

  it('falls back to one id per page load when storage throws or is missing', () => {
    let n = 0
    const make = () => `${'C'.repeat(21)}${n++}`
    const a = getClientId(throwingStorage, make)
    expect(getClientId(throwingStorage, make)).toBe(a)
    expect(getClientId(null, make)).toBe(a)
  })
})

describe('cool-down', () => {
  const NOW = 1_800_000_000_000

  it('is off with nothing stored', () => {
    expect(cooldownUntil(memoryStorage(), NOW)).toBe(0)
  })

  it('lasts 30 s from the last successful request', () => {
    const storage = memoryStorage()
    expect(markRequestSent(storage, NOW)).toBe(NOW + COOLDOWN_MS)
    expect(storage.data.get(LAST_REQUEST_KEY)).toBe(String(NOW))
    expect(cooldownUntil(storage, NOW + 1000)).toBe(NOW + COOLDOWN_MS)
    expect(secondsLeft(NOW + COOLDOWN_MS, NOW + 1000)).toBe(29)
    expect(secondsLeft(NOW + COOLDOWN_MS, NOW + 29_001)).toBe(1)
    expect(cooldownUntil(storage, NOW + COOLDOWN_MS)).toBe(0)
    expect(secondsLeft(NOW + COOLDOWN_MS, NOW + COOLDOWN_MS)).toBe(0)
  })

  it('ignores garbage and timestamps from the future', () => {
    expect(cooldownUntil(memoryStorage({ [LAST_REQUEST_KEY]: 'soon' }), NOW)).toBe(0)
    expect(cooldownUntil(memoryStorage({ [LAST_REQUEST_KEY]: String(NOW + 60_000) }), NOW)).toBe(0)
  })

  it('still works for this page load when storage throws', () => {
    expect(markRequestSent(throwingStorage, NOW)).toBe(NOW + COOLDOWN_MS)
    expect(cooldownUntil(throwingStorage, NOW)).toBe(0)
  })
})

describe('typed requests (link detection is the contract\'s own)', () => {
  it('plain text is a typed request', () => {
    expect(describeTyped('  Electric Slide  ')).toEqual({ ok: true, source: 'typed', text: 'Electric Slide' })
  })

  it('an http(s) URL is a link request', () => {
    const url = 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp'
    expect(describeTyped(url)).toEqual({ ok: true, source: 'link', text: url })
    expect(describeTyped('http://youtu.be/abc').source).toBe('link')
    expect(describeTyped('www.youtube.com/watch?v=1').source).toBe('typed')
  })

  it('too long is refused with the contract\'s message', () => {
    const r = describeTyped('a'.repeat(TYPED_MAX + 1))
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(String(TYPED_MAX))
  })

  it('search runs for 2-80 characters and never for a URL', () => {
    expect(shouldSearch('a')).toBe(false)
    expect(shouldSearch(' ab ')).toBe(true)
    expect(shouldSearch('a'.repeat(81))).toBe(false)
    expect(shouldSearch('https://music.apple.com/x')).toBe(false)
  })
})

describe('error messages', () => {
  const api = (status, code, message, fields) => new ApiError({ status, code, message, fields })

  it('search: the server\'s words for 502, plain words otherwise', () => {
    expect(searchErrorMessage(api(502, 'search_unavailable', 'Search is having trouble — type the song instead.'))).toBe(
      'Search is having trouble — type the song instead.',
    )
    expect(searchErrorMessage(api(0, 'network', 'x'))).toMatch(/connection/)
    expect(searchErrorMessage(new Error('boom'))).toMatch(/as written/)
  })

  it('submit: 409 closes the page', () => {
    expect(submitErrorView(api(409, 'requests_closed', 'Requests are closed right now.')).closed).toBe(true)
  })

  it('submit: 429 has its own wording', () => {
    expect(submitErrorView(api(429, 'rate_limited', 'server words')).message).toBe(RATE_LIMITED_MESSAGE)
  })

  it('submit: 403 and 503 show the server message', () => {
    const bot = "We couldn't confirm you're not a bot. Please reload the page and try again."
    expect(submitErrorView(api(403, 'bot_check_failed', bot)).message).toBe(bot)
    expect(submitErrorView(api(503, 'not_configured', "Requests aren't available right now.")).message).toBe(
      "Requests aren't available right now.",
    )
    expect(submitErrorView(api(503, 'unavailable', "Your request didn't go through. Please try again.")).message).toMatch(
      /didn't go through/,
    )
  })

  it('submit: 400 field errors go to the right inputs', () => {
    const v = submitErrorView(
      api(400, 'invalid', 'Some details need fixing.', { note: 'Too long', requesterName: 'Too long name', typed: 'Bad' }),
    )
    expect(v).toEqual({ closed: false, fields: { note: 'Too long', name: 'Too long name', song: 'Bad' }, message: null })
  })

  it('submit: errors with no visible input become the banner', () => {
    expect(fieldErrorView({ clientId: 'Reload the page.' })).toEqual({ closed: false, fields: {}, message: 'Reload the page.' })
  })

  it('submit: a non-API error still has words', () => {
    expect(submitErrorView(new TypeError('x')).message).toMatch(/try again/)
  })
})
