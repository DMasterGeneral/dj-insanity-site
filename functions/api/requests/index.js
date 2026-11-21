import { json, error, invalid, randomId, readJson, clientIp, ipHash, verifyTurnstile } from '../../_lib/guard.js';
import { fromEnv, serverTimestamp } from '../../_lib/firestore.js';
import { fromEnv as stripeFromEnv } from '../../_lib/stripe.js';
import { readSettings } from '../../_lib/settings.js';
import { hit, LIMITS } from '../../_lib/ratelimit.js';
import { validateSongRequest } from '../../../shared/contracts.js';

// Tags these sessions in Stripe's metrics (Checkout Sessions `integration_identifier`).
export const INTEGRATION_ID = 'dj_insanity_tips_qhvmtwze';
// Stripe's minimum session lifetime is 30 min; an abandoned tip request just expires.
const SESSION_TTL_SEC = 31 * 60;
const TIPS_UNAVAILABLE = "Tips aren't available right now. Send your request without a tip.";

/**
 * POST /api/requests: create a song request.
 * Without a tip the doc is written as 'pending' and reaches the DJ at once. With a tip (only when
 * settings.tipsEnabled and both Stripe secrets are set) a Checkout Session is created first, the doc
 * is written as 'awaiting_payment', and the response carries the session's clientSecret; the
 * webhook (or the thanks page's poll) moves it to 'pending' once Stripe says it is paid.
 * @param {{ request: Request, env: Record<string, string|undefined> }} context
 */
export async function onRequestPost({ request, env }) {
  const fs = fromEnv(env);
  if (!fs) return error(503, 'not_configured', "Requests aren't available right now.");

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const v = validateSongRequest(body.data);
  if (!v.ok) return invalid(v.errors);
  const input = v.value;

  const ip = clientIp(request);
  const bot = await verifyTurnstile(env, input.turnstileToken, ip);
  if (!bot.ok) return error(403, 'bot_check_failed', "We couldn't confirm you're not a bot. Please reload the page and try again.");

  try {
    const settings = await readSettings(fs);
    if (!settings.requestsOpen) return error(409, 'requests_closed', 'Requests are closed right now.');
    const stripe = settings.tipsEnabled && env.STRIPE_WEBHOOK_SECRET ? stripeFromEnv(env) : null;
    if (input.tipCents > 0 && !stripe) return error(503, 'tips_unavailable', TIPS_UNAVAILABLE);

    const ipH = await ipHash(env, ip);
    const { limit, windowSec } = LIMITS.requests;
    const rate = await hit(fs, 'requests', ipH, limit, windowSec);
    if (!rate.allowed) return error(429, 'rate_limited', "You've sent a lot of requests. Please wait a few minutes and try again.");

    const id = randomId();
    const doc = {
      song: input.song,
      note: input.note,
      requesterName: input.requesterName,
      status: 'pending',
      tip: { amountCents: 0, state: 'none' },
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      // Salted hash, like the IP hash (guard.ipHash is a generic salted SHA-256).
      clientHash: await ipHash(env, `client:${input.clientId}`),
      ipHash: ipH,
    };
    if (input.tipCents === 0) {
      await fs.create('requests', id, doc);
      return json({ id, status: 'pending' }, 201, { 'Cache-Control': 'no-store' });
    }

    let session;
    try {
      session = await stripe.createCheckoutSession({
        ui_mode: 'elements',
        mode: 'payment',
        line_items: [
          { price_data: { currency: 'usd', product_data: { name: 'Tip for DJ Insanity' }, unit_amount: input.tipCents }, quantity: 1 },
        ],
        return_url: `${new URL(request.url).origin}/request/thanks?rid=${id}`,
        client_reference_id: id,
        metadata: { requestId: id },
        payment_intent_data: { metadata: { requestId: id } },
        expires_at: Math.floor(Date.now() / 1000) + SESSION_TTL_SEC,
        integration_identifier: INTEGRATION_ID,
      });
    } catch (err) {
      console.error('requests: checkout session create failed', err);
      return error(503, 'tips_unavailable', "We couldn't start the payment. Please try again, or send your request without a tip.");
    }
    try {
      await fs.create('requests', id, {
        ...doc,
        status: 'awaiting_payment',
        tip: { amountCents: input.tipCents, state: 'pending', checkoutSessionId: session.id },
      });
    } catch (err) {
      // Nothing points at the session now; close it so nobody can pay for a request that doesn't exist.
      await stripe.expireCheckoutSession(session.id).catch((e) => console.error('requests: expiring orphan session failed', e));
      throw err;
    }
    return json({ id, status: 'awaiting_payment', clientSecret: session.client_secret }, 201, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('requests: create failed', err);
    return error(503, 'unavailable', "Your request didn't go through. Please try again.");
  }
}
