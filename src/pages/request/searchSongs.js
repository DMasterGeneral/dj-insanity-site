import { apiGet } from '../../lib/api.js';
import { normalizeQuery } from '../../../shared/search/normalize.js';
import { itunesUrl, parseItunes } from '../../../shared/search/itunes.js';
import { mergeResults } from '../../../shared/search/merge.js';

// Song search for the request page (plan section 4.1). iTunes is fetched from the guest's browser:
// it answers 429 to Cloudflare's shared server IPs but sends Access-Control-Allow-Origin: *.
// Deezer sends no CORS header, so it comes through /api/search/deezer. The merge runs here.

const ITUNES_TIMEOUT_MS = 4000;

/**
 * One signal that aborts when any of `signals` does.
 * @param {AbortSignal[]} signals
 * @returns {AbortSignal}
 */
function anySignal(signals) {
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      controller.abort(s.reason);
      break;
    }
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/**
 * iTunes, straight from the browser. Rejects on network error, timeout, non-2xx (429 included),
 * or an empty or garbled body.
 * @param {string} q normalised query
 * @param {AbortSignal} [signal]
 */
async function searchItunes(q, signal) {
  const timeout = AbortSignal.timeout(ITUNES_TIMEOUT_MS);
  const res = await fetch(itunesUrl(q), { signal: signal ? anySignal([signal, timeout]) : timeout });
  if (!res.ok) throw new Error(`itunes: HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error('itunes: empty body');
  return parseItunes(JSON.parse(text));
}

/**
 * Deezer's hits through our server, unmerged (with `rank`).
 * @param {string} q normalised query
 * @param {AbortSignal} [signal]
 */
async function searchDeezer(q, signal) {
  const d = await apiGet(`/api/search/deezer?q=${encodeURIComponent(q)}`, { signal });
  if (!Array.isArray(d.songs)) throw new Error('deezer: no songs');
  return d.songs;
}

/**
 * Search both providers and merge. When both fail, throws Deezer's error (an ApiError, which
 * searchErrorMessage turns into words). When `signal` aborts, rethrows the AbortError.
 * @param {string} query
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<import('../../../shared/contracts.js').Song[]>}
 */
export async function searchSongs(query, { signal } = {}) {
  const q = normalizeQuery(query);
  const [it, dz] = await Promise.allSettled([searchItunes(q, signal), searchDeezer(q, signal)]);
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
  const results = mergeResults(
    q,
    it.status === 'fulfilled' ? it.value : null,
    dz.status === 'fulfilled' ? dz.value : null,
  );
  if (!results) throw /** @type {PromiseRejectedResult} */ (dz).reason;
  return results;
}
