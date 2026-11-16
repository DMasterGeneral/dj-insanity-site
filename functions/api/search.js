import { json, error } from '../_lib/guard.js';
import { normalizeQuery } from '../_lib/search/normalize.js';
import { searchItunes } from '../_lib/search/itunes.js';
import { searchDeezer } from '../_lib/search/deezer.js';
import { mergeResults } from '../_lib/search/merge.js';

const EDGE_TTL_SEC = 6 * 60 * 60;
const BROWSER_CACHE = 'public, max-age=300';

/**
 * GET /api/search?q= : merged iTunes + Deezer song search (plan section 4.1).
 * @param {{ request: Request, waitUntil?: (p: Promise<unknown>) => void }} context
 */
export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const q = normalizeQuery(url.searchParams.get('q'));
  if (q.length < 2 || q.length > 80) {
    return error(400, 'invalid_query', 'Type between 2 and 80 characters to search.');
  }

  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = new Request(`${url.origin}/api/search?q=${encodeURIComponent(q)}`, { method: 'GET' });
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return json(await hit.json(), 200, { 'Cache-Control': BROWSER_CACHE });
    } catch (err) {
      console.error('search: cache read failed', err);
    }
  }

  const [it, dz] = await Promise.allSettled([searchItunes(q), searchDeezer(q)]);
  if (it.status === 'rejected') console.warn('search: itunes failed:', String(it.reason));
  if (dz.status === 'rejected') console.warn('search: deezer failed:', String(dz.reason));
  const results = mergeResults(
    q,
    it.status === 'fulfilled' ? it.value : null,
    dz.status === 'fulfilled' ? dz.value : null,
  );
  // Which provider answered, for diagnosing from outside (no secrets in here).
  const status = (r) => (r.status === 'fulfilled' ? 'ok' : String(r.reason).slice(0, 60).replace(/[^\x20-\x7e]/g, '?'));
  const providers = { 'X-Search-Providers': `itunes=${status(it)}; deezer=${status(dz)}` };
  if (!results) {
    const res = error(502, 'search_unavailable', 'Search is having trouble — type the song instead.');
    res.headers.set('X-Search-Providers', providers['X-Search-Providers']);
    return res;
  }

  // Only cache a full answer: a result missing one provider should not stick for 6 hours.
  if (cache && it.status === 'fulfilled' && dz.status === 'fulfilled') {
    const stored = new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${EDGE_TTL_SEC}` },
    });
    const put = cache.put(cacheKey, stored).catch((err) => console.error('search: cache write failed', err));
    if (context.waitUntil) context.waitUntil(put);
  }
  return json({ results }, 200, { 'Cache-Control': BROWSER_CACHE, ...providers });
}
