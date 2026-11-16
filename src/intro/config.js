// The landing-page intro. The DJ has not chosen one yet: change it here.
export const INTRO = { engine: 'stardust', speed: 1 };

// Engines that have been ported to src/intro/engines/.
export const ENGINES = {
  stardust: () => import('./engines/stardust.js'),
};

/**
 * Review overrides from the query string:
 *   ?intro=off                     never play
 *   ?intro=stardust&speed=0.65     always play (ignores the once-per-session rule) at that speed
 * Returns { off: true }, { engine, speed, forced: true }, or null when there is no override.
 */
export function introOverride(search) {
  const q = new URLSearchParams(search);
  const name = q.get('intro');
  if (name === 'off') return { off: true };
  if (!name || !ENGINES[name]) return null;
  const speed = parseFloat(q.get('speed'));
  return { engine: name, speed: speed > 0 && Number.isFinite(speed) ? speed : INTRO.speed, forced: true };
}
