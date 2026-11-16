import { json, error } from '../../_lib/guard.js';
import { normalizeQuery } from '../../../shared/search/normalize.js';
import { searchDeezer } from '../../_lib/search/deezer.js';

const EDGE_TTL_SEC = 6 * 60 * 60;
const BROWSER_CACHE = 'public, max-age=300';
const QUOTA_RETRY_MS = 400;

/** Deezer's per-IP quota reply ({ error: { code: 4 } }), as parseDeezer reports it. */
const isQuota = (err) => err instanceof Error && err.message === 'deezer: error 4';

/**
 * GET /api/search/deezer?q= : Deezer's parsed hits, unmerged, `rank` kept (plan section 4.1).
 * The browser fetches iTunes itself (iTunes answers 429 to Cloudflare's shared IPs) and runs the
 * merge; Deezer sends no CORS header, so it stays here.
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
  const cacheKey = new Request(`${url.origin}/api/search/deezer?q=${encodeURIComponent(q)}`, { method: 'GET' });
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return json(await hit.json(), 200, { 'Cache-Control': BROWSER_CACHE });
    } catch (err) {
      console.error('search: cache read failed', err);
    }
  }

  let songs;
  try {
    try {
      songs = await searchDeezer(q);
    } catch (err) {
      if (!isQuota(err)) throw err;
      await new Promise((r) => setTimeout(r, QUOTA_RETRY_MS));
      songs = await searchDeezer(q);
    }
  } catch (err) {
    console.warn('search: deezer failed:', String(err));
    return error(502, 'search_unavailable', 'Search is having trouble — type the song instead.');
  }

  if (cache) {
    const stored = new Response(JSON.stringify({ songs }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${EDGE_TTL_SEC}` },
    });
    const put = cache.put(cacheKey, stored).catch((err) => console.error('search: cache write failed', err));
    if (context.waitUntil) context.waitUntil(put);
  }
  return json({ songs }, 200, { 'Cache-Control': BROWSER_CACHE });
}
