import { json, error } from '../../_lib/guard.js';
import { fromEnv } from '../../_lib/firestore.js';
import { verifyWebhook } from '../../_lib/stripe.js';
import { ID_RE, settle } from '../../_lib/tips.js';

// The Checkout Session events the Stripe webhook endpoint is subscribed to (README: owner setup).
const HANDLED = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
]);

/**
 * POST /api/stripe/webhook: Stripe events for tip payments.
 * 400 for a bad signature; 500 when Firestore fails so Stripe retries; 200 for everything else,
 * including events this site does not handle and requests that no longer exist.
 * @param {{ request: Request, env: Record<string, string|undefined> }} context
 */
export async function onRequestPost({ request, env }) {
  const secret = env && env.STRIPE_WEBHOOK_SECRET;
  const fs = fromEnv(env);
  if (!secret || !fs) return error(503, 'not_configured', 'Webhooks are not configured.');

  const raw = await request.text();
  if (!(await verifyWebhook(raw, request.headers.get('Stripe-Signature'), secret))) {
    return error(400, 'bad_signature', 'Invalid signature.');
  }
  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return error(400, 'bad_json', 'The event is not valid JSON.');
  }

  const session = event && event.data && event.data.object;
  const rid = session && session.metadata && session.metadata.requestId;
  if (!HANDLED.has(event.type) || typeof rid !== 'string' || !ID_RE.test(rid)) return json({ ignored: true });

  try {
    const r = await settle(fs, rid, session, { paymentFailed: event.type === 'checkout.session.async_payment_failed' });
    if (r.result === 'missing') console.warn('stripe webhook: no request for event', event.id, rid);
    return json({ result: r.result });
  } catch (err) {
    console.error('stripe webhook: settle failed', event.id, err);
    return error(500, 'unavailable', 'Try again later.');
  }
}
