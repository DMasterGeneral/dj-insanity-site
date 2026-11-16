// Tiny fetch wrapper for the site's own /api/* endpoints (plan section 3.5).
// Success: resolves with the parsed body `{ ok: true, ... }`.
// Failure: throws ApiError { status, code, message, fields }. `message` is always safe to show.
//   code 'network'      — no response (offline, DNS, connection dropped); status 0
//   code 'timeout'      — no response within 15 s; status 0
//   code 'bad_response' — the reply was not the JSON envelope
//   anything else       — the server's `error.code`, with its `error.message` and `error.fields`
// If the caller's own `signal` aborts, the native AbortError is rethrown untouched.

const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  /**
   * @param {{ status: number, code: string, message: string, fields?: Record<string, string> | null }} init
   */
  constructor({ status, code, message, fields = null }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const NETWORK_MESSAGE = 'Could not reach the server. Check your connection and try again.';
const TIMEOUT_MESSAGE = 'The server took too long to answer. Please try again.';
const BAD_RESPONSE_MESSAGE = 'The server sent an unexpected reply. Please try again.';

/**
 * @param {string} method
 * @param {string} path
 * @param {unknown} body
 * @param {{ signal?: AbortSignal }} [opts]
 */
async function request(method, path, body, { signal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    /** @type {Response} */
    let res;
    let raw;
    try {
      res = await fetch(path, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'same-origin',
      });
      raw = await res.text();
    } catch (e) {
      if (signal?.aborted) throw signal.reason ?? e;
      if (timedOut) throw new ApiError({ status: 0, code: 'timeout', message: TIMEOUT_MESSAGE });
      throw new ApiError({ status: 0, code: 'network', message: NETWORK_MESSAGE });
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new ApiError({ status: res.status, code: 'bad_response', message: BAD_RESPONSE_MESSAGE });
    }

    if (res.ok && data && data.ok === true) return data;
    const err = data && data.ok === false && data.error && typeof data.error === 'object' ? data.error : null;
    if (!err) throw new ApiError({ status: res.status, code: 'bad_response', message: BAD_RESPONSE_MESSAGE });
    throw new ApiError({
      status: res.status,
      code: typeof err.code === 'string' ? err.code : 'error',
      message: typeof err.message === 'string' && err.message ? err.message : BAD_RESPONSE_MESSAGE,
      fields: err.fields && typeof err.fields === 'object' ? err.fields : null,
    });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * GET a JSON endpoint.
 * @param {string} path  e.g. '/api/status'
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function apiGet(path, opts) {
  return request('GET', path, undefined, opts);
}

/**
 * POST a JSON body to an endpoint.
 * @param {string} path  e.g. '/api/bookings'
 * @param {unknown} body
 * @param {{ signal?: AbortSignal }} [opts]
 */
export function apiPost(path, body, opts) {
  return request('POST', path, body, opts);
}
