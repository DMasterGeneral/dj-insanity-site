// "Junk" rows: karaoke, tributes, covers, kids' versions and the like. They are pushed below every
// real result, unless the visitor's query asked for that kind of thing ("piano version").

const PATTERNS = [
  /\bkaraoke\b/,
  /\btribute\b/,
  /\boriginally performed\b/,
  /\bmade famous\b/,
  /\bin the style of\b/,
  /\binstrumental\b/,
  /\blullab(?:y|ies)\b/,
  /\brockabye baby\b/,
  /\btwinkle twinkle\b/,
  /\bkidz bop\b/,
  /\bchipmunks?\b/,
  /\b8 ?bit\b/,
  /\bpiano version\b/,
  /\bcover(?:s|ed)?\b/,
  /\bworkout\b/,
  /\bsped up\b/,
  /\bslowed\b/,
  /\bnightcore\b/,
  /\btype beat\b/,
  /\bparody\b/,
];

/** Any junk marker, for raw (unfolded) text such as a bracketed part of a title. */
export const JUNK_RE = new RegExp(PATTERNS.map((p) => p.source).join('|').replace(/ /g, '[\\s-]'), 'i');

/** Folds the way normalize.fold does, without importing it (avoids a cycle). */
function simple(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/['’‘`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Build a junk test for one query: markers the query itself contains are not junk.
 * @param {string} query normalised query
 * @returns {(song: { title: string, artist: string, album?: string }) => boolean}
 */
export function junkFilter(query) {
  const q = simple(query);
  const active = PATTERNS.filter((p) => !p.test(q));
  return (song) => {
    const hay = simple(`${song.title} ${song.artist}`);
    return active.some((p) => p.test(hay));
  };
}
