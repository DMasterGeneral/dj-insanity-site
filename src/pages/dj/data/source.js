// Picks the dashboard's data source. Both sources expose the same hooks and actions:
//   useAuth() -> { user, loading, signIn(email, pw), signOut() }
//   useIsAdmin(user) -> { isAdmin, loading }
//   useRequests({ includeDone }) -> { requests, loading, error }
//   useBookings() -> { bookings, loading, error }
//   useSettings() -> { settings, loading, error }
//   setRequestStatus(id, status), setBookingStatus(id, status), updateSettings(patch)
// `error` is a short "connection lost" notice while a listener is reconnecting.

import * as demoSource from './demoSource.js';
import * as firebaseSource from './firebaseSource.js';

export const PRODUCTION_HOST = 'dj-insanity-site.pages.dev';

/**
 * @param {{ search: string, hostname: string, projectId?: string }} where
 * @returns {{ kind: 'demo'|'firebase', configured: boolean, demoRequested: boolean, production: boolean }}
 */
export function pickSource({ search, hostname, projectId }) {
  const production = hostname === PRODUCTION_HOST;
  const configured = !!projectId;
  const demoRequested = !production && new URLSearchParams(search).get('demo') === '1';
  return { kind: demoRequested || !configured ? 'demo' : 'firebase', configured, demoRequested, production };
}

export const choice = pickSource({
  search: window.location.search,
  hostname: window.location.hostname,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

/** The active source module. Chosen once per page load, so hooks are called consistently. */
export const source = choice.kind === 'demo' ? demoSource : firebaseSource;
