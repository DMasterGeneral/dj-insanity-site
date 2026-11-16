// iTunes search: URL and response parsing. The browser does the fetch (src/pages/request/searchSongs.js):
// iTunes answers 429 to Cloudflare's shared server IPs, and it sends Access-Control-Allow-Origin: *.
// iTunes has the originals Deezer misses, but only clean versions with censored titles ("F**k").
// It occasionally answers with an empty body.

/**
 * @param {string} q normalised query
 * @returns {string}
 */
export function itunesUrl(q) {
  return `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=15&country=US`;
}

/**
 * Map an iTunes search body to Song[]. Throws when the body has no results list.
 * @param {any} body
 * @returns {import('../contracts.js').Song[]}
 */
export function parseItunes(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.results)) throw new Error('itunes: no results');

  /** @type {import('../contracts.js').Song[]} */
  const songs = [];
  for (const t of body.results) {
    if (!t || t.kind !== 'song') continue;
    const title = typeof t.trackName === 'string' ? t.trackName.trim() : '';
    const artist = typeof t.artistName === 'string' ? t.artistName.trim() : '';
    if (!title || !artist) continue;

    /** @type {import('../contracts.js').Song} */
    const song = { title, artist, explicit: t.trackExplicitness === 'explicit', source: 'itunes' };
    const album = typeof t.collectionName === 'string' ? t.collectionName.trim() : '';
    if (album) song.album = album;
    if (typeof t.artworkUrl100 === 'string' && t.artworkUrl100.startsWith('https://')) song.artworkUrl = t.artworkUrl100;
    if (Number.isFinite(t.trackTimeMillis) && t.trackTimeMillis > 0) song.durationSec = Math.round(t.trackTimeMillis / 1000);
    if (Number.isInteger(t.trackId) && t.trackId > 0) song.itunesId = String(t.trackId);
    songs.push(song);
  }
  return songs;
}

