import { json } from '../_lib/guard.js';

// GET /api/status: public site settings. Defaults for now; Phase 1 reads settings/public from Firestore.
export function onRequestGet() {
  return json(
    { live: false, eventName: null, requestsOpen: false, tipsEnabled: false },
    200,
    { 'Cache-Control': 'public, max-age=15' },
  );
}
