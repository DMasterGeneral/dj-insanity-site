// Record raw Deezer and iTunes search JSON for the search tests.
//   node scripts/record-search-fixtures.mjs               all default queries
//   node scripts/record-search-fixtures.mjs "some song"   just these
// Writes tests/fixtures/search/<slug>.deezer.json and <slug>.itunes.json. Uses the same URLs as
// functions/_lib/search so the fixtures match what the function sees.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { deezerUrl } from '../functions/_lib/search/deezer.js';
import { itunesUrl } from '../functions/_lib/search/itunes.js';
import { normalizeQuery } from '../functions/_lib/search/normalize.js';

export const QUERIES = [
  'mr brightside',
  'in da club',
  'smells like teen spirit',
  'shots',
  'electric slide',
  'titi me pregunto',
  'blinding lights',
  'move bitch ludacris',
  'fuck you ceelo',
  'tonight im fuckin you',
  'i dont fuck with you',
  'humble',
  'wap',
  'get low',
  'i wanna fuck you akon',
  'drake',
  'niggas in paris',
  'uptown funk',
  'cupid shuffle',
  'wobble',
  'dancing queen',
  'september earth wind fire',
  'sweet caroline',
  'party in the usa',
  'yeah usher',
  'lose yourself',
  'old town road',
  'bad and boujee',
  'shake it off',
  'careless whisper',
  'a thousand years',
];

const DIR = fileURLToPath(new URL('../tests/fixtures/search/', import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} q */
export function slug(q) {
  return q.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Fetch JSON, retrying a few times on an empty or garbled body or a Deezer quota reply.
 * @param {string} url
 */
async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const text = await res.text();
      const data = JSON.parse(text);
      if (data && data.error) throw new Error(`error reply ${JSON.stringify(data.error)}`);
      return data;
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  retry ${attempt} for ${url}: ${err.message}`);
      await sleep(1500 * attempt);
    }
  }
}

async function main() {
  const queries = process.argv.slice(2).length ? process.argv.slice(2) : QUERIES;
  await mkdir(DIR, { recursive: true });
  for (const raw of queries) {
    const q = normalizeQuery(raw);
    const name = slug(q);
    const [deezer, itunes] = await Promise.all([getJson(deezerUrl(q)), getJson(itunesUrl(q))]);
    await writeFile(`${DIR}${name}.deezer.json`, JSON.stringify(deezer, null, 1) + '\n');
    await writeFile(`${DIR}${name}.itunes.json`, JSON.stringify(itunes, null, 1) + '\n');
    console.log(`${name}: deezer ${deezer.data?.length ?? 0}, itunes ${itunes.results?.length ?? 0}`);
    await sleep(150);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
