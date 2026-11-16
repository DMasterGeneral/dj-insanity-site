import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { deezerUrl } from '../../functions/_lib/search/deezer.js'
import { onRequestGet as search } from '../../functions/api/search/deezer.js'
import { slug } from '../../scripts/record-search-fixtures.mjs'

const FIXTURES = new URL('../fixtures/search/', import.meta.url)
const raw = (q) => JSON.parse(readFileSync(new URL(`${slug(q)}.deezer.json`, FIXTURES), 'utf8'))
const ctx = (q, extra = {}) => ({ request: new Request(`https://site.test/api/search/deezer?q=${encodeURIComponent(q)}`), ...extra })
const QUOTA = { error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }

/** Deezer answers with `replies` in turn (the last one repeats); the fixture by default. */
function stubDeezer(q, ...replies) {
  let n = 0
  const fetchSpy = vi.fn(async (url) => {
    if (url !== deezerUrl(q)) throw new Error(`unexpected fetch ${url}`)
    const reply = replies[Math.min(n++, replies.length - 1)]
    return reply ? reply() : Response.json(raw(q))
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

/** A Map-backed caches.default. */
function stubCache() {
  const store = new Map()
  vi.stubGlobal('caches', {
    default: {
      match: async (req) => store.get(req.url)?.clone(),
      put: async (req, res) => { store.set(req.url, res) },
    },
  })
  return store
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/search/deezer', () => {
  it("returns Deezer's parsed list, unmerged with rank kept, and caches it at the edge for 6 h", async () => {
    const store = stubCache()
    const fetchSpy = stubDeezer('move bitch ludacris')
    const waits = []
    const res = await search(ctx('  Move   Bitch LUDACRIS ', { waitUntil: (p) => waits.push(p) }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.songs.length).toBe(raw('move bitch ludacris').data.length)
    expect(body.songs[0]).toMatchObject({ title: 'Move Bitch', artist: 'Ludacris', explicit: true, source: 'deezer' })
    expect(body.songs[0].rank).toBeGreaterThan(0)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)

    await Promise.all(waits)
    const stored = store.get('https://site.test/api/search/deezer?q=move%20bitch%20ludacris')
    expect(stored.headers.get('Cache-Control')).toBe('public, max-age=21600')
    expect((await stored.clone().json()).songs).toEqual(body.songs)
  })

  it('caches an empty list too', async () => {
    const store = stubCache()
    stubDeezer('zzzz qqqq', () => Response.json({ data: [], total: 0 }))
    const waits = []
    const res = await search(ctx('zzzz qqqq', { waitUntil: (p) => waits.push(p) }))
    expect((await res.json()).songs).toEqual([])
    await Promise.all(waits)
    expect(store.size).toBe(1)
  })

  it('serves a repeat query from the edge cache, keyed by the normalised query', async () => {
    stubCache()
    const fetchSpy = stubDeezer('mr brightside')
    const waits = []
    const first = await (await search(ctx('mr brightside', { waitUntil: (p) => waits.push(p) }))).json()
    await Promise.all(waits)

    const res = await search(ctx('MR  Brightside'))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
    expect(await res.json()).toEqual(first)
  })

  it('retries once after a quota reply', async () => {
    const fetchSpy = stubDeezer('mr brightside', () => Response.json(QUOTA), null)
    const started = Date.now()
    const res = await search(ctx('mr brightside'))
    expect(res.status).toBe(200)
    expect((await res.json()).songs.length).toBeGreaterThan(0)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(Date.now() - started).toBeGreaterThanOrEqual(350)
  })

  it('answers 502 search_unavailable when Deezer fails, without caching', async () => {
    const store = stubCache()
    const cases = [
      [() => new Response('oops', { status: 500 }), 1],
      [() => { throw new TypeError('network') }, 1],
      [() => new Response('not json'), 1],
      [() => Response.json(QUOTA), 2],
    ]
    for (const [reply, calls] of cases) {
      const fetchSpy = stubDeezer('mr brightside', reply)
      const res = await search(ctx('mr brightside', { waitUntil: () => {} }))
      expect(res.status).toBe(502)
      expect(await res.json()).toEqual({
        ok: false,
        error: { code: 'search_unavailable', message: 'Search is having trouble — type the song instead.' },
      })
      expect(fetchSpy).toHaveBeenCalledTimes(calls)
    }
    expect(store.size).toBe(0)
  })

  it('rejects queries under 2 or over 80 characters', async () => {
    const fetchSpy = stubDeezer('x')
    for (const q of ['', ' a ', 'x'.repeat(81)]) {
      const res = await search(ctx(q))
      expect(res.status).toBe(400)
      expect((await res.json()).error.code).toBe('invalid_query')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
