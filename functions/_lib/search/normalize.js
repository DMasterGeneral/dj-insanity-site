// Text helpers for search: query normalisation, accent folding, match keys and
// censored-word matching ("F**k" matches "Fuck": each * stands for one letter or digit).

import { JUNK_RE } from './junk.js';

/**
 * Trim, strip control characters, collapse whitespace, lower-case.
 * @param {unknown} q
 * @returns {string}
 */
export function normalizeQuery(q) {
  if (typeof q !== 'string') return '';
  return q
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const SPECIAL = { ß: 'ss', ø: 'o', æ: 'ae', œ: 'oe', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

/**
 * Lower-case ASCII-ish text: accents removed, apostrophes dropped, other punctuation a space.
 * `*` is kept (it marks a censored letter).
 * @param {string} s
 * @returns {string}
 */
export function fold(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[ßøæœłđðþı]/g, (c) => SPECIAL[/** @type {keyof typeof SPECIAL} */ (c)])
    .replace(/['’‘`´]/g, '')
    .replace(/[^a-z0-9*]+/g, ' ')
    .trim();
}

/**
 * Words of a string after folding.
 * @param {string} s
 * @returns {string[]}
 */
export function words(s) {
  const f = fold(s);
  return f ? f.split(' ') : [];
}

// Bracketed parts and " - ..." suffixes that do not make a different song for a DJ.
const NOISE_RE =
  /^(?:feat\b|ft\b|featuring\b|with\b|explicit\b|clean\b|edited\b|single\b|radio edit\b|radio version\b|album version\b|remaster(?:ed)?\b|\d{4} remaster(?:ed)?\b)/i;

/**
 * Remove noise from a title: "(feat. …)", "- Single", "Remaster(ed) YYYY", "Radio Edit",
 * "Explicit"/"Clean"/"Edited" tags, in (…), […] or after " - ". Other bracketed parts stay:
 * "[Broiler Remix]" or "(Live)" is a different track. A part that holds a junk marker
 * ("Karaoke Version") is always kept, so a karaoke row never matches the real song.
 * @param {string} title
 * @returns {string}
 */
export function cleanTitle(title) {
  /** @param {string} m @param {string} inner */
  const strip = (m, inner) => (!JUNK_RE.test(inner) && NOISE_RE.test(inner.trim()) ? ' ' : m);
  return title
    .replace(/\[([^\]]*)\]/g, strip)
    .replace(/\(([^)]*)\)/g, strip)
    .replace(/\s+-\s+([^-]+)$/, strip);
}

/**
 * First credited artist: "A feat. B", "A & B", "A, B", "A x B" → "A".
 * @param {string} artist
 * @returns {string}
 */
export function firstArtist(artist) {
  return artist.split(/\s*(?:,|&|\+|\bfeat\.?|\bft\.|\bfeaturing\b|\bwith\b|\sx\s)\s*/i)[0] || artist;
}

/**
 * @typedef {{ title: string, artist: string }} MatchKey
 */

/**
 * Match key: cleaned title words joined by single spaces, and the first artist with no spaces
 * ("Cee Lo" and "CeeLo" are the same artist).
 * @param {{ title: string, artist: string }} song
 * @returns {MatchKey}
 */
export function matchKey(song) {
  return {
    title: words(cleanTitle(song.title)).join(' '),
    artist: words(firstArtist(song.artist)).join(''),
  };
}

/**
 * Equal strings, where a `*` on either side stands for any single letter or digit.
 * @param {string} a
 * @param {string} b
 */
export function starEqual(a, b) {
  if (a === b) return true;
  if (a.length !== b.length || (!a.includes('*') && !b.includes('*'))) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if ((x === '*' && y !== ' ') || (y === '*' && x !== ' ')) continue;
    return false;
  }
  return true;
}

/**
 * @param {MatchKey} a
 * @param {MatchKey} b
 */
export function sameKey(a, b) {
  return !!a.title && starEqual(a.artist, b.artist) && starEqual(a.title, b.title);
}

/**
 * True when every word of the query appears among the song's title and artist words
 * (accent-folded; censored words match).
 * @param {string[]} queryWords
 * @param {{ title: string, artist: string }} song
 */
export function hasAllWords(queryWords, song) {
  const have = words(`${song.title} ${song.artist}`);
  const joinedArtist = words(song.artist).join('');
  return queryWords.every((w) => w === joinedArtist || have.some((h) => starEqual(w, h)));
}
