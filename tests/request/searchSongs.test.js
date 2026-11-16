import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { searchSongs } from '../../src/pages/request/searchSongs.js'
import { searchErrorMessage } from '../../src/pages/request/requestLogic.js'
import { ApiError } from '../../src/lib/api.js'
import { itunesUrl } from '../../shared/search/itunes.js'
import { parseDeezer } from '../../functions/_lib/search/deezer.js'
import { slug } from '../../scripts/record-search-fixtures.mjs'

const FIXTURES = new URL('../fixtures/search/', import.meta.url)
const raw = (q, provider) => JSON.parse(readFileSync(new URL(`${slug(q)}.${provider}.json`, FIXTURES), 'utf8'))
const deezerPath = (q) => `/api/search/deezer?q=${encodeURIComponent(q)}`
const UNAVAILABLE = { ok: false, error: { code: 'search_unavailable', message: 'Search is having trouble — type the song instead.' } }

/**
 * Stub fetch for one query: iTunes straight from the browser, Deezer through our endpoint (as
 * /api/search/deezer answers it). `itunes` / `deezer` override a reply.
 */
function stubFetch(q, { itunes, deezer } = {}) {
  const fetchSpy = vi.fn(async (url, init) => {
    if (init?.signal?.aborted) throw init.signal.reason
    if (url === itunesUrl(q)) return itunes ? itunes(init) : Response.json(raw(q, 'itunes'))
    if (url === deezerPath(q)) return deezer ? deezer(init) : Response.json({ ok: true, songs: parseDeezer(raw(q, 'deezer')) })
    throw new Error(`unexpected fetch ${url}`)
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('searchSongs', () => {
  it('fetches iTunes directly and Deezer through the server, then merges', async () => {
    const fetchSpy = stubFetch('move bitch ludacris')
    const results = await searchSongs('  Move   Bitch LUDACRIS ')
    // The censored iTunes title is upgraded by its Deezer twin.
    expect(results[0]).toMatchObject({ title: 'Move Bitch', artist: 'Ludacris', explicit: true, source: 'both' })
    expect(results.length).toBeLessThanOrEqual(8)
    for (const song of results) expect(song).not.toHaveProperty('rank')
    expect(fetchSpy.mock.calls.map(([url]) => url).sort()).toEqual([deezerPath('move bitch ludacris'), itunesUrl('move bitch ludacris')].sort())
    const [, itunesInit] = fetchSpy.mock.calls.find(([url]) => url === itunesUrl('move bitch ludacris'))
    expect(itunesInit.signal).toBeInstanceOf(AbortSignal)
  })

  it('iTunes 429 → Deezer list', async () => {
    stubFetch('fuck you ceelo', { itunes: () => new Response('', { status: 429 }) })
    const results = await searchSongs('fuck you ceelo')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((s) => s.source === 'deezer')).toBe(true)
    expect(results[0]).toMatchObject({ title: 'Fuck You', artist: 'CeeLo Green', explicit: true })
  })

  it('iTunes empty or garbled body → Deezer list', async () => {
    for (const itunes of [() => new Response(''), () => new Response('{"results":')]) {
      stubFetch('fuck you ceelo', { itunes })
      const results = await searchSongs('fuck you ceelo')
      expect(results.every((s) => s.source === 'deezer')).toBe(true)
    }
  })

  it('Deezer 502 → iTunes base', async () => {
    stubFetch('fuck you ceelo', { deezer: () => Response.json(UNAVAILABLE, { status: 502 }) })
    const results = await searchSongs('fuck you ceelo')
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((s) => s.source === 'itunes')).toBe(true)
    expect(results[0]).toMatchObject({ artist: 'CeeLo Green', title: 'Forget You' })
  })

  it('both fail → the search error the page already shows', async () => {
    stubFetch('fuck you ceelo', {
      itunes: () => new Response('', { status: 429 }),
      deezer: () => Response.json(UNAVAILABLE, { status: 502 }),
    })
    const err = await searchSongs('fuck you ceelo').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 502, code: 'search_unavailable' })
    expect(searchErrorMessage(err)).toBe('Search is having trouble — type the song instead.')
  })

  it('an aborted signal → AbortError', async () => {
    const controller = new AbortController()
    const hang = (init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
    stubFetch('mr brightside', { itunes: hang, deezer: hang })
    const pending = searchSongs('mr brightside', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

    // Already aborted before the call.
    await expect(searchSongs('mr brightside', { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' })
  })
})
