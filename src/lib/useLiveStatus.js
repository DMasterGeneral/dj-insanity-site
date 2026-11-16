import { useEffect, useState } from 'react';
import { apiGet } from './api.js';

// GET /api/status once per page load, shared by every component that asks.
// A failure is not cached: it reports not live plus `error: true`, and `retry()` asks again.

const NOT_LIVE = Object.freeze({ live: false, eventName: null, requestsOpen: false, tipsEnabled: false });
const LOADING = Object.freeze({ loading: true, error: false, ...NOT_LIVE });

/**
 * @typedef {{ loading: false, error: boolean, live: boolean, eventName: string|null, requestsOpen: boolean, tipsEnabled: boolean }} Status
 */

/**
 * The fetch-and-cache part, without React: a success is kept for the page load, a failure is not.
 * @param {() => Promise<any>} fetchStatus
 */
export function createStatusLoader(fetchStatus) {
  /** @type {Status | null} */
  let cached = null;
  /** @type {Promise<Status> | null} */
  let pending = null;
  return {
    cached: () => cached,
    /** @returns {Promise<Status>} */
    load() {
      pending ??= fetchStatus().then(
        (d) =>
          (cached = {
            loading: false,
            error: false,
            live: d.live === true,
            eventName: typeof d.eventName === 'string' && d.eventName.trim() ? d.eventName.trim() : null,
            requestsOpen: d.requestsOpen === true,
            tipsEnabled: d.tipsEnabled === true,
          }),
        () => {
          pending = null; // the next load() tries again
          return { loading: false, error: true, ...NOT_LIVE };
        },
      );
      return pending;
    },
  };
}

const loader = createStatusLoader(() => apiGet('/api/status'));

/**
 * Public live-mode settings. On error everything reads as not live; `retry()` fetches again.
 * @returns {Omit<Status, 'loading'> & { loading: boolean, retry: () => void }}
 */
export function useLiveStatus() {
  const [state, setState] = useState(() => loader.cached() ?? LOADING);

  useEffect(() => {
    if (!state.loading) return undefined;
    let active = true;
    loader.load().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, [state.loading]);

  return { ...state, retry: () => setState(LOADING) };
}

export default useLiveStatus;
