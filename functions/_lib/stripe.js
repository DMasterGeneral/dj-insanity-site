// Small Stripe REST client for Pages Functions (no SDK): Checkout Sessions create / retrieve /
// expire, and webhook signature checks with WebCrypto. Same style as firestore.js.
// STRIPE_SECRET_KEY holds a restricted test key (rk_test_…) with Checkout Sessions: Write.

const API = 'https://api.stripe.com/v1';
export const STRIPE_VERSION = '2026-10-28.endive';
// Deadline for each call to Stripe, so a stalled upstream cannot hang a visitor's request.
const FETCH_TIMEOUT_MS = 8_000;
/** How long a signed webhook stays acceptable (Stripe's libraries use 300 s). */
export const WEBHOOK_TOLERANCE_SEC = 300;

/** Error from Stripe, with the HTTP status and Stripe's error type and code. */
export class StripeError extends Error {
  /**
   * @param {string} message
   * @param {number} status   HTTP status (0 for a network failure or timeout)
   * @param {string} [type]   e.g. 'invalid_request_error', 'api_error'
   * @param {string} [code]   e.g. 'resource_missing'
   */
  constructor(message, status, type = 'api_error', code = '') {
    super(message);
    this.name = 'StripeError';
    this.status = status;
    this.type = type;
    this.code = code;
  }
}

/**
 * Encode params the way Stripe expects: nested objects and arrays in bracket form,
 * e.g. { line_items: [{ price_data: { currency: 'usd' } }] } → line_items[0][price_data][currency]=usd.
 * null and undefined values are left out.
 * @param {Record<string, unknown>} params
 * @returns {string}
 */
export function encodeForm(params) {
  const pairs = new URLSearchParams();
  /** @param {string} key @param {unknown} v */
  const add = (key, v) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) v.forEach((item, i) => add(`${key}[${i}]`, item));
    else if (typeof v === 'object') for (const [k, inner] of Object.entries(v)) add(`${key}[${k}]`, inner);
    else pairs.append(key, String(v));
  };
  for (const [k, v] of Object.entries(params)) add(k, v);
  return pairs.toString();
}

/**
 * @typedef {Object} StripeClient
 * @property {(params: Record<string, unknown>) => Promise<any>} createCheckoutSession
 * @property {(id: string) => Promise<any>} retrieveCheckoutSession
 * @property {(id: string) => Promise<any>} expireCheckoutSession
 */

/**
 * @param {string} secretKey
 * @returns {StripeClient}
 */
export function createClient(secretKey) {
  /**
   * @param {'GET'|'POST'} method
   * @param {string} path
   * @param {Record<string, unknown>} [params]
   */
  async function call(method, path, params) {
    let res;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Stripe-Version': STRIPE_VERSION,
          ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: params ? encodeForm(params) : undefined,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw new StripeError(`Stripe request failed: ${err instanceof Error ? err.message : err}`, 0);
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      const e = (data && data.error) || {};
      throw new StripeError(e.message || `Stripe HTTP ${res.status}`, res.ok ? 0 : res.status, e.type, e.code);
    }
    return data;
  }

  /** @param {string} id */
  const sessionPath = (id) => `/checkout/sessions/${encodeURIComponent(id)}`;

  return {
    createCheckoutSession: (params) => call('POST', '/checkout/sessions', params),
    retrieveCheckoutSession: (id) => call('GET', sessionPath(id)),
    expireCheckoutSession: (id) => call('POST', `${sessionPath(id)}/expire`, {}),
  };
}

/**
 * Client for env.STRIPE_SECRET_KEY, or null when it is not set.
 * @param {{ STRIPE_SECRET_KEY?: string }} env
 * @returns {StripeClient|null}
 */
export function fromEnv(env) {
  const key = env && env.STRIPE_SECRET_KEY;
  return key ? createClient(key) : null;
}

// ---------------------------------------------------------------- webhooks

/** @param {ArrayBuffer} buf */
const toHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** Compare two strings without stopping at the first difference. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Check a Stripe-Signature header: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">[,v1=…]`.
 * True only when the timestamp is within `tolerance` seconds of now and any v1 matches.
 * @param {string} rawBody     the request body exactly as received
 * @param {string|null} header the Stripe-Signature header
 * @param {string} secret      the endpoint's signing secret (whsec_…)
 * @param {number} [nowSec]
 * @param {number} [tolerance]
 * @returns {Promise<boolean>}
 */
export async function verifyWebhook(rawBody, header, secret, nowSec = Math.floor(Date.now() / 1000), tolerance = WEBHOOK_TOLERANCE_SEC) {
  if (!header || !secret) return false;
  let t = null;
  /** @type {string[]} */
  const v1 = [];
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === 't' && /^\d+$/.test(v)) t = Number(v);
    else if (k === 'v1' && v) v1.push(v);
  }
  if (t === null || !v1.length || Math.abs(nowSec - t) > tolerance) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expected = toHex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${rawBody}`)));
  return v1.some((sig) => safeEqual(sig, expected));
}
