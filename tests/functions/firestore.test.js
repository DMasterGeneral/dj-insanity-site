import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import {
  createClient,
  fromEnv,
  signJwt,
  getAccessToken,
  encodeValue,
  decodeValue,
  encodeFields,
  decodeFields,
  serverTimestamp,
  FirestoreError,
  _clearTokenCache,
} from '../../functions/_lib/firestore.js'
import { hit, LIMITS } from '../../functions/_lib/ratelimit.js'
import { onRequestPost as postRequest } from '../../functions/api/requests/index.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const DOCS = 'https://firestore.googleapis.com/v1/projects/demo-test/databases/(default)/documents'

let sa
let publicKey

function toPem(der) {
  const b64 = Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')
  return `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`
}

const b64urlJson = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'))

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  publicKey = pair.publicKey
  sa = {
    project_id: 'demo-test',
    client_email: 'functions@demo-test.iam.gserviceaccount.com',
    private_key: toPem(await crypto.subtle.exportKey('pkcs8', pair.privateKey)),
  }
})

beforeEach(() => _clearTokenCache())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

/** fetch stub: token endpoint + a Firestore handler. Records every call. */
function stubFetch(firestore = () => Response.json({}), token = () => Response.json({ access_token: 'tok-1', expires_in: 3600 })) {
  const spy = vi.fn(async (url, init) => (url === TOKEN_URL ? token(init) : firestore(url, init)))
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('service-account auth', () => {
  it('signs an RS256 JWT with the right claims', async () => {
    const jwt = await signJwt(sa, 1_800_000_000)
    const [h, c, s] = jwt.split('.')
    expect(b64urlJson(h)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(b64urlJson(c)).toEqual({
      iss: sa.client_email,
      sub: sa.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: TOKEN_URL,
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    })
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, Buffer.from(s, 'base64url'), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
  })

  it('exchanges the JWT for a token and caches it until 60 s before expiry', async () => {
    let now = 1_800_000_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const spy = stubFetch()
    expect(await getAccessToken(sa)).toBe('tok-1')
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe(TOKEN_URL)
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer')
    expect(init.body.get('assertion').split('.')).toHaveLength(3)

    now += 3_000_000 // 50 min later: still cached
    expect(await getAccessToken(sa)).toBe('tok-1')
    expect(spy).toHaveBeenCalledTimes(1)

    now += 541_000 // 59 min 1 s: inside the 60 s margin, refresh
    await getAccessToken(sa)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('throws FirestoreError when the exchange fails', async () => {
    stubFetch(undefined, () => Response.json({ error: 'invalid_grant', error_description: 'Invalid JWT' }, { status: 400 }))
    await expect(getAccessToken(sa)).rejects.toMatchObject({ name: 'FirestoreError', status: 400, message: expect.stringMatching(/Invalid JWT/) })
  })
})

describe('values', () => {
  it('round-trips every supported type', () => {
    const when = new Date('2026-11-16T12:34:56.789Z')
    const data = {
      s: 'hi',
      i: 42,
      neg: -7,
      d: 1.5,
      t: true,
      f: false,
      n: null,
      ts: when,
      m: { a: 'x', nested: { b: 2 } },
      arr: [1, 'two', null, { c: false }],
      empty: [],
    }
    const enc = encodeFields(data)
    expect(enc.i).toEqual({ integerValue: '42' })
    expect(enc.d).toEqual({ doubleValue: 1.5 })
    expect(enc.n).toEqual({ nullValue: null })
    expect(enc.ts).toEqual({ timestampValue: '2026-11-16T12:34:56.789Z' })
    expect(enc.m.mapValue.fields.nested.mapValue.fields.b).toEqual({ integerValue: '2' })
    expect(decodeFields(JSON.parse(JSON.stringify(enc)))).toEqual(data)
  })

  it('leaves undefined out, decodes missing array values as []', () => {
    expect(encodeFields({ a: undefined, b: 1 })).toEqual({ b: { integerValue: '1' } })
    expect(decodeValue({ arrayValue: {} })).toEqual([])
    expect(decodeValue({ mapValue: {} })).toEqual({})
    expect(() => encodeValue(serverTimestamp)).toThrow()
  })
})

describe('client', () => {
  it('commits a create with a precondition and server-timestamp transforms', async () => {
    const spy = stubFetch(() => Response.json({ writeResults: [{ updateTime: 't' }], commitTime: 't' }))
    const fs = createClient(sa)
    const res = await fs.create('requests', 'abc', { a: 1, tip: { state: 'none' }, createdAt: serverTimestamp })
    expect(res.commitTime).toBe('t')

    const [url, init] = spy.mock.calls[1]
    expect(url).toBe(`${DOCS}:commit`)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer tok-1')
    expect(JSON.parse(init.body)).toEqual({
      writes: [
        {
          update: {
            name: 'projects/demo-test/databases/(default)/documents/requests/abc',
            fields: { a: { integerValue: '1' }, tip: { mapValue: { fields: { state: { stringValue: 'none' } } } } },
          },
          updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
          currentDocument: { exists: false },
        },
      ],
    })
  })

  it('patches only the named fields', async () => {
    const spy = stubFetch(() => Response.json({ writeResults: [{}] }))
    await createClient(sa).patch('bookings/b1', { notifyError: 'email: HTTP 403', updatedAt: serverTimestamp })
    const body = JSON.parse(spy.mock.calls[1][1].body)
    expect(body.writes[0]).toEqual({
      update: { name: 'projects/demo-test/databases/(default)/documents/bookings/b1', fields: { notifyError: { stringValue: 'email: HTTP 403' } } },
      updateMask: { fieldPaths: ['notifyError'] },
      updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
    })
  })

  it('gets and decodes a document; a missing one is null', async () => {
    stubFetch((url) =>
      url.endsWith('/settings/public')
        ? Response.json({ name: 'x', fields: { live: { booleanValue: true }, eventName: { stringValue: 'Gala' } } })
        : Response.json({ error: { code: 404, message: 'not found', status: 'NOT_FOUND' } }, { status: 404 }),
    )
    const fs = createClient(sa)
    expect(await fs.get('settings/public')).toEqual({ live: true, eventName: 'Gala' })
    expect(await fs.get('settings/nope')).toBeNull()
  })

  it('turns Firestore errors into FirestoreError with HTTP and gRPC status', async () => {
    stubFetch(() => Response.json({ error: { code: 409, message: 'Document already exists', status: 'ALREADY_EXISTS' } }, { status: 409 }))
    const err = await createClient(sa).create('requests', 'abc', { a: 1 }).catch((e) => e)
    expect(err).toBeInstanceOf(FirestoreError)
    expect(err).toMatchObject({ status: 409, grpcStatus: 'ALREADY_EXISTS', message: 'Document already exists' })
  })

  it('fromEnv returns null when the key is missing or unusable', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(fromEnv({})).toBeNull()
    expect(fromEnv({ FIREBASE_SERVICE_ACCOUNT: '{nope' })).toBeNull()
    expect(fromEnv({ FIREBASE_SERVICE_ACCOUNT: '{"project_id":"p"}' })).toBeNull()
    expect(fromEnv({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify(sa) }).projectId).toBe('demo-test')
  })
})

describe('rate limits', () => {
  const fakeFs = (count) => ({
    name: (p) => `projects/demo-test/databases/(default)/documents/${p}`,
    commit: vi.fn(async () => ({ writeResults: [{ transformResults: [{ integerValue: String(count) }] }] })),
  })

  it('upserts the window counter with an increment and reads the count back', async () => {
    const fs = fakeFs(3)
    const now = Date.UTC(2026, 10, 16, 12, 34, 56)
    const r = await hit(fs, 'requests', 'abc123', 6, 600, now)
    expect(r).toEqual({ allowed: true, count: 3 })
    const windowStart = Math.floor(now / 1000 / 600) * 600
    expect(fs.commit.mock.calls[0][0]).toEqual([
      {
        update: {
          name: `projects/demo-test/databases/(default)/documents/rate/requests_abc123_${windowStart}`,
          fields: { expiresAt: { timestampValue: new Date((windowStart + 600) * 1000 + 86_400_000).toISOString() } },
        },
        updateMask: { fieldPaths: ['expiresAt'] },
        updateTransforms: [{ fieldPath: 'count', increment: { integerValue: '1' } }],
      },
    ])
  })

  it('refuses once the count passes the limit', async () => {
    expect(await hit(fakeFs(6), 'requests', 'h', 6, 600)).toEqual({ allowed: true, count: 6 })
    expect(await hit(fakeFs(7), 'requests', 'h', 6, 600)).toEqual({ allowed: false, count: 7 })
  })

  it('allows the write when the counter itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fs = { name: (p) => p, commit: vi.fn(async () => { throw new FirestoreError('down', 503, 'UNAVAILABLE') }) }
    expect(await hit(fs, 'bookings', 'h', 3, 3600)).toEqual({ allowed: true, count: 0 })
  })

  it('has the planned limits', () => {
    expect(LIMITS.requests).toEqual({ limit: 6, windowSec: 600 })
    expect(LIMITS.bookings).toEqual({ limit: 3, windowSec: 3600 })
  })
})

describe('deadlines', () => {
  it('a Firestore call that never answers times out and the endpoint answers 503 unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const realTimeout = AbortSignal.timeout.bind(AbortSignal)
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(20))
    // Token exchange answers; Firestore hangs until the request's signal aborts it.
    stubFetch((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))))
    const res = await postRequest({
      request: new Request('https://site.test/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typed: 'some song', clientId: 'device-abc-123' }),
      }),
      env: { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(sa) },
    })
    expect(res.status).toBe(503)
    expect((await res.json()).error.code).toBe('unavailable')
    expect(timeoutSpy).toHaveBeenCalledWith(8000)
    expect(console.error).toHaveBeenCalledWith('requests: create failed', expect.objectContaining({ name: 'FirestoreError', status: 0, grpcStatus: 'UNAVAILABLE' }))
  })
})
