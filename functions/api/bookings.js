import { json, error, invalid, randomId, readJson, clientIp, ipHash, verifyTurnstile } from '../_lib/guard.js';
import { fromEnv, serverTimestamp } from '../_lib/firestore.js';
import { hit, LIMITS } from '../_lib/ratelimit.js';
import { notifyBooking } from '../_lib/notify.js';
import { validateBooking } from '../../shared/contracts.js';

/**
 * Yesterday's UTC date as YYYY-MM-DD: visitors in US time zones are never told their date is past.
 * @param {number} [now]
 */
export function bookingToday(now = Date.now()) {
  return new Date(now - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * POST /api/bookings: save a booking request, then notify the DJ in the background.
 * @param {{ request: Request, env: Record<string, string|undefined>, waitUntil: (p: Promise<unknown>) => void }} context
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const fs = fromEnv(env);
  if (!fs) return error(503, 'not_configured', "Booking requests aren't available right now. Please call or email instead.");

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const v = validateBooking(body.data, { today: bookingToday() });
  if (!v.ok) return invalid(v.errors);
  const booking = v.value;

  const ip = clientIp(request);
  const bot = await verifyTurnstile(env, body.data.turnstileToken, ip);
  if (!bot.ok) return error(403, 'bot_check_failed', "We couldn't confirm you're not a bot. Please reload the page and try again.");

  const id = randomId();
  try {
    const ipH = await ipHash(env, ip);
    const { limit, windowSec } = LIMITS.bookings;
    const rate = await hit(fs, 'bookings', ipH, limit, windowSec);
    if (!rate.allowed) return error(429, 'rate_limited', "You've sent a few booking requests already. Please try again in an hour, or call instead.");

    await fs.create('bookings', id, {
      ...booking,
      status: 'new',
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
      ipHash: ipH,
    });
  } catch (err) {
    console.error('bookings: create failed', err);
    return error(503, 'unavailable', "Your booking request didn't go through. Please try again.");
  }

  const origin = new URL(request.url).origin;
  context.waitUntil(
    (async () => {
      let notifyError = null;
      try {
        const r = await notifyBooking(env, booking, { id, origin });
        if (r.error) notifyError = r.error;
      } catch (err) {
        notifyError = String(err instanceof Error ? err.message : err);
      }
      if (!notifyError) return;
      console.error(`bookings: notification failed for ${id}: ${notifyError}`);
      try {
        await fs.patch(`bookings/${id}`, { notifyError: notifyError.slice(0, 300) });
      } catch (err) {
        console.error('bookings: could not record notifyError', err);
      }
    })(),
  );

  return json({ id }, 201, { 'Cache-Control': 'no-store' });
}
