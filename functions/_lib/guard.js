// Shared helpers for functions/api/*: JSON responses, safe body parsing, IP hashing, Turnstile.
// Response envelope (plan section 3.5): { ok: true, ...data } or { ok: false, error: { code, message } }.

const JSON_TYPE = 'application/json; charset=utf-8';
const DEV_HASH_SALT = 'dj-insanity-dev-salt';
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * A success response.
 * @param {Record<string, unknown>} [data]
 * @param {number} [status]
 * @param {HeadersInit} [headers]
 * @returns {Response}
 */
export function json(data = {}, status = 200, headers = {}) {
  const h = new Headers(headers);
  h.set('Content-Type', JSON_TYPE);
  return new Response(JSON.stringify({ ok: true, ...data }), { status, headers: h });
}

/**
 * An error response.
 * @param {number} status
 * @param {string} code     short machine-readable code, e.g. 'not_found'
 * @param {string} message  plain-English message safe to show a visitor
 * @returns {Response}
 */
export function error(status, code, message) {
  return new Response(JSON.stringify({ ok: false, error: { code, message } }), {
    status,
    headers: { 'Content-Type': JSON_TYPE },
  });
}

/**
 * Read a JSON object body, refusing the wrong content type, oversized bodies and non-objects.
 * @param {Request} request
 * @param {number} [maxBytes]
 * @returns {Promise<{ ok: true, data: Record<string, unknown> } | { ok: false, response: Response }>}
 */
export async function readJson(request, maxBytes = 16384) {
  const type = (request.headers.get('Content-Type') || '').toLowerCase();
  if (!type.startsWith('application/json')) {
    return { ok: false, response: error(415, 'unsupported_media_type', 'Send the request as JSON.') };
  }
  const tooLarge = () => ({ ok: false, response: error(413, 'payload_too_large', 'The request is too large.') });
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();

  /** @type {Uint8Array[]} */
  const chunks = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        return tooLarge();
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return { ok: false, response: error(400, 'bad_json', 'The request body is not valid JSON.') };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return { ok: false, response: error(400, 'bad_json', 'The request body must be a JSON object.') };
  }
  return { ok: true, data };
}

/**
 * The visitor's IP as Cloudflare reports it ('' when absent, e.g. in unit tests).
 * @param {Request} request
 * @returns {string}
 */
export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || '';
}

/**
 * Hex SHA-256 of a UTF-8 string.
 * @param {string} str
 * @returns {Promise<string>}
 */
export async function sha256Hex(str) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Salted hash of an IP, for rate limits only. Uses env.HASH_SALT, or a fixed dev salt when unset.
 * @param {{ HASH_SALT?: string }} env
 * @param {string} ip
 * @returns {Promise<string>}
 */
export function ipHash(env, ip) {
  const salt = (env && env.HASH_SALT) || DEV_HASH_SALT;
  return sha256Hex(`${salt}:${ip}`);
}

/**
 * Check a Turnstile token. Skipped (passes) when TURNSTILE_SECRET_KEY is not configured.
 * @param {{ TURNSTILE_SECRET_KEY?: string }} env
 * @param {unknown} token
 * @param {string} [ip]
 * @returns {Promise<{ ok: boolean, skipped?: true, codes?: string[] }>}
 */
export async function verifyTurnstile(env, token, ip) {
  const secret = env && env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, skipped: true };
  if (typeof token !== 'string' || !token) return { ok: false, codes: ['missing-input-response'] };

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    const data = await res.json();
    return { ok: data.success === true, codes: data['error-codes'] || [] };
  } catch {
    return { ok: false, codes: ['network-error'] };
  }
}
