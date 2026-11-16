import { json, error, invalid, randomId, readJson, clientIp, ipHash, verifyTurnstile } from '../../_lib/guard.js';
import { fromEnv, serverTimestamp } from '../../_lib/firestore.js';
import { readSettings } from '../../_lib/settings.js';
import { hit, LIMITS } from '../../_lib/ratelimit.js';
import { validateSongRequest } from '../../../shared/contracts.js';

/**
 * POST /api/requests: create a song request (no-tip path; tips are not available yet).
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
    if (input.tipCents > 0) return error(503, 'tips_unavailable', "Tips aren't available right now. Send your request without a tip.");

    const ipH = await ipHash(env, ip);
    const { limit, windowSec } = LIMITS.requests;
    const rate = await hit(fs, 'requests', ipH, limit, windowSec);
    if (!rate.allowed) return error(429, 'rate_limited', "You've sent a lot of requests. Please wait a few minutes and try again.");

    const id = randomId();
    await fs.create('requests', id, {
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
    });
    return json({ id, status: 'pending' }, 201, { 'Cache-Control': 'no-store' });
  } catch (err) {
    console.error('requests: create failed', err);
    return error(503, 'unavailable', "Your request didn't go through. Please try again.");
  }
}
