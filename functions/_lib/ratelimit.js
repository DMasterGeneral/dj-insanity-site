// Fixed-window rate limits as Firestore counter docs: rate/{kind}_{ipHash}_{windowStart}.
// One commit upserts the doc with an increment on `count` and reads the new count back.
// `expiresAt` (window end + 1 day) is there for an optional Firestore TTL policy.

import { encodeValue } from './firestore.js';

export const LIMITS = Object.freeze({
  requests: { limit: 6, windowSec: 10 * 60 },
  bookings: { limit: 3, windowSec: 60 * 60 },
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Count one hit. If the counter cannot be written, the hit is allowed (guests are not blocked
 * because of a database hiccup) and the failure is logged.
 * @param {import('./firestore.js').FirestoreClient} fs
 * @param {string} kind       e.g. 'requests'
 * @param {string} ipHash
 * @param {number} limit      hits allowed per window
 * @param {number} windowSec
 * @param {number} [now]      ms since epoch
 * @returns {Promise<{ allowed: boolean, count: number }>}
 */
export async function hit(fs, kind, ipHash, limit, windowSec, now = Date.now()) {
  const windowStart = Math.floor(now / 1000 / windowSec) * windowSec;
  const path = `rate/${kind}_${ipHash}_${windowStart}`;
  try {
    const res = await fs.commit([
      {
        update: {
          name: fs.name(path),
          fields: { expiresAt: encodeValue(new Date((windowStart + windowSec) * 1000 + DAY_MS)) },
        },
        updateMask: { fieldPaths: ['expiresAt'] },
        updateTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }],
      },
    ]);
    const tr = res.writeResults?.[0]?.transformResults?.[0];
    const count = Number(tr?.integerValue);
    if (!Number.isFinite(count)) throw new Error('no count in transformResults');
    return { allowed: count <= limit, count };
  } catch (err) {
    console.error(`ratelimit: ${kind} counter failed, allowing`, err);
    return { allowed: true, count: 0 };
  }
}
