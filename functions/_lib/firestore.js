// Firestore REST client for Pages Functions, signed in as a service account.
// Auth: an RS256 JWT signed with WebCrypto is exchanged for an OAuth access token, which is cached
// in module memory until about a minute before it expires. Runs in workers and in Node 24.

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/datastore';
const TOKEN_MARGIN_MS = 60_000;
// Deadline for each call to Google, so a stalled upstream cannot hang a visitor's request.
const FETCH_TIMEOUT_MS = 8_000;

/** Error from Firestore or the token endpoint, with the HTTP status and gRPC status string. */
export class FirestoreError extends Error {
  /**
   * @param {string} message
   * @param {number} status       HTTP status (0 for a network failure)
   * @param {string} [grpcStatus] e.g. 'NOT_FOUND', 'ALREADY_EXISTS', 'PERMISSION_DENIED'
   */
  constructor(message, status, grpcStatus = 'UNKNOWN') {
    super(message);
    this.name = 'FirestoreError';
    this.status = status;
    this.grpcStatus = grpcStatus;
  }
}

/** Put this in a value passed to create/patch to have Firestore set the server's time. */
export const serverTimestamp = Object.freeze({ __firestoreSentinel: 'serverTimestamp' });

/**
 * @typedef {Object} ServiceAccount
 * @property {string} project_id
 * @property {string} client_email
 * @property {string} private_key  PKCS8 PEM
 */

// ---------------------------------------------------------------- values

/**
 * Encode a JS value as a Firestore Value.
 * null/undefined → null, integer → integerValue, other number → doubleValue, Date → timestamp.
 * @param {unknown} v
 * @returns {Record<string, unknown>}
 */
export function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === 'object') {
    if (v === serverTimestamp) throw new TypeError('serverTimestamp is only allowed in create/patch data');
    return { mapValue: { fields: encodeFields(/** @type {Record<string, unknown>} */ (v)) } };
  }
  throw new TypeError(`Cannot encode ${typeof v} for Firestore`);
}

/**
 * Encode an object's fields (undefined values are left out).
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
export function encodeFields(obj) {
  /** @type {Record<string, unknown>} */
  const fields = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) fields[k] = encodeValue(v);
  return fields;
}

/**
 * Decode a Firestore Value. Timestamps become Date; integers become Number.
 * @param {any} v
 * @returns {unknown}
 */
export function decodeValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('referenceValue' in v) return v.referenceValue;
  if ('bytesValue' in v) return v.bytesValue;
  if ('geoPointValue' in v) return v.geoPointValue;
  return null;
}

/**
 * @param {Record<string, any>} fields
 * @returns {Record<string, unknown>}
 */
export function decodeFields(fields) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = decodeValue(v);
  return out;
}

/**
 * Split data into plain fields and serverTimestamp transforms (nested maps allowed).
 * @param {Record<string, unknown>} data
 * @param {string} [prefix]
 * @returns {{ plain: Record<string, unknown>, transforms: { fieldPath: string, setToServerValue: 'REQUEST_TIME' }[] }}
 */
function splitSentinels(data, prefix = '') {
  /** @type {Record<string, unknown>} */
  const plain = {};
  /** @type {{ fieldPath: string, setToServerValue: 'REQUEST_TIME' }[]} */
  const transforms = [];
  for (const [k, v] of Object.entries(data)) {
    if (v === serverTimestamp) {
      transforms.push({ fieldPath: prefix + k, setToServerValue: 'REQUEST_TIME' });
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      const inner = splitSentinels(/** @type {Record<string, unknown>} */ (v), `${prefix}${k}.`);
      plain[k] = inner.plain;
      transforms.push(...inner.transforms);
    } else {
      plain[k] = v;
    }
  }
  return { plain, transforms };
}

// ---------------------------------------------------------------- auth

/** @param {ArrayBuffer|Uint8Array} bytes */
function base64url(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @param {unknown} obj */
const b64json = (obj) => base64url(new TextEncoder().encode(JSON.stringify(obj)));

/** @type {Map<string, Promise<CryptoKey>>} */
const keyCache = new Map();
/** @type {Map<string, { token: string, expiresAt: number }>} */
const tokenCache = new Map();

/**
 * @param {string} pem PKCS8 PEM
 * @returns {Promise<CryptoKey>}
 */
function importKey(pem) {
  let key = keyCache.get(pem);
  if (!key) {
    const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    key = crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    key.catch(() => keyCache.delete(pem));
    keyCache.set(pem, key);
  }
  return key;
}

/**
 * The signed JWT assertion for the token exchange.
 * @param {ServiceAccount} sa
 * @param {number} [nowSec]
 * @returns {Promise<string>}
 */
export async function signJwt(sa, nowSec = Math.floor(Date.now() / 1000)) {
  const header = b64json({ alg: 'RS256', typ: 'JWT' });
  const claims = b64json({
    iss: sa.client_email,
    sub: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  });
  const input = `${header}.${claims}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await importKey(sa.private_key), new TextEncoder().encode(input));
  return `${input}.${base64url(sig)}`;
}

/**
 * An OAuth access token for the service account, cached until ~60 s before expiry.
 * @param {ServiceAccount} sa
 * @returns {Promise<string>}
 */
export async function getAccessToken(sa) {
  const cached = tokenCache.get(sa.client_email);
  if (cached && Date.now() < cached.expiresAt - TOKEN_MARGIN_MS) return cached.token;

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: await signJwt(sa),
  });
  let res;
  try {
    res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    throw new FirestoreError(`token request failed: ${err instanceof Error ? err.message : err}`, 0, 'UNAVAILABLE');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.access_token !== 'string') {
    throw new FirestoreError(`token exchange failed: ${data.error_description || data.error || res.status}`, res.status, 'UNAUTHENTICATED');
  }
  const expiresIn = Number(data.expires_in) || 3600;
  tokenCache.set(sa.client_email, { token: data.access_token, expiresAt: Date.now() + expiresIn * 1000 });
  return data.access_token;
}

/** Forget cached tokens (tests). */
export function _clearTokenCache() {
  tokenCache.clear();
}

// ---------------------------------------------------------------- client

/**
 * @typedef {Object} FirestoreClient
 * @property {string} projectId
 * @property {(path: string) => string} name  full resource name of a document path
 * @property {(path: string) => Promise<Record<string, unknown>|null>} get
 * @property {(collection: string, id: string, data: Record<string, unknown>) => Promise<any>} create
 * @property {(path: string, data: Record<string, unknown>, fieldsToUpdate?: string[]) => Promise<any>} patch
 * @property {(writes: object[]) => Promise<{ writeResults?: any[], commitTime?: string }>} commit
 */

/**
 * @param {ServiceAccount} sa
 * @returns {FirestoreClient}
 */
export function createClient(sa) {
  const root = `projects/${sa.project_id}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;

  /**
   * @param {string} method
   * @param {string} url
   * @param {unknown} [body]
   */
  async function call(method, url, body) {
    const token = await getAccessToken(sa);
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      throw new FirestoreError(`Firestore request failed: ${err instanceof Error ? err.message : err}`, 0, 'UNAVAILABLE');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = data.error || {};
      throw new FirestoreError(e.message || `Firestore HTTP ${res.status}`, res.status, e.status || 'UNKNOWN');
    }
    return data;
  }

  /** @param {string} path */
  const name = (path) => `${root}/${path.replace(/^\/+/, '')}`;

  /**
   * @param {string} path
   * @param {Record<string, unknown>} data
   * @param {{ mask?: string[], mustNotExist?: boolean }} opts
   */
  function write(path, data, { mask, mustNotExist }) {
    const { plain, transforms } = splitSentinels(data);
    /** @type {Record<string, any>} */
    const w = { update: { name: name(path), fields: encodeFields(plain) } };
    if (mask) {
      const transformed = new Set(transforms.map((t) => t.fieldPath));
      w.updateMask = { fieldPaths: mask.filter((f) => !transformed.has(f)) };
    }
    if (transforms.length) w.updateTransforms = transforms;
    if (mustNotExist) w.currentDocument = { exists: false };
    return w;
  }

  /** @type {FirestoreClient} */
  const client = {
    projectId: sa.project_id,
    name,
    async get(path) {
      try {
        const doc = await call('GET', `${base}/${path.replace(/^\/+/, '')}`);
        return decodeFields(doc.fields || {});
      } catch (err) {
        if (err instanceof FirestoreError && err.status === 404) return null;
        throw err;
      }
    },
    create(collection, id, data) {
      return client.commit([write(`${collection}/${id}`, data, { mustNotExist: true })]);
    },
    patch(path, data, fieldsToUpdate = Object.keys(data)) {
      return client.commit([write(path, data, { mask: fieldsToUpdate })]);
    },
    commit(writes) {
      return call('POST', `${base}:commit`, { writes });
    },
  };
  return client;
}

/** @type {FirestoreClient|null} */
let testClient = null;

/**
 * Tests only: make fromEnv return this client (pass null to undo).
 * @param {FirestoreClient|null} client
 */
export function _setTestClient(client) {
  testClient = client;
}

/**
 * Client for env.FIREBASE_SERVICE_ACCOUNT, or null when it is missing or not a usable key.
 * @param {{ FIREBASE_SERVICE_ACCOUNT?: string }} env
 * @returns {FirestoreClient|null}
 */
export function fromEnv(env) {
  if (testClient) return testClient;
  const raw = env && env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa || typeof sa.project_id !== 'string' || typeof sa.client_email !== 'string' || typeof sa.private_key !== 'string') {
      console.error('firestore: FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key');
      return null;
    }
    return createClient(sa);
  } catch {
    console.error('firestore: FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    return null;
  }
}
