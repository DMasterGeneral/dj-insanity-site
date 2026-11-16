import { error } from '../_lib/guard.js';

// Any /api path without its own function gets a JSON 404, never the SPA's index.html.
export function onRequest() {
  return error(404, 'not_found', 'No API endpoint at this address.');
}
