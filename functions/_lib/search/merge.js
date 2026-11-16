// Merge iTunes and Deezer results into one list for a DJ (plan section 4.1, steps 4-9).
// iTunes is the base and keeps its order; Deezer only upgrades rows iTunes already has
// (real title, explicit flag, IDs) and may fill a single gap.

import { junkFilter } from './junk.js';
import { matchKey, sameKey, words, hasAllWords } from './normalize.js';

export const MAX_RESULTS = 8;
const DOMINANT_RANK = 500000;
const DOMINANT_RATIO = 1.5;

/** @typedef {import('../../../shared/contracts.js').Song} Song */

/**
 * Drop rows whose match key equals an earlier row's. When the dropped row has an uncensored title
 * or is explicit, the kept row takes that over (clean and explicit versions are one row).
 * @param {Song[]} songs
 * @returns {{ song: Song, key: import('./normalize.js').MatchKey }[]}
 */
function collapse(songs) {
  /** @type {{ song: Song, key: import('./normalize.js').MatchKey }[]} */
  const rows = [];
  for (const s of songs) {
    const key = matchKey(s);
    const kept = rows.find((r) => sameKey(r.key, key));
    if (!kept) {
      rows.push({ song: { ...s }, key });
      continue;
    }
    if (kept.song.title.includes('*') && !s.title.includes('*')) {
      kept.song.title = s.title;
      kept.key = key;
    }
    if (s.explicit) kept.song.explicit = true;
  }
  return rows;
}

/**
 * Move junk rows below the rest, keeping order within each group.
 * @template {{ song: Song }} T
 * @param {T[]} rows
 * @param {(s: Song) => boolean} isJunk
 * @returns {T[]}
 */
function junkLast(rows, isJunk) {
  return [...rows.filter((r) => !isJunk(r.song)), ...rows.filter((r) => isJunk(r.song))];
}

/**
 * Merge the two providers' results.
 * @param {string} query   normalised query
 * @param {Song[]|null} itunes  null when iTunes failed
 * @param {Song[]|null} deezer  null when Deezer failed
 * @returns {Song[]|null}  null when both failed
 */
export function mergeResults(query, itunes, deezer) {
  if (!itunes && !deezer) return null;
  const isJunk = junkFilter(query);

  // Fallback: no iTunes results → Deezer's non-junk list.
  if (!itunes || itunes.length === 0) {
    if (!deezer) return [];
    return collapse(deezer.filter((s) => !isJunk(s)))
      .slice(0, MAX_RESULTS)
      .map(toSong);
  }

  const base = junkLast(collapse(itunes), isJunk);
  if (!deezer) return base.slice(0, MAX_RESULTS).map(toSong);

  const deezerRows = deezer.filter((s) => !isJunk(s)).map((song) => ({ song, key: matchKey(song) }));

  // Deezer job 1: upgrade rows iTunes already has. Any explicit match makes the row explicit; the
  // row takes its IDs from its first Deezer match, or from its first explicit match when there is
  // one (so a clean twin listed first does not win), and an uncensored title from any match.
  // Every Deezer hit is used, not just the top 8: a match needs the same artist and title, so a
  // lower hit is still the same song.
  /** @type {Map<object, boolean>} row → whether its IDs came from an explicit match */
  const idsFrom = new Map();
  for (const d of deezerRows) {
    const row = base.find((r) => sameKey(r.key, d.key));
    if (!row) continue;
    const s = row.song;
    if (s.title.includes('*') && !d.song.title.includes('*')) s.title = d.song.title;
    if (d.song.explicit) s.explicit = true;
    s.source = 'both';
    const had = idsFrom.get(row);
    if (had === true || (had === false && !d.song.explicit)) continue;
    idsFrom.set(row, d.song.explicit);
    if (d.song.deezerId) s.deezerId = d.song.deezerId;
    if (d.song.isrc) s.isrc = d.song.isrc;
  }

  // Deezer job 2: Deezer's first non-junk hit, when it is the obvious answer (see `dominant`),
  // goes to row 1: inserted if iTunes lacks it, moved up if iTunes has it lower down.
  // When iTunes's own top row is junk or lacks the query words, any such hit fills row 1.
  const first = deezerRows[0];
  const queryWords = words(query);
  if (first && hasAllWords(queryWords, first.song)) {
    const top = base[0];
    const topWeak = isJunk(top.song) || !hasAllWords(queryWords, top.song);
    const strong = dominant(deezerRows);
    const at = base.findIndex((r) => sameKey(r.key, first.key));
    if (at === -1 && (strong || topWeak)) base.unshift({ song: { ...first.song }, key: first.key });
    else if (at > 0 && strong) base.unshift(...base.splice(at, 1));
  }

  return base.slice(0, MAX_RESULTS).map(toSong);
}

/**
 * True when Deezer's first hit is far more popular than the rest: rank at least DOMINANT_RANK and
 * DOMINANT_RATIO times the next different song's rank. Covers and remixes that top Deezer's list
 * for a title ("In da Club" by Josh Vietti, Shaka Ponk's "Smells Like Teen Spirit") never are.
 * @param {{ song: Song & { rank?: number }, key: import('./normalize.js').MatchKey }[]} rows
 */
function dominant(rows) {
  const [first, ...rest] = rows;
  const rank = first.song.rank ?? 0;
  if (rank < DOMINANT_RANK) return false;
  const next = rest.find((r) => !sameKey(r.key, first.key));
  return !next || rank >= DOMINANT_RATIO * (next.song.rank ?? 0);
}

/**
 * Strip merge-only fields.
 * @param {{ song: Song & { rank?: number } }} row
 * @returns {Song}
 */
function toSong({ song }) {
  const { rank: _rank, ...rest } = song;
  return rest;
}
