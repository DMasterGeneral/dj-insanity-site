import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { _setTestClient, serverTimestamp, FirestoreError } from '../../functions/_lib/firestore.js'
import { encodeForm, verifyWebhook, createClient, fromEnv, StripeError, STRIPE_VERSION } from '../../functions/_lib/stripe.js'
import { settle } from '../../functions/_lib/tips.js'
import { onRequestPost as postRequest, INTEGRATION_ID } from '../../functions/api/requests/index.js'
import { onRequestGet as getRequest } from '../../functions/api/requests/[id].js'
import { onRequestPost as postWebhook } from '../../functions/api/stripe/webhook.js'
import { onRequestGet as getStatus } from '../../functions/api/status.js'

const WHSEC = 'whsec_test_secret_123'
const ENV = { HASH_SALT: 'test-salt', STRIPE_SECRET_KEY: 'rk_test_abc', STRIPE_WEBHOOK_SECRET: WHSEC }
const RID = 'R'.repeat(24)
const CS = 'cs_test_a1b2c3'

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)
function setPath(obj, path, value) {
  const keys = path.split('.')
  let o = obj
  for (const k of keys.slice(0, -1)) o = o[k] && typeof o[k] === 'object' ? o[k] : (o[k] = {})
  o[keys.at(-1)] = value
}

/**
 * Fake Firestore that behaves like the real one where tips depend on it: each doc has an
 * updateTime that changes on every write, patch applies only the masked (dotted) paths, and an
 * updateTime precondition fails with FAILED_PRECONDITION when the doc changed since the read.
 */
function fakeFirestore({ fail = {} } = {}) {
  const docs = new Map()
  let clock = 0
  const stamp = () => `2026-11-21T00:00:${String(++clock).padStart(2, '0')}Z`
  const boom = (m) => {
    if (fail[m]) throw new FirestoreError('fake failure', 503, 'UNAVAILABLE')
  }
  const resolve = (data) => {
    const out = {}
    for (const [k, v] of Object.entries(data)) {
      out[k] = v === serverTimestamp ? new Date('2026-11-21T00:00:00Z') : v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? resolve(v) : v
    }
    return out
  }
  const fs = {
    docs,
    /** Put a doc in place as a test fixture. */
    seed(path, data) {
      docs.set(path, { data: structuredClone(data), updateTime: stamp() })
    },
    data: (path) => docs.get(path)?.data,
    name: (p) => `projects/demo-test/databases/(default)/documents/${p}`,
    get: vi.fn(async (path) => {
      boom('get')
      return docs.has(path) ? structuredClone(docs.get(path).data) : null
    }),
    getWithTime: vi.fn(async (path) => {
      boom('get')
      const d = docs.get(path)
      return d ? { data: structuredClone(d.data), updateTime: d.updateTime } : null
    }),
    create: vi.fn(async (col, id, data) => {
      boom('create')
      const path = `${col}/${id}`
      if (docs.has(path)) throw new FirestoreError('exists', 409, 'ALREADY_EXISTS')
      docs.set(path, { data: resolve(data), updateTime: stamp() })
      return {}
    }),
    patch: vi.fn(async (path, data, mask = Object.keys(data), { updateTime } = {}) => {
      boom('patch')
      const d = docs.get(path)
      if (updateTime && (!d || d.updateTime !== updateTime)) throw new FirestoreError('precondition', 400, 'FAILED_PRECONDITION')
      const next = d ? d.data : {}
      const r = resolve(data)
      for (const p of mask) setPath(next, p, getPath(r, p))
      docs.set(path, { data: next, updateTime: stamp() })
      return {}
    }),
    // rate-limit counters only
    commit: vi.fn(async (writes) => {
      boom('commit')
      return { writeResults: writes.map(() => ({ transformResults: [{ integerValue: '1' }] })) }
    }),
  }
  return fs
}

const awaiting = (extra = {}) => ({
  song: { title: 'Get Low', artist: 'Lil Jon', explicit: true, source: 'itunes' },
  status: 'awaiting_payment',
  tip: { amountCents: 1000, state: 'pending', checkoutSessionId: CS },
  ...extra,
})

const session = (extra = {}) => ({
  id: CS,
  object: 'checkout.session',
  status: 'complete',
  payment_status: 'paid',
  amount_total: 1000,
  client_reference_id: RID,
  metadata: { requestId: RID },
  ...extra,
})

/** fetch stub for api.stripe.com; records every call. */
function stubStripe(handler) {
  const spy = vi.fn(async (url, init) => handler(url, init))
  vi.stubGlobal('fetch', spy)
  return spy
}

let fs
beforeEach(() => {
  fs = fakeFirestore()
  fs.seed('settings/public', { live: true, requestsOpen: true, tipsEnabled: true })
  _setTestClient(fs)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  _setTestClient(null)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------- client

describe('stripe client', () => {
  it('form-encodes nested objects and arrays in bracket form', () => {
    const body = encodeForm({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Tip & thanks' }, unit_amount: 500 }, quantity: 1 }],
      metadata: { requestId: 'abc' },
      skip: undefined,
      none: null,
      flag: true,
    })
    expect(body).toBe(
      'mode=payment' +
        '&line_items%5B0%5D%5Bprice_data%5D%5Bcurrency%5D=usd' +
        '&line_items%5B0%5D%5Bprice_data%5D%5Bproduct_data%5D%5Bname%5D=Tip+%26+thanks' +
        '&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=500' +
        '&line_items%5B0%5D%5Bquantity%5D=1' +
        '&metadata%5BrequestId%5D=abc' +
        '&flag=true',
    )
    expect([...new URLSearchParams(body).keys()]).toContain('line_items[0][price_data][product_data][name]')
  })

  it('sends the key, the pinned API version and a form body; GETs have no body', async () => {
    const spy = stubStripe(() => Response.json({ id: CS }))
    const stripe = createClient('rk_test_abc')
    await stripe.createCheckoutSession({ mode: 'payment' })
    await stripe.retrieveCheckoutSession(CS)
    await stripe.expireCheckoutSession(CS)
    const [[u1, i1], [u2, i2], [u3, i3]] = spy.mock.calls
    expect(u1).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect(i1).toMatchObject({ method: 'POST', body: 'mode=payment' })
    expect(i1.headers).toEqual({ Authorization: 'Bearer rk_test_abc', 'Stripe-Version': '2026-10-28.endive', 'Content-Type': 'application/x-www-form-urlencoded' })
    expect(STRIPE_VERSION).toBe('2026-10-28.endive')
    expect(u2).toBe(`https://api.stripe.com/v1/checkout/sessions/${CS}`)
    expect(i2).toMatchObject({ method: 'GET', body: undefined })
    expect(i2.headers['Content-Type']).toBeUndefined()
    expect(u3).toBe(`https://api.stripe.com/v1/checkout/sessions/${CS}/expire`)
    expect(i3.method).toBe('POST')
  })

  it('turns Stripe errors and network failures into StripeError', async () => {
    stubStripe(() => Response.json({ error: { type: 'invalid_request_error', code: 'resource_missing', message: 'No such session' } }, { status: 404 }))
    const err = await createClient('rk_test_abc').retrieveCheckoutSession('cs_x').catch((e) => e)
    expect(err).toBeInstanceOf(StripeError)
    expect(err).toMatchObject({ status: 404, type: 'invalid_request_error', code: 'resource_missing', message: 'No such session' })

    stubStripe(() => {
      throw new TypeError('network down')
    })
    expect(await createClient('k').retrieveCheckoutSession('cs_x').catch((e) => e)).toMatchObject({ name: 'StripeError', status: 0 })
  })

  it('fromEnv is null without STRIPE_SECRET_KEY', () => {
    expect(fromEnv({})).toBeNull()
    expect(fromEnv({ STRIPE_SECRET_KEY: 'rk_test_abc' })).not.toBeNull()
  })
})

// ---------------------------------------------------------------- signatures

const sign = (body, t, secret = WHSEC) => createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
const NOW = 1_800_000_000

describe('verifyWebhook', () => {
  const body = '{"id":"evt_1","type":"checkout.session.completed"}'

  it('accepts a valid signature, also among several v1 values and with a v0', async () => {
    expect(await verifyWebhook(body, `t=${NOW},v1=${sign(body, NOW)}`, WHSEC, NOW)).toBe(true)
    expect(await verifyWebhook(body, `t=${NOW},v1=${'0'.repeat(64)},v1=${sign(body, NOW)},v0=abc`, WHSEC, NOW)).toBe(true)
  })

  it('refuses a wrong secret, a changed body and a signature for another timestamp', async () => {
    expect(await verifyWebhook(body, `t=${NOW},v1=${sign(body, NOW, 'whsec_other')}`, WHSEC, NOW)).toBe(false)
    expect(await verifyWebhook(`${body} `, `t=${NOW},v1=${sign(body, NOW)}`, WHSEC, NOW)).toBe(false)
    expect(await verifyWebhook(body, `t=${NOW + 1},v1=${sign(body, NOW)}`, WHSEC, NOW + 1)).toBe(false)
  })

  it('refuses timestamps outside the 300 s tolerance', async () => {
    const old = NOW - 301
    expect(await verifyWebhook(body, `t=${old},v1=${sign(body, old)}`, WHSEC, NOW)).toBe(false)
    const edge = NOW - 300
    expect(await verifyWebhook(body, `t=${edge},v1=${sign(body, edge)}`, WHSEC, NOW)).toBe(true)
    const future = NOW + 301
    expect(await verifyWebhook(body, `t=${future},v1=${sign(body, future)}`, WHSEC, NOW)).toBe(false)
  })

  it('refuses malformed or missing headers', async () => {
    const good = sign(body, NOW)
    for (const h of [null, '', 'garbage', `v1=${good}`, `t=${NOW}`, `t=abc,v1=${good}`, `t=${NOW},v0=${good}`, `t=${NOW},v1=`]) {
      expect(await verifyWebhook(body, h, WHSEC, NOW)).toBe(false)
    }
    expect(await verifyWebhook(body, `t=${NOW},v1=${good}`, '', NOW)).toBe(false)
  })
})

// ---------------------------------------------------------------- POST /api/requests (tip)

const post = (body) =>
  new Request('https://site.test/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
    body: JSON.stringify(body),
  })
const tipBody = (tipCents = 1000) => ({ typed: 'Get Low', note: 'for Sam', clientId: 'device-abc-123', tipCents })

describe('POST /api/requests with a tip', () => {
  it('answers 503 tips_unavailable unless tips are on and both Stripe secrets are set', async () => {
    const fetchSpy = stubStripe(() => Response.json({}))
    for (const env of [
      { HASH_SALT: 's' },
      { ...ENV, STRIPE_SECRET_KEY: undefined },
      { ...ENV, STRIPE_WEBHOOK_SECRET: undefined },
    ]) {
      const res = await postRequest({ request: post(tipBody()), env })
      expect(res.status).toBe(503)
      expect((await res.json()).error.code).toBe('tips_unavailable')
    }
    fs.seed('settings/public', { requestsOpen: true, tipsEnabled: false })
    const res = await postRequest({ request: post(tipBody()), env: ENV })
    expect((await res.json()).error.code).toBe('tips_unavailable')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('creates a Checkout Session, writes the doc as awaiting_payment and returns the clientSecret', async () => {
    const now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const spy = stubStripe(() => Response.json({ id: CS, client_secret: 'cs_test_a1b2c3_secret_xyz', status: 'open' }))
    const res = await postRequest({ request: post(tipBody(1500)), env: ENV })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ ok: true, id: expect.stringMatching(/^[A-Za-z0-9_-]{24}$/), status: 'awaiting_payment', clientSecret: 'cs_test_a1b2c3_secret_xyz' })

    expect(spy).toHaveBeenCalledTimes(1)
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions')
    expect(init.headers['Stripe-Version']).toBe('2026-10-28.endive')
    const params = Object.fromEntries(new URLSearchParams(init.body))
    expect(params).toEqual({
      ui_mode: 'elements',
      mode: 'payment',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][product_data][name]': 'Tip for DJ Insanity',
      'line_items[0][price_data][unit_amount]': '1500',
      'line_items[0][quantity]': '1',
      return_url: `https://site.test/request/thanks?rid=${body.id}`,
      client_reference_id: body.id,
      'metadata[requestId]': body.id,
      'payment_intent_data[metadata][requestId]': body.id,
      expires_at: String(now / 1000 + 31 * 60),
      integration_identifier: INTEGRATION_ID,
    })
    expect(INTEGRATION_ID).toMatch(/^dj_insanity_tips_[a-z]{8}$/)
    expect(init.body).not.toContain('payment_method_types')

    const doc = fs.data(`requests/${body.id}`)
    expect(doc).toMatchObject({ status: 'awaiting_payment', note: 'for Sam', tip: { amountCents: 1500, state: 'pending', checkoutSessionId: CS } })
  })

  it('expires the session and answers 503 when the doc write fails', async () => {
    const failing = fakeFirestore({ fail: { create: true } })
    failing.seed('settings/public', { requestsOpen: true, tipsEnabled: true })
    _setTestClient(failing)
    const spy = stubStripe((url) => Response.json(url.endsWith('/expire') ? { id: CS, status: 'expired' } : { id: CS, client_secret: 's' }))
    const res = await postRequest({ request: post(tipBody()), env: ENV })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('unavailable')
    expect(spy.mock.calls.map(([u]) => u)).toEqual([
      'https://api.stripe.com/v1/checkout/sessions',
      `https://api.stripe.com/v1/checkout/sessions/${CS}/expire`,
    ])
  })

  it('answers 503 tips_unavailable without writing when Stripe refuses the session', async () => {
    stubStripe(() => Response.json({ error: { type: 'api_error', message: 'boom' } }, { status: 500 }))
    const res = await postRequest({ request: post(tipBody()), env: ENV })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('tips_unavailable')
    expect(fs.create).not.toHaveBeenCalled()
  })

  it('a request without a tip still skips Stripe', async () => {
    const spy = stubStripe(() => Response.json({}))
    const res = await postRequest({ request: post(tipBody(0)), env: ENV })
    expect(res.status).toBe(201)
    expect((await res.json()).status).toBe('pending')
    expect(spy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------- webhook

function hook(event, { secret = WHSEC, t = Math.floor(Date.now() / 1000), env = ENV } = {}) {
  const body = JSON.stringify(event)
  return postWebhook({
    request: new Request('https://site.test/api/stripe/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${sign(body, t, secret)}` },
      body,
    }),
    env,
  })
}
const event = (type, obj = session()) => ({ id: `evt_${type}`, type, data: { object: obj } })

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => fs.seed(`requests/${RID}`, awaiting()))

  it('answers 400 for a bad or stale signature and changes nothing', async () => {
    expect((await hook(event('checkout.session.completed'), { secret: 'whsec_wrong' })).status).toBe(400)
    expect((await hook(event('checkout.session.completed'), { t: Math.floor(Date.now() / 1000) - 600 })).status).toBe(400)
    expect(fs.patch).not.toHaveBeenCalled()
    expect(fs.data(`requests/${RID}`).tip.state).toBe('pending')
  })

  it('answers 503 when the webhook secret or Firestore is missing', async () => {
    expect((await hook(event('checkout.session.completed'), { env: { ...ENV, STRIPE_WEBHOOK_SECRET: undefined } })).status).toBe(503)
    _setTestClient(null)
    expect((await hook(event('checkout.session.completed'))).status).toBe(503)
  })

  it('completed + paid: the request reaches the DJ with the paid amount', async () => {
    const res = await hook(event('checkout.session.completed', session({ amount_total: 1200 })))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, result: 'paid' })
    const doc = fs.data(`requests/${RID}`)
    expect(doc).toMatchObject({ status: 'pending', tip: { state: 'paid', amountCents: 1200, checkoutSessionId: CS }, song: { title: 'Get Low' } })
    expect(doc.paidAt).toBeInstanceOf(Date)
    expect(doc.updatedAt).toBeInstanceOf(Date)
  })

  it('completed but unpaid (delayed method) changes nothing; async_payment_succeeded then pays', async () => {
    expect(await (await hook(event('checkout.session.completed', session({ payment_status: 'unpaid' })))).json()).toEqual({ ok: true, result: 'unchanged' })
    expect(fs.data(`requests/${RID}`)).toMatchObject({ status: 'awaiting_payment', tip: { state: 'pending' } })
    expect(fs.patch).not.toHaveBeenCalled()

    await hook(event('checkout.session.async_payment_succeeded'))
    expect(fs.data(`requests/${RID}`)).toMatchObject({ status: 'pending', tip: { state: 'paid' } })
  })

  it('async_payment_failed and expired mark the tip failed; the request stays off the dashboard', async () => {
    await hook(event('checkout.session.async_payment_failed', session({ payment_status: 'unpaid' })))
    expect(fs.data(`requests/${RID}`)).toMatchObject({ status: 'awaiting_payment', tip: { state: 'failed' } })

    fs.seed(`requests/${RID}`, awaiting())
    await hook(event('checkout.session.expired', session({ status: 'expired', payment_status: 'unpaid' })))
    expect(fs.data(`requests/${RID}`)).toMatchObject({ status: 'awaiting_payment', tip: { state: 'failed' } })
  })

  it('expired after paid stays paid; a replay after the DJ played it changes nothing', async () => {
    await hook(event('checkout.session.completed'))
    const res = await hook(event('checkout.session.expired', session({ status: 'expired', payment_status: 'unpaid' })))
    expect((await res.json()).result).toBe('unchanged')
    expect(fs.data(`requests/${RID}`).tip.state).toBe('paid')

    fs.data(`requests/${RID}`).status = 'played' // the DJ marks it played
    expect((await (await hook(event('checkout.session.completed'))).json()).result).toBe('unchanged')
    expect(fs.data(`requests/${RID}`)).toMatchObject({ status: 'played', tip: { state: 'paid' } })
    expect(fs.patch).toHaveBeenCalledTimes(1)
  })

  it('ignores other event types, foreign sessions and sessions for another request id', async () => {
    expect(await (await hook(event('payment_intent.succeeded'))).json()).toEqual({ ok: true, ignored: true })
    expect(await (await hook(event('checkout.session.completed', session({ metadata: {} })))).json()).toEqual({ ok: true, ignored: true })
    expect(await (await hook(event('checkout.session.completed', session({ id: 'cs_other' })))).json()).toEqual({ ok: true, result: 'unchanged' })
    expect(fs.patch).not.toHaveBeenCalled()
  })

  it('a missing request doc answers 200', async () => {
    fs.docs.delete(`requests/${RID}`)
    const res = await hook(event('checkout.session.completed'))
    expect(res.status).toBe(200)
    expect((await res.json()).result).toBe('missing')
  })

  it('a write conflict is re-read and re-evaluated once', async () => {
    // Between this webhook's read and its write, another delivery settles the doc.
    const realGet = fs.getWithTime.getMockImplementation()
    fs.getWithTime.mockImplementationOnce(async (path) => {
      const snap = await realGet(path)
      await fs.patch(path, { status: 'pending', tip: { state: 'paid', amountCents: 1000 } }, ['status', 'tip.state', 'tip.amountCents'])
      return snap
    })
    const res = await hook(event('checkout.session.completed'))
    expect(res.status).toBe(200)
    expect((await res.json()).result).toBe('unchanged')
    expect(fs.getWithTime).toHaveBeenCalledTimes(2)
  })

  it('answers 500 when the conflict persists or Firestore is down, so Stripe retries', async () => {
    fs.patch.mockRejectedValue(new FirestoreError('precondition', 400, 'FAILED_PRECONDITION'))
    expect((await hook(event('checkout.session.completed'))).status).toBe(500)
    expect(fs.patch).toHaveBeenCalledTimes(2)

    const down = fakeFirestore({ fail: { get: true } })
    _setTestClient(down)
    expect((await hook(event('checkout.session.completed'))).status).toBe(500)
  })
})

describe('settle', () => {
  it('does not retry errors that are not conflicts', async () => {
    fs.seed(`requests/${RID}`, awaiting())
    fs.patch.mockRejectedValueOnce(new FirestoreError('down', 503, 'UNAVAILABLE'))
    await expect(settle(fs, RID, session())).rejects.toMatchObject({ grpcStatus: 'UNAVAILABLE' })
    expect(fs.getWithTime).toHaveBeenCalledTimes(1)
  })

  it('sends the read updateTime as the write precondition', async () => {
    fs.seed(`requests/${RID}`, awaiting())
    const { updateTime } = fs.docs.get(`requests/${RID}`)
    await settle(fs, RID, session())
    expect(fs.patch.mock.calls[0][3]).toEqual({ updateTime })
  })
})

// ---------------------------------------------------------------- GET /api/requests/:id

describe('GET /api/requests/:id settle on read', () => {
  const get = (env = ENV) => getRequest({ params: { id: RID }, env })
  beforeEach(() => fs.seed(`requests/${RID}`, awaiting()))

  it('settles a paid session on the first poll', async () => {
    const spy = stubStripe(() => Response.json(session()))
    const res = await get()
    expect(await res.json()).toEqual({ ok: true, status: 'pending', tipState: 'paid' })
    expect(spy.mock.calls[0][0]).toBe(`https://api.stripe.com/v1/checkout/sessions/${CS}`)
    expect(fs.data(`requests/${RID}`)).toMatchObject({ status: 'pending', tip: { state: 'paid' } })
    // once settled, polls no longer ask Stripe
    await get()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('an open unpaid session stays pending and says checkout: open', async () => {
    stubStripe(() => Response.json(session({ status: 'open', payment_status: 'unpaid' })))
    expect(await (await get()).json()).toEqual({ ok: true, status: 'awaiting_payment', tipState: 'pending', checkout: 'open' })
  })

  it('a complete but unpaid (processing) session has no checkout flag; nor does a paid one', async () => {
    stubStripe(() => Response.json(session({ status: 'complete', payment_status: 'unpaid' })))
    expect(await (await get()).json()).toEqual({ ok: true, status: 'awaiting_payment', tipState: 'pending' })
    stubStripe(() => Response.json(session({ status: 'complete', payment_status: 'paid' })))
    expect(await (await get()).json()).toEqual({ ok: true, status: 'pending', tipState: 'paid' })
  })

  it('a Stripe error or a write conflict returns the current state', async () => {
    stubStripe(() => Response.json({ error: { message: 'down' } }, { status: 500 }))
    let res = await get()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, status: 'awaiting_payment', tipState: 'pending' })

    stubStripe(() => Response.json(session()))
    fs.patch.mockRejectedValue(new FirestoreError('precondition', 400, 'FAILED_PRECONDITION'))
    res = await get()
    expect(await res.json()).toEqual({ ok: true, status: 'awaiting_payment', tipState: 'pending' })
  })

  it('does not call Stripe without a secret key', async () => {
    const spy = stubStripe(() => Response.json(session()))
    expect(await (await get({ HASH_SALT: 's' })).json()).toEqual({ ok: true, status: 'awaiting_payment', tipState: 'pending' })
    expect(spy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------- status

describe('GET /api/status tipsEnabled', () => {
  const status = async (env) => (await (await getStatus({ request: new Request('https://site.test/api/status'), env, waitUntil: () => {} })).json()).tipsEnabled

  it('needs settings.tipsEnabled, the API key and the webhook secret', async () => {
    expect(await status(ENV)).toBe(true)
    expect(await status({ ...ENV, STRIPE_WEBHOOK_SECRET: '' })).toBe(false)
    expect(await status({ ...ENV, STRIPE_SECRET_KEY: '' })).toBe(false)
    fs.seed('settings/public', { requestsOpen: true, tipsEnabled: false })
    expect(await status(ENV)).toBe(false)
  })
})
