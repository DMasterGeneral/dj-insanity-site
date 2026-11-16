// Deezer search: URL, response parsing and the fetch itself.
// Deezer has the explicit originals with real titles, an explicit flag and ISRCs, but misses some
// major originals. It replies 200 with { error: { code: 4 } } when its per-IP quota is used up.

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

/**
 * @param {string} q normalised query
 * @returns {string}
 */
export function deezerUrl(q) {
  return `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=15`;
}

/**
 * Map a Deezer search body to Song[] (plus Deezer's `rank` popularity score when present).
 * Throws when the body is an error reply or has no data list.
 * @param {any} body
 * @returns {(import('../../../shared/contracts.js').Song & { rank?: number })[]}
 */
export function parseDeezer(body) {
  if (!body || typeof body !== 'object') throw new Error('deezer: empty body');
  if (body.error) throw new Error(`deezer: error ${body.error.code ?? ''}`.trim());
  if (!Array.isArray(body.data)) throw new Error('deezer: no data');

  /** @type {import('../../../shared/contracts.js').Song[]} */
  const songs = [];
  for (const t of body.data) {
    if (!t || (t.type && t.type !== 'track')) continue;
    const title = typeof t.title === 'string' ? t.title.trim() : '';
    const artist = t.artist && typeof t.artist.name === 'string' ? t.artist.name.trim() : '';
    if (!title || !artist) continue;

    /** @type {import('../../../shared/contracts.js').Song} */
    const song = { title, artist, explicit: t.explicit_lyrics === true, source: 'deezer' };
    const album = t.album && typeof t.album.title === 'string' ? t.album.title.trim() : '';
    if (album) song.album = album;
    const art = t.album && t.album.cover_medium;
    if (typeof art === 'string' && art.startsWith('https://')) song.artworkUrl = art;
    if (Number.isInteger(t.duration) && t.duration > 0) song.durationSec = t.duration;
    if (Number.isInteger(t.id) && t.id > 0) song.deezerId = String(t.id);
    const isrc = typeof t.isrc === 'string' ? t.isrc.replace(/-/g, '').toUpperCase() : '';
    if (ISRC_RE.test(isrc)) song.isrc = isrc;
    // Deezer's popularity score; used by the merge, removed before results are returned.
    songs.push(Number.isFinite(t.rank) ? { ...song, rank: t.rank } : song);
  }
  return songs;
}

/**
 * Search Deezer. Rejects on network error, timeout, non-2xx, garbled body or quota reply.
 * @param {string} q normalised query
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function searchDeezer(q, { timeoutMs = 2500 } = {}) {
  const res = await fetch(deezerUrl(q), { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`deezer: HTTP ${res.status}`);
  return parseDeezer(JSON.parse(await res.text()));
}
