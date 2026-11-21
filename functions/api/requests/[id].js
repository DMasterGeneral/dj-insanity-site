import { json, error } from '../../_lib/guard.js';
import { fromEnv } from '../../_lib/firestore.js';
import { fromEnv as stripeFromEnv } from '../../_lib/stripe.js';
import { ID_RE, settle } from '../../_lib/tips.js';

/**
 * GET /api/requests/:id: status of one request for the thank-you page.
 * Returns only { status, tipState }, never the song, note or name.
 * While a tip is pending it also asks Stripe about the Checkout Session and settles it, so a paid
 * request reaches the DJ on the first poll even if the webhook is late or misconfigured. A Stripe
 * error or a write conflict is logged and the current state returned; the next poll tries again.
 * When that session is still open (not paid, e.g. a cancelled redirect) it adds `checkout: 'open'`.
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
    const tip = /** @type {{ state?: unknown, checkoutSessionId?: unknown }|null} */ (doc.tip);
    let state = {
      status: typeof doc.status === 'string' ? doc.status : 'pending',
      tipState: tip && typeof tip.state === 'string' ? tip.state : 'none',
    };

    const stripe = stripeFromEnv(env);
    if (stripe && state.status === 'awaiting_payment' && state.tipState === 'pending' && tip && typeof tip.checkoutSessionId === 'string') {
      try {
        const session = await stripe.retrieveCheckoutSession(tip.checkoutSessionId);
        const settled = await settle(fs, id, session);
        if (settled.result !== 'missing') state = { status: settled.status, tipState: settled.tipState };
        // Still open and unpaid: the guest left the payment (e.g. cancelled a redirect) without finishing.
        if (state.tipState === 'pending' && session.status === 'open') state = { ...state, checkout: 'open' };
      } catch (err) {
        console.error('requests: settle on read failed', err);
      }
    }
    return json(state, 200, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('requests: status read failed', err);
    return error(503, 'unavailable', "We couldn't check that request right now.");
  }
}
