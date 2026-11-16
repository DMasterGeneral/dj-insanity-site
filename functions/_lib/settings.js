// Public site settings (settings/public), flipped from the DJ dashboard.

/** @typedef {{ live: boolean, eventName: string|null, requestsOpen: boolean, tipsEnabled: boolean }} PublicSettings */

/** @type {Readonly<PublicSettings>} */
export const DEFAULT_SETTINGS = Object.freeze({ live: false, eventName: null, requestsOpen: false, tipsEnabled: false });

/**
 * Read settings/public. Defaults when Firestore is unconfigured or the doc is missing;
 * Firestore errors are thrown.
 * @param {import('./firestore.js').FirestoreClient|null} fs
 * @returns {Promise<PublicSettings>}
 */
export async function readSettings(fs) {
  if (!fs) return { ...DEFAULT_SETTINGS };
  const doc = await fs.get('settings/public');
  if (!doc) return { ...DEFAULT_SETTINGS };
  return {
    live: doc.live === true,
    eventName: typeof doc.eventName === 'string' && doc.eventName.trim() ? doc.eventName.trim() : null,
    requestsOpen: doc.requestsOpen === true,
    tipsEnabled: doc.tipsEnabled === true,
  };
}
