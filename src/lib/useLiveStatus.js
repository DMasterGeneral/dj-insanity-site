import { useEffect, useState } from 'react';
import { apiGet } from './api.js';

// GET /api/status once per page load, shared by every component that asks. Any error = not live.

const NOT_LIVE = Object.freeze({ live: false, eventName: null, requestsOpen: false, tipsEnabled: false });

/** @type {null | { loading: false, live: boolean, eventName: string|null, requestsOpen: boolean, tipsEnabled: boolean }} */
let cached = null;
/** @type {Promise<NonNullable<typeof cached>> | null} */
let pending = null;

function load() {
  pending ??= apiGet('/api/status')
    .then(
      (d) => ({
        loading: /** @type {const} */ (false),
        live: d.live === true,
        eventName: typeof d.eventName === 'string' && d.eventName.trim() ? d.eventName.trim() : null,
        requestsOpen: d.requestsOpen === true,
        tipsEnabled: d.tipsEnabled === true,
      }),
      () => ({ loading: /** @type {const} */ (false), ...NOT_LIVE }),
    )
    .then((s) => (cached = s));
  return pending;
}

/**
 * Public live-mode settings.
 * @returns {{ loading: boolean, live: boolean, eventName: string|null, requestsOpen: boolean, tipsEnabled: boolean }}
 */
export function useLiveStatus() {
  const [state, setState] = useState(() => cached ?? { loading: true, ...NOT_LIVE });

  useEffect(() => {
    if (!state.loading) return undefined;
    let active = true;
    load().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, [state.loading]);

  return state;
}

export default useLiveStatus;
