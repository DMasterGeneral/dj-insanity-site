// Cloudflare Turnstile (invisible, "interaction-only") for the site's POST forms (plan section 3.5).
// Does nothing unless VITE_TURNSTILE_SITE_KEY is set at build time: getToken() then resolves null.
//
//   const ts = createTurnstile('booking');
//   ts.start(box);                     // e.g. on first focus: loads the script, renders into `box`
//   const token = await ts.getToken(box); // null when not configured, failed, or no token within 10 s
//   ts.reset();                       // after each submit: tokens are single use
//   ts.remove();                      // on unmount

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_WAIT_MS = 10000;

/** @type {Promise<any> | null} */
let turnstileScript = null;
function loadTurnstile() {
  turnstileScript ??= new Promise((resolve) => {
    if (window.turnstile) {
      resolve(window.turnstile);
      return;
    }
    const s = document.createElement('script');
    s.src = TURNSTILE_SRC;
    s.async = true;
    s.onload = () => resolve(window.turnstile ?? null);
    s.onerror = () => {
      turnstileScript = null; // allow a later retry
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return turnstileScript;
}

/**
 * One Turnstile widget.
 * @param {string} action  shows up in the Turnstile analytics, e.g. 'booking'
 */
export function createTurnstile(action) {
  const ts = {
    started: false,
    widgetId: /** @type {string|null} */ (null),
    token: /** @type {string|null} */ (null),
    waiters: /** @type {((t: string|null) => void)[]} */ ([]),
  };

  /** @param {HTMLElement | null} box  the element to render the widget into */
  function start(box) {
    if (!TURNSTILE_SITE_KEY || ts.started) return;
    ts.started = true;
    const settle = (token) => {
      ts.token = token;
      if (token) ts.waiters.splice(0).forEach((w) => w(token));
    };
    loadTurnstile().then((api) => {
      if (!api || !box) {
        ts.started = false;
        ts.waiters.splice(0).forEach((w) => w(null));
        return;
      }
      ts.widgetId = api.render(box, {
        sitekey: TURNSTILE_SITE_KEY,
        action,
        appearance: 'interaction-only',
        callback: (token) => settle(token),
        'expired-callback': () => settle(null),
        'error-callback': () => settle(null),
      });
    });
  }

  /**
   * @param {HTMLElement | null} box
   * @returns {Promise<string|null>}
   */
  function getToken(box) {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(null);
    start(box);
    if (ts.token) return Promise.resolve(ts.token);
    return new Promise((resolve) => {
      ts.waiters.push(resolve);
      setTimeout(() => resolve(null), TOKEN_WAIT_MS);
    });
  }

  function reset() {
    ts.token = null; // tokens are single use
    if (ts.widgetId !== null) window.turnstile?.reset(ts.widgetId);
  }

  function remove() {
    if (ts.widgetId !== null) window.turnstile?.remove(ts.widgetId);
  }

  return { start, getToken, reset, remove };
}
