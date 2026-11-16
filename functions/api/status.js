import { json } from '../_lib/guard.js';
import { fromEnv } from '../_lib/firestore.js';
import { readSettings, DEFAULT_SETTINGS } from '../_lib/settings.js';

const CACHE_CONTROL = 'public, max-age=15';

/**
 * GET /api/status: public site settings from settings/public, cached 15 s at the edge.
 * tipsEnabled is false unless Stripe is configured too.
 * @param {{ request: Request, env: Record<string, string|undefined>, waitUntil?: (p: Promise<unknown>) => void }} context
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = new Request(`${new URL(request.url).origin}/api/status`, { method: 'GET' });
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return hit;
    } catch (err) {
      console.error('status: cache read failed', err);
    }
  }

  let settings;
  try {
    settings = await readSettings(fromEnv(env));
  } catch (err) {
    console.error('status: reading settings failed', err);
    settings = { ...DEFAULT_SETTINGS };
  }
  settings.tipsEnabled = settings.tipsEnabled && !!(env && env.STRIPE_SECRET_KEY);

  const res = json(settings, 200, { 'Cache-Control': CACHE_CONTROL });
  if (cache) {
    const put = cache.put(cacheKey, res.clone()).catch((err) => console.error('status: cache write failed', err));
    if (context.waitUntil) context.waitUntil(put);
  }
  return res;
}
