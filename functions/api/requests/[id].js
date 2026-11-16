import { json, error } from '../../_lib/guard.js';
import { fromEnv } from '../../_lib/firestore.js';

const ID_RE = /^[A-Za-z0-9_-]{20,40}$/;

/**
 * GET /api/requests/:id: status of one request for the thank-you page.
 * Returns only { status, tipState }, never the song, note or name.
 * @param {{ params: { id?: string|string[] }, env: Record<string, string|undefined> }} context
 */
export async function onRequestGet({ params, env }) {
  const id = typeof params.id === 'string' ? params.id : '';
  const notFound = () => error(404, 'not_found', "We couldn't find that request.");
  if (!ID_RE.test(id)) return notFound();

  const fs = fromEnv(env);
  if (!fs) return error(503, 'not_configured', "Requests aren't available right now.");

  try {
    const doc = await fs.get(`requests/${id}`);
    if (!doc) return notFound();
    const tip = /** @type {{ state?: unknown }|null} */ (doc.tip);
    return json(
      {
        status: typeof doc.status === 'string' ? doc.status : 'pending',
        tipState: tip && typeof tip.state === 'string' ? tip.state : 'none',
      },
      200,
      { 'Cache-Control': 'no-store' },
    );
  } catch (err) {
    console.error('requests: status read failed', err);
    return error(503, 'unavailable', "We couldn't check that request right now.");
  }
}
