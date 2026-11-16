import { describe, it, expect, vi, afterEach } from 'vitest'
import { json, error, readJson, clientIp, sha256Hex, ipHash, verifyTurnstile } from '../../functions/_lib/guard.js'
import { onRequestGet as status } from '../../functions/api/status.js'
import { onRequest as catchall } from '../../functions/api/[[catchall]].js'

const post = (body, headers = {}) =>
  new Request('https://example.com/api/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })

afterEach(() => vi.unstubAllGlobals())

describe('json / error', () => {
  it('wraps data in { ok: true } with status and headers', async () => {
    const res = json({ id: 'a' }, 201, { 'Cache-Control': 'no-store' })
    expect(res.status).toBe(201)
    expect(res.headers.get('Content-Type')).toMatch(/^application\/json/)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(await res.json()).toEqual({ ok: true, id: 'a' })
  })

  it('builds the error envelope', async () => {
    const res = error(429, 'rate_limited', 'Slow down.')
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ ok: false, error: { code: 'rate_limited', message: 'Slow down.' } })
  })
})

describe('readJson', () => {
  it('parses a JSON object', async () => {
    expect(await readJson(post('{"a":1}'))).toEqual({ ok: true, data: { a: 1 } })
  })

  it('accepts a charset in the content type', async () => {
    const r = await readJson(post('{"a":1}', { 'Content-Type': 'application/json; charset=utf-8' }))
    expect(r.ok).toBe(true)
  })

  it('refuses other content types with 415', async () => {
    const r = await readJson(post('{"a":1}', { 'Content-Type': 'text/plain' }))
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(415)
  })

  it('refuses bodies over the limit with 413', async () => {
    const r = await readJson(post(JSON.stringify({ a: 'x'.repeat(100) })), 50)
    expect(r.ok).toBe(false)
    expect(r.response.status).toBe(413)
  })

  it('refuses an oversized declared Content-Length without reading', async () => {
    const r = await readJson(post('{}', { 'Content-Length': '999999' }))
    expect(r.response.status).toBe(413)
  })

  it('refuses bad JSON and non-objects with 400', async () => {
    for (const body of ['{nope', '[1,2]', '"str"', 'null', '']) {
      const r = await readJson(post(body))
      expect(r.ok).toBe(false)
      expect(r.response.status).toBe(400)
      expect((await r.response.json()).error.code).toBe('bad_json')
    }
  })
})

describe('clientIp / hashing', () => {
  it('reads CF-Connecting-IP', () => {
    expect(clientIp(new Request('https://x', { headers: { 'CF-Connecting-IP': '203.0.113.9' } }))).toBe('203.0.113.9')
    expect(clientIp(new Request('https://x'))).toBe('')
  })

  it('computes SHA-256 hex', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  it('salts the IP hash with HASH_SALT and falls back to a dev salt', async () => {
    const a = await ipHash({ HASH_SALT: 'one' }, '1.2.3.4')
    const b = await ipHash({ HASH_SALT: 'two' }, '1.2.3.4')
    const dev = await ipHash({}, '1.2.3.4')
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(b)
    expect(dev).toMatch(/^[0-9a-f]{64}$/)
    expect(dev).toBe(await ipHash(undefined, '1.2.3.4'))
    expect(a).not.toBe(await sha256Hex('1.2.3.4'))
  })
})

describe('verifyTurnstile', () => {
  it('is skipped when no secret is configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(await verifyTurnstile({}, 'tok', '1.2.3.4')).toEqual({ ok: true, skipped: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('fails without a token, without calling out', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect((await verifyTurnstile({ TURNSTILE_SECRET_KEY: 's' }, '')).ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('posts secret, token and ip to siteverify', async () => {
    const fetchSpy = vi.fn(async () => Response.json({ success: true }))
    vi.stubGlobal('fetch', fetchSpy)
    const r = await verifyTurnstile({ TURNSTILE_SECRET_KEY: 'sec' }, 'tok', '1.2.3.4')
    expect(r.ok).toBe(true)
    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.method).toBe('POST')
    expect(init.body.get('secret')).toBe('sec')
    expect(init.body.get('response')).toBe('tok')
    expect(init.body.get('remoteip')).toBe('1.2.3.4')
  })

  it('reports failure codes and network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] })))
    expect(await verifyTurnstile({ TURNSTILE_SECRET_KEY: 's' }, 't')).toEqual({ ok: false, codes: ['invalid-input-response'] })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    expect(await verifyTurnstile({ TURNSTILE_SECRET_KEY: 's' }, 't')).toEqual({ ok: false, codes: ['network-error'] })
  })
})

describe('api handlers', () => {
  it('GET /api/status returns defaults with a 15 s cache', async () => {
    const res = status()
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=15')
    expect(await res.json()).toEqual({ ok: true, live: false, eventName: null, requestsOpen: false, tipsEnabled: false })
  })

  it('unknown /api paths return a JSON 404', async () => {
    const res = catchall()
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })
})
