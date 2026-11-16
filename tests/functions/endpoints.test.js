import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { _setTestClient, serverTimestamp, FirestoreError } from '../../functions/_lib/firestore.js'
import { onRequestPost as postRequest } from '../../functions/api/requests/index.js'
import { onRequestGet as getRequest } from '../../functions/api/requests/[id].js'
import { onRequestPost as postBooking, bookingToday } from '../../functions/api/bookings.js'
import { onRequestGet as getStatus } from '../../functions/api/status.js'
import { notifyBooking, bookingEmail, formatDate } from '../../functions/_lib/notify.js'

/**
 * In-memory stand-in for the Firestore client: documents in a Map, rate counters via commit.
 * `fail` makes the named method throw.
 */
function fakeFirestore({ fail = {} } = {}) {
  const docs = new Map()
  const boom = (m) => {
    if (fail[m]) throw new FirestoreError('fake failure', 503, 'UNAVAILABLE')
  }
  const resolve = (data) => {
    const out = {}
    for (const [k, v] of Object.entries(data)) {
      out[k] = v === serverTimestamp ? new Date('2026-11-16T00:00:00Z') : v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? resolve(v) : v
    }
    return out
  }
  return {
    docs,
    name: (p) => `projects/demo-test/databases/(default)/documents/${p}`,
    get: vi.fn(async (path) => {
      boom('get')
      return docs.has(path) ? structuredClone(docs.get(path)) : null
    }),
    create: vi.fn(async (col, id, data) => {
      boom('create')
      const path = `${col}/${id}`
      if (docs.has(path)) throw new FirestoreError('exists', 409, 'ALREADY_EXISTS')
      docs.set(path, resolve(data))
      return {}
    }),
    patch: vi.fn(async (path, data) => {
      boom('patch')
      docs.set(path, { ...(docs.get(path) || {}), ...resolve(data) })
      return {}
    }),
    commit: vi.fn(async (writes) => {
      boom('commit')
      return {
        writeResults: writes.map((w) => {
          const path = w.update.name.split('/documents/')[1]
          const doc = docs.get(path) || { count: 0 }
          doc.count += 1
          docs.set(path, doc)
          return { transformResults: [{ integerValue: String(doc.count) }] }
        }),
      }
    }),
  }
}

const SONG = {
  title: 'Move Bitch',
  artist: 'Ludacris',
  album: 'Word Of Mouf',
  artworkUrl: 'https://cdn-images.dzcdn.net/images/cover/x/250x250-000000-80-0-0.jpg',
  explicit: true,
  durationSec: 270,
  source: 'both',
  deezerId: '2534222',
  itunesId: '1452863856',
  isrc: 'USDJ20110894',
}

const BOOKING = {
  name: 'Pat Example',
  phone: '(555) 010-1234',
  email: 'Pat@Example.com',
  contactPreference: 'text',
  date: '2099-03-14',
  startTime: '20:00',
  endTime: '01:30',
  eventType: 'wedding',
  location: 'Somewhere Hall <b>',
  notes: 'First dance: "Careless Whisper" & more',
}

const post = (path, body, headers = {}) =>
  new Request(`https://site.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

let fs
const ENV = { HASH_SALT: 'test-salt' }

beforeEach(() => {
  fs = fakeFirestore()
  fs.docs.set('settings/public', { live: true, eventName: 'Test Night', requestsOpen: true, tipsEnabled: true })
  _setTestClient(fs)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  _setTestClient(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const requestBody = (extra = {}) => ({ song: SONG, note: 'for Sam', requesterName: 'Alex', clientId: 'device-abc-123', ...extra })

describe('POST /api/requests', () => {
  it('creates a pending request and returns 201 { id, status }', async () => {
    const res = await postRequest({ request: post('/api/requests', requestBody()), env: ENV })
    expect(res.status).toBe(201)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const body = await res.json()
    expect(body).toEqual({ ok: true, id: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/), status: 'pending' })

    const [col, id, data] = fs.create.mock.calls[0]
    expect(col).toBe('requests')
    expect(id).toBe(body.id)
    expect(data).toEqual({
      song: SONG,
      note: 'for Sam',
      requesterName: 'Alex',
      status: 'pending',
      tip: { amountCents: 0, state: 'none' },
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      clientHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      ipHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(data.clientHash).not.toBe(data.ipHash)
    expect(JSON.stringify(data)).not.toContain('device-abc-123')
    expect(JSON.stringify(data)).not.toContain('203.0.113.7')
  })

  it('accepts a typed request', async () => {
    const res = await postRequest({ request: post('/api/requests', { typed: 'that song from the wedding', clientId: 'device-abc-123' }), env: ENV })
    expect(res.status).toBe(201)
    expect(fs.create.mock.calls[0][2].song).toEqual({ title: 'that song from the wedding', artist: '', explicit: false, source: 'typed' })
  })

  it('answers 503 not_configured without Firestore', async () => {
    _setTestClient(null)
    const res = await postRequest({ request: post('/api/requests', requestBody()), env: {} })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: { code: 'not_configured', message: "Requests aren't available right now." } })
  })

  it('answers 400 invalid with per-field errors', async () => {
    const res = await postRequest({ request: post('/api/requests', { note: 'x'.repeat(200), clientId: 'no' }), env: ENV })
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('invalid')
    expect(Object.keys(error.fields).sort()).toEqual(['clientId', 'note', 'song'])
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('passes bad JSON errors through from readJson', async () => {
    const res = await postRequest({ request: post('/api/requests', '{nope'), env: ENV })
    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('bad_json')
  })

  it('answers 403 when Turnstile fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })))
    const res = await postRequest({ request: post('/api/requests', requestBody({ turnstileToken: 'bad' })), env: { ...ENV, TURNSTILE_SECRET_KEY: 's' } })
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('bot_check_failed')
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('answers 409 requests_closed when requests are closed or settings are missing', async () => {
    fs.docs.set('settings/public', { live: true, requestsOpen: false })
    let res = await postRequest({ request: post('/api/requests', requestBody()), env: ENV })
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('requests_closed')

    fs.docs.delete('settings/public')
    res = await postRequest({ request: post('/api/requests', requestBody()), env: ENV })
    expect(res.status).toBe(409)
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('answers 503 tips_unavailable for a tip', async () => {
    const res = await postRequest({ request: post('/api/requests', requestBody({ tipCents: 500 })), env: ENV })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('tips_unavailable')
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('allows 6 requests per 10 minutes per IP, then 429', async () => {
    for (let i = 0; i < 6; i++) {
      expect((await postRequest({ request: post('/api/requests', requestBody()), env: ENV })).status).toBe(201)
    }
    const res = await postRequest({ request: post('/api/requests', requestBody()), env: ENV })
    expect(res.status).toBe(429)
    const { error } = await res.json()
    expect(error.code).toBe('rate_limited')
    expect(error.message).not.toMatch(/firestore|ipHash/i)
    expect(fs.create).toHaveBeenCalledTimes(6)
    // another IP is not affected
    const other = await postRequest({ request: post('/api/requests', requestBody(), { 'CF-Connecting-IP': '198.51.100.1' }), env: ENV })
    expect(other.status).toBe(201)
  })

  it('still accepts the request when the rate counter fails', async () => {
    fs.commit.mockRejectedValueOnce(new FirestoreError('down', 503, 'UNAVAILABLE'))
    expect((await postRequest({ request: post('/api/requests', requestBody()), env: ENV })).status).toBe(201)
  })

  it('answers 503 unavailable when the write fails', async () => {
    const failing = fakeFirestore({ fail: { create: true } })
    failing.docs.set('settings/public', { requestsOpen: true })
    _setTestClient(failing)
    const res = await postRequest({ request: post('/api/requests', requestBody()), env: ENV })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('unavailable')
  })
})

describe('GET /api/requests/:id', () => {
  const get = (id, env = ENV) => getRequest({ params: { id }, env, request: new Request(`https://site.test/api/requests/${id}`) })

  it('returns only status and tipState, uncached', async () => {
    const created = await (await postRequest({ request: post('/api/requests', requestBody()), env: ENV })).json()
    const res = await get(created.id)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({ ok: true, status: 'pending', tipState: 'none' })
    for (const secret of ['Move Bitch', 'Ludacris', 'for Sam', 'Alex', 'device-abc-123']) expect(text).not.toContain(secret)
  })

  it('404s for malformed and unknown ids without touching Firestore for bad ones', async () => {
    for (const id of ['short', 'has/slash/aaaaaaaaaaaaaaaaaaaa', 'x'.repeat(41), '../settings/public']) {
      expect((await get(id)).status).toBe(404)
    }
    expect(fs.get).not.toHaveBeenCalled()
    expect((await get('A'.repeat(24))).status).toBe(404)
  })

  it('answers 503 when Firestore is not configured', async () => {
    _setTestClient(null)
    expect((await get('A'.repeat(24), {})).status).toBe(503)
  })
})

describe('POST /api/bookings', () => {
  let waits
  const ctx = (body, env = ENV, headers) => ({
    request: post('/api/bookings', body, headers),
    env,
    waitUntil: (p) => waits.push(p),
  })
  beforeEach(() => {
    waits = []
  })

  it('saves the booking, answers 201 { id } and notifies in the background', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ id: 'email-1' }))
    vi.stubGlobal('fetch', fetchSpy)
    const env = { ...ENV, RESEND_API_KEY: 're_test', NOTIFY_EMAIL_TO: 'dj@example.com' }
    const res = await postBooking(ctx({ ...BOOKING, turnstileToken: 'x' }, env))
    expect(res.status).toBe(201)
    const { id } = await res.json()
    expect(id).toMatch(/^[A-Za-z0-9_-]{24}$/)

    const [col, docId, data] = fs.create.mock.calls[0]
    expect([col, docId]).toEqual(['bookings', id])
    expect(data).toEqual({
      name: 'Pat Example',
      phone: '5550101234',
      email: 'pat@example.com',
      contactPreference: 'text',
      date: '2099-03-14',
      startTime: '20:00',
      endTime: '01:30',
      eventType: 'wedding',
      location: 'Somewhere Hall <b>',
      notes: 'First dance: "Careless Whisper" & more',
      status: 'new',
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      ipHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    expect(data).not.toHaveProperty('turnstileToken')

    expect(waits).toHaveLength(1)
    await Promise.all(waits)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(init.headers.Authorization).toBe('Bearer re_test')
    const email = JSON.parse(init.body)
    expect(email).toMatchObject({
      from: 'DJ Insanity Bookings <onboarding@resend.dev>',
      to: ['dj@example.com'],
      reply_to: 'pat@example.com',
      subject: 'New booking request — Wedding, Sat, Mar 14 2099',
    })
    expect(fs.patch).not.toHaveBeenCalled()
  })

  it('still answers 201 when the email fails, and records notifyError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: 'nope' }, { status: 403 })))
    const env = { ...ENV, RESEND_API_KEY: 're_test', NOTIFY_EMAIL_TO: 'dj@example.com' }
    const res = await postBooking(ctx(BOOKING, env))
    expect(res.status).toBe(201)
    const { id } = await res.json()
    await Promise.all(waits)
    expect(fs.patch).toHaveBeenCalledWith(`bookings/${id}`, { notifyError: expect.stringMatching(/^email: HTTP 403/) })
    expect(fs.docs.get(`bookings/${id}`).notifyError).toMatch(/403/)
    expect(fs.docs.get(`bookings/${id}`).name).toBe('Pat Example')
  })

  it('skips email quietly when Resend is not configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect((await postBooking(ctx(BOOKING))).status).toBe(201)
    await Promise.all(waits)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fs.patch).not.toHaveBeenCalled()
  })

  it('answers 503 not_configured without Firestore', async () => {
    _setTestClient(null)
    const res = await postBooking(ctx(BOOKING, {}))
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('not_configured')
  })

  it('answers 400 invalid with per-field errors', async () => {
    const res = await postBooking(ctx({ name: '', contactPreference: 'email', date: '2001-01-01', startTime: '20:00', endTime: '20:00', eventType: 'rave' }))
    expect(res.status).toBe(400)
    const { error } = await res.json()
    expect(error.code).toBe('invalid')
    expect(error.fields).toMatchObject({ name: expect.any(String), email: expect.any(String), date: expect.any(String), endTime: expect.any(String), eventType: expect.any(String) })
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('treats yesterday (UTC) as the earliest allowed date', async () => {
    expect(bookingToday(Date.UTC(2026, 10, 16, 3, 0))).toBe('2026-11-15')
    const res = await postBooking(ctx({ ...BOOKING, date: bookingToday() }))
    expect(res.status).toBe(201)
  })

  it('answers 403 when Turnstile fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false })))
    const res = await postBooking(ctx({ ...BOOKING, turnstileToken: 'bad' }, { ...ENV, TURNSTILE_SECRET_KEY: 's' }))
    expect(res.status).toBe(403)
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('allows 3 bookings per hour per IP, then 429', async () => {
    for (let i = 0; i < 3; i++) expect((await postBooking(ctx(BOOKING))).status).toBe(201)
    const res = await postBooking(ctx(BOOKING))
    expect(res.status).toBe(429)
    expect((await res.json()).error.code).toBe('rate_limited')
    expect(fs.create).toHaveBeenCalledTimes(3)
  })
})

describe('notifyBooking', () => {
  const booking = {
    name: 'Pat <script>',
    phone: '+15550101234',
    email: 'pat@example.com',
    contactPreference: 'call',
    date: '2027-03-13',
    startTime: '19:30',
    endTime: '00:00',
    eventType: 'club_bar',
    location: null,
    notes: 'Bring "lights" & fog',
  }

  it('builds the subject and a body with every field, links and escaped HTML', () => {
    const { subject, text, html } = bookingEmail(booking, { id: 'b1', origin: 'https://site.test' })
    expect(subject).toBe('New booking request — Club / bar, Sat, Mar 13 2027')
    expect(text).toContain('Time: 7:30 PM – 12:00 AM (4 h 30 min)')
    expect(text).toContain('Preferred contact: Call')
    expect(text).toContain('Dashboard: https://site.test/dj')
    expect(html).toContain('href="tel:+15550101234"')
    expect(html).toContain('href="sms:+15550101234"')
    expect(html).toContain('href="mailto:pat@example.com"')
    expect(html).toContain('href="https://site.test/dj"')
    expect(html).toContain('Pat &lt;script&gt;')
    expect(html).toContain('Bring &quot;lights&quot; &amp; fog')
    expect(html).not.toContain('<script>')
    expect(formatDate('2027-03-14')).toBe('Sun, Mar 14 2027')
  })

  it('skips email without a key or recipient, sends an ntfy push when PUSH_URL is set', async () => {
    const fetchSpy = vi.fn(async () => new Response('ok'))
    vi.stubGlobal('fetch', fetchSpy)
    expect(await notifyBooking({ RESEND_API_KEY: 'k' }, booking, { id: 'b1', origin: 'https://site.test' })).toEqual({ email: 'skipped', push: 'skipped' })
    expect(fetchSpy).not.toHaveBeenCalled()

    const r = await notifyBooking({ PUSH_URL: 'https://ntfy.sh/topic' }, booking, { id: 'b1', origin: 'https://site.test' })
    expect(r).toEqual({ email: 'skipped', push: 'sent' })
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://ntfy.sh/topic')
    expect(init.headers.Title).toBe('New booking request')
    expect(init.body).toContain('Club / bar, Sat, Mar 13 2027')
  })

  it('reports failures without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down') }))
    const r = await notifyBooking({ RESEND_API_KEY: 'k', NOTIFY_EMAIL_TO: 'a@b.co', PUSH_URL: 'https://ntfy.sh/t' }, booking, { id: 'b1', origin: 'https://site.test' })
    expect(r).toEqual({ email: 'failed', push: 'failed', error: 'email: network down; push: network down' })
  })
})

describe('GET /api/status', () => {
  const ctx = (env = ENV) => ({ request: new Request('https://site.test/api/status'), env, waitUntil: () => {} })

  it('reads settings/public with a 15 s cache; tipsEnabled needs Stripe too', async () => {
    let res = await getStatus(ctx())
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=15')
    expect(await res.json()).toEqual({ ok: true, live: true, eventName: 'Test Night', requestsOpen: true, tipsEnabled: false })
    res = await getStatus(ctx({ ...ENV, STRIPE_SECRET_KEY: 'sk_test_x' }))
    expect((await res.json()).tipsEnabled).toBe(true)
  })

  it('falls back to defaults when unconfigured, missing or failing', async () => {
    const defaults = { ok: true, live: false, eventName: null, requestsOpen: false, tipsEnabled: false }
    _setTestClient(null)
    expect(await (await getStatus(ctx({}))).json()).toEqual(defaults)
    _setTestClient(fakeFirestore())
    expect(await (await getStatus(ctx())).json()).toEqual(defaults)
    _setTestClient(fakeFirestore({ fail: { get: true } }))
    expect(await (await getStatus(ctx())).json()).toEqual(defaults)
  })

  it('serves from the edge cache when present', async () => {
    const store = new Map()
    vi.stubGlobal('caches', {
      default: { match: async (req) => store.get(req.url)?.clone(), put: async (req, res) => { store.set(req.url, res) } },
    })
    const waits = []
    await getStatus({ ...ctx(), waitUntil: (p) => waits.push(p) })
    await Promise.all(waits)
    expect(store.has('https://site.test/api/status')).toBe(true)
    fs.docs.set('settings/public', { live: false })
    expect((await (await getStatus(ctx())).json()).live).toBe(true)
  })
})
