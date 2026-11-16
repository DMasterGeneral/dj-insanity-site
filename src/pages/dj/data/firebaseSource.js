// Live Firebase data for the DJ dashboard. The Firebase SDK is loaded with import() on first use,
// so it is only ever downloaded on /dj (and never in demo mode).
// Writes respect firestore.rules: requests/bookings get only `status` + `updatedAt`.

import { useEffect, useMemo, useState } from 'react';
import { normalizeBooking, normalizeRequest } from './model.js';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const REQUEST_LIMIT = 300;
const BOOKING_LIMIT = 200;
const LOST = 'Connection lost — retrying…';

/** @type {Promise<any>|null} */
let sdkPromise = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]).then(
      ([appMod, authMod, fs]) => {
        const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(config);
        return { auth: authMod.getAuth(app), authMod, db: fs.getFirestore(app), fs };
      },
    );
    sdkPromise.catch(() => {
      sdkPromise = null; // let the next attempt retry the download
    });
  }
  return sdkPromise;
}

/**
 * Keep a Firestore listener open. On any error, report it, drop the listener and open a new one
 * with exponential backoff (1 s, 2 s, 4 s … capped at 30 s).
 * @param {(sdk: any, next: (v: any) => void, fail: (e: unknown) => void) => () => void} open
 * @param {(value: any) => void} onData
 * @param {(message: string|null) => void} onError
 * @returns {() => void} stop
 */
function keepListening(open, onData, onError) {
  let stopped = false;
  let attempt = 0;
  /** @type {(() => void)|null} */
  let unsub = null;
  /** @type {ReturnType<typeof setTimeout>|null} */
  let timer = null;

  function retry(err) {
    if (stopped) return;
    console.warn('DJ dashboard: listener error, retrying', err);
    if (unsub) unsub();
    unsub = null;
    onError(LOST);
    const delay = Math.min(30000, 1000 * 2 ** attempt);
    attempt++;
    timer = setTimeout(connect, delay);
  }

  function connect() {
    timer = null;
    loadSdk().then((sdk) => {
      if (stopped) return;
      unsub = open(
        sdk,
        (value) => {
          attempt = 0;
          onError(null);
          onData(value);
        },
        retry,
      );
    }, retry);
  }

  connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (unsub) unsub();
  };
}

/**
 * Subscribe while `active`; the state resets to `initial` for a new `key`.
 * @template T
 * @param {string|null} key  null = not subscribed
 * @param {(sdk: any, next: (v: T) => void, fail: (e: unknown) => void) => () => void} open
 * @param {T} initial
 */
function useLive(key, open, initial) {
  const [state, setState] = useState({ key: /** @type {string|null} */ (null), value: initial, error: /** @type {string|null} */ (null) });
  useEffect(() => {
    if (key === null) return undefined;
    return keepListening(
      open,
      (value) => setState({ key, value, error: null }),
      (error) => setState((s) => (s.error === error ? s : { ...s, error })),
    );
    // `open` is a module-level function per hook; only the key matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const current = state.key === key;
  return { value: current ? state.value : initial, loading: key !== null && !current, error: state.error };
}

// ---- Auth ------------------------------------------------------------------------------------

export const isDemo = false;

async function signIn(email, password) {
  const { auth, authMod } = await loadSdk();
  await authMod.signInWithEmailAndPassword(auth, email, password);
}

async function signOut() {
  const { auth, authMod } = await loadSdk();
  await authMod.signOut(auth);
}

export function useAuth() {
  const [state, setState] = useState({ user: null, loading: true });
  useEffect(() => {
    let unsub = null;
    let stopped = false;
    loadSdk().then(
      ({ auth, authMod }) => {
        if (stopped) return;
        unsub = authMod.onAuthStateChanged(auth, (u) =>
          setState({ user: u ? { uid: u.uid, email: u.email || '' } : null, loading: false }),
        );
      },
      (err) => {
        console.warn('DJ dashboard: Firebase failed to load', err);
        if (!stopped) setState({ user: null, loading: false });
      },
    );
    return () => {
      stopped = true;
      if (unsub) unsub();
    };
  }, []);
  return { ...state, signIn, signOut };
}

/** @param {{ uid: string }|null} user */
export function useIsAdmin(user) {
  const uid = user ? user.uid : null;
  const [result, setResult] = useState({ uid: /** @type {string|null} */ (null), isAdmin: false });
  useEffect(() => {
    if (!uid) return undefined;
    let stopped = false;
    loadSdk()
      .then(({ db, fs }) => fs.getDoc(fs.doc(db, 'admins', uid)))
      .then(
        (snap) => !stopped && setResult({ uid, isAdmin: snap.exists() }),
        (err) => {
          // A non-admin is refused by the rules, which reads as "not an admin".
          console.warn('DJ dashboard: admin check failed', err);
          if (!stopped) setResult({ uid, isAdmin: false });
        },
      );
    return () => {
      stopped = true;
    };
  }, [uid]);
  if (!uid) return { isAdmin: false, loading: false };
  return { isAdmin: result.uid === uid && result.isAdmin, loading: result.uid !== uid };
}

// ---- Data ------------------------------------------------------------------------------------

function openRequests({ db, fs }, next, fail) {
  const q = fs.query(fs.collection(db, 'requests'), fs.orderBy('createdAt', 'desc'), fs.limit(REQUEST_LIMIT));
  return fs.onSnapshot(
    q,
    (snap) => next(snap.docs.map((d) => normalizeRequest(d.id, d.data({ serverTimestamps: 'estimate' })))),
    fail,
  );
}

function openBookings({ db, fs }, next, fail) {
  const q = fs.query(fs.collection(db, 'bookings'), fs.orderBy('createdAt', 'desc'), fs.limit(BOOKING_LIMIT));
  return fs.onSnapshot(
    q,
    (snap) => next(snap.docs.map((d) => normalizeBooking(d.id, d.data({ serverTimestamps: 'estimate' })))),
    fail,
  );
}

function openSettings({ db, fs }, next, fail) {
  return fs.onSnapshot(
    fs.doc(db, 'settings', 'public'),
    (snap) => {
      const d = snap.exists() ? snap.data({ serverTimestamps: 'estimate' }) : {};
      next({
        live: d.live === true,
        requestsOpen: d.requestsOpen === true,
        tipsEnabled: d.tipsEnabled === true,
        eventName: typeof d.eventName === 'string' ? d.eventName : '',
        updatedAt: d.updatedAt && typeof d.updatedAt.toMillis === 'function' ? d.updatedAt.toMillis() : null,
      });
    },
    fail,
  );
}

const NO_REQUESTS = [];
const NO_BOOKINGS = [];
const DEFAULT_SETTINGS = { live: false, requestsOpen: false, tipsEnabled: false, eventName: '', updatedAt: null };

/** @param {{ includeDone?: boolean }} [opts] */
export function useRequests({ includeDone = false } = {}) {
  const { value: all, loading, error } = useLive('requests', openRequests, NO_REQUESTS);
  const requests = useMemo(
    () => all.filter((r) => r.status === 'pending' || (includeDone && (r.status === 'played' || r.status === 'dismissed'))),
    [all, includeDone],
  );
  return { requests, loading, error };
}

export function useBookings() {
  const { value: bookings, loading, error } = useLive('bookings', openBookings, NO_BOOKINGS);
  return { bookings, loading, error };
}

export function useSettings() {
  const { value: settings, loading, error } = useLive('settings', openSettings, DEFAULT_SETTINGS);
  return { settings, loading, error };
}

/** @param {string} id @param {string} status */
export async function setRequestStatus(id, status) {
  const { db, fs } = await loadSdk();
  await fs.updateDoc(fs.doc(db, 'requests', id), { status, updatedAt: fs.serverTimestamp() });
}

/** @param {string} id @param {string} status */
export async function setBookingStatus(id, status) {
  const { db, fs } = await loadSdk();
  await fs.updateDoc(fs.doc(db, 'bookings', id), { status, updatedAt: fs.serverTimestamp() });
}

/** @param {Record<string, unknown>} patch */
export async function updateSettings(patch) {
  const { db, fs } = await loadSdk();
  await fs.setDoc(fs.doc(db, 'settings', 'public'), { ...patch, updatedAt: fs.serverTimestamp() }, { merge: true });
}
