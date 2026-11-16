import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseDeezer, deezerUrl } from '../../functions/_lib/search/deezer.js'
import { parseItunes, itunesUrl } from '../../functions/_lib/search/itunes.js'
import { mergeResults, MAX_RESULTS } from '../../functions/_lib/search/merge.js'
import { normalizeQuery, matchKey, sameKey, starEqual, cleanTitle, fold } from '../../functions/_lib/search/normalize.js'
import { junkFilter } from '../../functions/_lib/search/junk.js'
import { onRequestGet as search } from '../../functions/api/search.js'
import { validateSongRequest } from '../../shared/contracts.js'
import { QUERIES, slug } from '../../scripts/record-search-fixtures.mjs'

const FIXTURES = new URL('../fixtures/search/', import.meta.url)
const raw = (q, provider) => JSON.parse(readFileSync(new URL(`${slug(q)}.${provider}.json`, FIXTURES), 'utf8'))
const providers = (q) => ({ itunes: parseItunes(raw(q, 'itunes')), deezer: parseDeezer(raw(q, 'deezer')) })
const merged = (q) => {
  const { itunes, deezer } = providers(q)
  return mergeResults(q, itunes, deezer)
}
const top = (q, n) => merged(q).slice(0, n)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('normalize', () => {
  it('normalises queries', () => {
    expect(normalizeQuery('  Mr\u0007  BrightSide \n')).toBe('mr brightside')
    expect(normalizeQuery(null)).toBe('')
  })

  it('folds accents and punctuation', () => {
    expect(fold('Tití Me Preguntó')).toBe('titi me pregunto')
    expect(fold("Tonight (I'm Fuckin' You)")).toBe('tonight im fuckin you')
    expect(fold('F**k You!')).toBe('f**k you')
  })

  it('matches a censored title to the real one', () => {
    expect(starEqual('f**k you', 'fuck you')).toBe(true)
    expect(starEqual('f**k you', 'fork you')).toBe(true)
    expect(starEqual('f**k you', 'fuck yo')).toBe(false)
    expect(sameKey(matchKey({ title: 'Move B***h (feat. Mystikal & I-20)', artist: 'Ludacris' }), matchKey({ title: 'Move Bitch', artist: 'Ludacris' }))).toBe(true)
    expect(sameKey(matchKey({ title: 'F**k You', artist: 'Cee Lo Green' }), matchKey({ title: 'Fuck You', artist: 'CeeLo Green' }))).toBe(true)
  })

  it('never strips a junk marker, so karaoke does not match the real song', () => {
    expect(cleanTitle('F**k You (Official Karaoke Version)')).toContain('Karaoke')
    expect(sameKey(matchKey({ title: 'F**k You (Official Karaoke Version)', artist: 'CeeLo Green' }), matchKey({ title: 'Fuck You', artist: 'CeeLo Green' }))).toBe(false)
  })

  it('strips feat., remaster, radio edit and explicit tags but keeps remixes', () => {
    const k = (title) => matchKey({ title, artist: 'X' }).title
    expect(k('Song (feat. Y) [Explicit]')).toBe('song')
    expect(k('Song - Remastered 2011')).toBe('song')
    expect(k('Song (Radio Edit)')).toBe('song')
    expect(k('Song - Single')).toBe('song')
    expect(k('Song (feat. Y) [Broiler Remix]')).toBe('song broiler remix')
  })

  it('junk markers in the query are not junk', () => {
    expect(junkFilter('uptown funk')({ title: 'Uptown Funk (Karaoke Version)', artist: 'X' })).toBe(true)
    expect(junkFilter('uptown funk karaoke')({ title: 'Uptown Funk (Karaoke Version)', artist: 'X' })).toBe(false)
    expect(junkFilter('a')({ title: 'Twinkle Twinkle', artist: 'Rockabye Baby!' })).toBe(true)
    expect(junkFilter('a')({ title: 'Discovery', artist: 'Daft Punk' })).toBe(false)
  })
})

describe('merge on recorded fixtures (acceptance list, plan 4.1)', () => {
  it('mr brightside → The Killers on top', () => {
    expect(top('mr brightside', 1)[0]).toMatchObject({ title: 'Mr. Brightside', artist: 'The Killers' })
  })

  it('in da club → 50 Cent on top', () => {
    expect(top('in da club', 1)[0].artist).toBe('50 Cent')
  })

  it('smells like teen spirit → Nirvana on top', () => {
    expect(top('smells like teen spirit', 1)[0].artist).toBe('Nirvana')
  })

  it('electric slide → top result is not an explicit rap track', () => {
    const [first] = top('electric slide', 1)
    expect(first.explicit).toBe(false)
    expect(first.title).toMatch(/electric slide/i)
  })

  it('titi me pregunto → Bad Bunny on top', () => {
    expect(top('titi me pregunto', 1)[0]).toMatchObject({ title: 'Tití Me Preguntó', artist: 'Bad Bunny', explicit: true })
  })

  it("blinding lights → The Weeknd's original within the top 2", () => {
    expect(top('blinding lights', 2).some((s) => s.title === 'Blinding Lights' && s.artist === 'The Weeknd')).toBe(true)
  })

  it('move bitch ludacris → "Move Bitch" uncensored, explicit, on top', () => {
    expect(top('move bitch ludacris', 1)[0]).toMatchObject({ title: 'Move Bitch', artist: 'Ludacris', explicit: true, source: 'both' })
  })

  it("fuck you ceelo → CeeLo Green's song within the top 2, never the karaoke version", () => {
    const results = merged('fuck you ceelo')
    expect(results.slice(0, 2).some((s) => s.artist === 'CeeLo Green' && s.title === 'Fuck You')).toBe(true)
    expect(results.some((s) => /karaoke/i.test(s.title))).toBe(false)
  })

  it('explicit originals come back uncensored and flagged', () => {
    const cases = [
      ['tonight im fuckin you', "Tonight (I'm Fuckin' You)", 'Enrique Iglesias'],
      ['i dont fuck with you', "I Don't Fuck With You", 'Big Sean'],
      ['humble', 'HUMBLE.', 'Kendrick Lamar'],
      ['wap', 'WAP (feat. Megan Thee Stallion)', 'Cardi B'],
      ['bad and boujee', 'Bad and Boujee (feat. Lil Uzi Vert)', 'Migos'],
      ['lose yourself', 'Lose Yourself', 'Eminem'],
    ]
    for (const [q, title, artist] of cases) {
      expect(top(q, 1)[0], q).toMatchObject({ title, artist, explicit: true })
    }
  })

  it('party and wedding staples keep the original on top', () => {
    const cases = [
      ['uptown funk', 'Mark Ronson'],
      ['cupid shuffle', 'Cupid'],
      ['dancing queen', 'ABBA'],
      ['september earth wind fire', 'Earth, Wind & Fire'],
      ['sweet caroline', 'Neil Diamond'],
      ['party in the usa', 'Miley Cyrus'],
      ['yeah usher', 'USHER'],
      ['old town road', 'Lil Nas X'],
      ['shake it off', 'Taylor Swift'],
      ['careless whisper', 'George Michael'],
      ['a thousand years', 'Christina Perri'],
      ['drake', 'Drake'],
    ]
    for (const [q, artist] of cases) expect(top(q, 1)[0].artist, q).toBe(artist)
  })

  describe.each(QUERIES)('%s', (q) => {
    const { deezer } = providers(q)
    const results = merged(q)
    const isJunk = junkFilter(q)

    it('returns 1-8 valid songs', () => {
      expect(results.length).toBeGreaterThan(0)
      expect(results.length).toBeLessThanOrEqual(MAX_RESULTS)
      for (const song of results) {
        const v = validateSongRequest({ song, clientId: 'test-client-1' })
        expect(v.ok, `${song.title}: ${JSON.stringify(v.errors)}`).toBe(true)
        expect(v.value.song).toEqual(song)
        expect(song.artworkUrl).toMatch(/^https:\/\//)
        expect(['itunes', 'deezer', 'both']).toContain(song.source)
        expect(song).not.toHaveProperty('rank')
      }
    })

    it('leaves no * in a title when Deezer had the uncensored match', () => {
      for (const song of results.filter((s) => s.title.includes('*'))) {
        const real = deezer.find((d) => !isJunk(d) && !d.title.includes('*') && sameKey(matchKey(d), matchKey(song)))
        expect(real, `${song.title} — ${song.artist}`).toBeUndefined()
      }
    })

    it('puts no junk row above a real one', () => {
      const flags = results.map(isJunk)
      expect(flags.indexOf(true) === -1 || !flags.slice(flags.indexOf(true)).includes(false)).toBe(true)
    })
  })
})

describe('merge: Deezer upgrade when a clean twin comes first', () => {
  it('any explicit match makes the row explicit, and its IDs beat the clean twin', () => {
    const itunes = [{ title: 'Move B***h', artist: 'Ludacris', explicit: false, source: 'itunes', itunesId: '1' }]
    const deezer = [
      { title: 'Move B***h', artist: 'Ludacris', explicit: false, source: 'deezer', deezerId: '10', isrc: 'USAAA0000001' },
      { title: 'Move Bitch', artist: 'Ludacris', explicit: true, source: 'deezer', deezerId: '20', isrc: 'USAAA0000002' },
      { title: 'Move Bitch', artist: 'Ludacris', explicit: false, source: 'deezer', deezerId: '30', isrc: 'USAAA0000003' },
    ]
    expect(mergeResults('move bitch', itunes, deezer)).toEqual([
      { title: 'Move Bitch', artist: 'Ludacris', explicit: true, source: 'both', itunesId: '1', deezerId: '20', isrc: 'USAAA0000002' },
    ])
  })
})

describe('merge fallbacks', () => {
  const { itunes, deezer } = providers('fuck you ceelo')

  it('only iTunes → the iTunes base as is (junk last, no Deezer rows)', () => {
    const r = mergeResults('fuck you ceelo', itunes, null)
    expect(r.length).toBeLessThanOrEqual(8)
    expect(r.every((s) => s.source === 'itunes')).toBe(true)
    expect(r[0]).toMatchObject({ artist: 'CeeLo Green', title: 'Forget You' })
  })

  it('only Deezer (iTunes failed or empty) → Deezer non-junk list', () => {
    for (const it of [null, []]) {
      const r = mergeResults('fuck you ceelo', it, deezer)
      expect(r.length).toBeGreaterThan(0)
      expect(r.length).toBeLessThanOrEqual(8)
      expect(r.every((s) => s.source === 'deezer')).toBe(true)
      expect(r.some((s) => /karaoke/i.test(s.title))).toBe(false)
      expect(r[0]).toMatchObject({ title: 'Fuck You', artist: 'CeeLo Green', explicit: true })
    }
  })

  it('neither → null; iTunes empty and Deezer failed → empty list', () => {
    expect(mergeResults('x y', null, null)).toBeNull()
    expect(mergeResults('x y', [], null)).toEqual([])
  })
})

describe('providers', () => {
  it('treats Deezer quota replies and missing data as failures', () => {
    expect(() => parseDeezer({ error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } })).toThrow(/4/)
    expect(() => parseDeezer({})).toThrow()
    expect(() => parseDeezer(null)).toThrow()
  })

  it('treats a garbled iTunes body as a failure', () => {
    expect(() => parseItunes({})).toThrow()
    expect(() => parseItunes('nope')).toThrow()
  })

  it('maps fields into Song', () => {
    const [dz] = parseDeezer(raw('move bitch ludacris', 'deezer'))
    expect(dz).toMatchObject({ title: 'Move Bitch', artist: 'Ludacris', explicit: true, deezerId: '2534222', isrc: 'USDJ20110894', durationSec: 270, source: 'deezer' })
    const [it] = parseItunes(raw('move bitch ludacris', 'itunes'))
    expect(it).toMatchObject({ artist: 'Ludacris', explicit: false, itunesId: '1452863856', durationSec: 251, source: 'itunes' })
    expect(it.title).toContain('*')
  })
})

describe('GET /api/search', () => {
  const ctx = (q, extra = {}) => ({ request: new Request(`https://site.test/api/search?q=${encodeURIComponent(q)}`), ...extra })

  /** Serve fixtures for one query; `deezer` / `itunes` override a provider's reply. */
  function stubProviders(q, { deezer, itunes } = {}) {
    const fetchSpy = vi.fn(async (url) => {
      if (url === deezerUrl(q)) return deezer ? deezer() : Response.json(raw(q, 'deezer'))
      if (url === itunesUrl(q)) return itunes ? itunes() : Response.json(raw(q, 'itunes'))
      throw new Error(`unexpected fetch ${url}`)
    })
    vi.stubGlobal('fetch', fetchSpy)
    return fetchSpy
  }

  it('returns merged results with a 5 minute browser cache', async () => {
    const fetchSpy = stubProviders('move bitch ludacris')
    const res = await search(ctx('  Move   Bitch LUDACRIS '))
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.results[0]).toMatchObject({ title: 'Move Bitch', explicit: true })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    for (const [, init] of fetchSpy.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('rejects queries under 2 or over 80 characters', async () => {
    const fetchSpy = stubProviders('x')
    for (const q of ['', ' a ', 'x'.repeat(81)]) {
      const res = await search(ctx(q))
      expect(res.status).toBe(400)
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to iTunes when Deezer hits its quota', async () => {
    stubProviders('fuck you ceelo', { deezer: () => Response.json({ error: { code: 4, message: 'Quota limit exceeded' } }) })
    const body = await (await search(ctx('fuck you ceelo'))).json()
    expect(body.results.every((s) => s.source === 'itunes')).toBe(true)
  })

  it('falls back to Deezer when iTunes sends an empty body', async () => {
    stubProviders('fuck you ceelo', { itunes: () => new Response('') })
    const body = await (await search(ctx('fuck you ceelo'))).json()
    expect(body.results.every((s) => s.source === 'deezer')).toBe(true)
  })

  it('answers 502 search_unavailable when both fail', async () => {
    stubProviders('fuck you ceelo', {
      itunes: () => { throw new TypeError('network') },
      deezer: () => new Response('oops', { status: 500 }),
    })
    const res = await search(ctx('fuck you ceelo'))
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'search_unavailable', message: 'Search is having trouble — type the song instead.' },
    })
  })

  it('serves repeat queries from the edge cache, keyed by the normalised query', async () => {
    const store = new Map()
    vi.stubGlobal('caches', {
      default: {
        match: async (req) => store.get(req.url)?.clone(),
        put: async (req, res) => { store.set(req.url, res) },
      },
    })
    const fetchSpy = stubProviders('mr brightside')
    const waits = []
    await search(ctx('mr brightside', { waitUntil: (p) => waits.push(p) }))
    await Promise.all(waits)
    expect(store.size).toBe(1)
    expect(store.get('https://site.test/api/search?q=mr%20brightside').headers.get('Cache-Control')).toBe('public, max-age=21600')

    const res = await search(ctx('MR  Brightside'))
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
    expect((await res.json()).results[0].artist).toBe('The Killers')
  })

  it('does not cache a result missing a provider', async () => {
    const store = new Map()
    vi.stubGlobal('caches', { default: { match: async () => undefined, put: async (req, res) => { store.set(req.url, res) } } })
    stubProviders('mr brightside', { deezer: () => new Response('', { status: 503 }) })
    expect((await search(ctx('mr brightside', { waitUntil: () => {} }))).status).toBe(200)
    expect(store.size).toBe(0)
  })
})
