import { useEffect, useRef } from 'react';

// The intro's wave sheet (public/intros/option-2-stardust.html) as a section divider: nine dotted
// strands, built once as SVG. Each strand is two periods wide and slides by one period, so it loops
// seamlessly; strands move at different speeds and directions, like the intro's interference.
// Motion runs only while the divider is on screen and only under prefers-reduced-motion: no-preference
// (see a.css), and it animates transform only.

const PERIOD = 1200;
const HEIGHT = 120;
const STEP = 8;
const TAU = Math.PI * 2;

/** One strand of the wave sheet. `st` is its position in the sheet, -1 (bottom) to 1 (top). */
function strandPath(st, phase) {
  const mid = HEIGHT / 2;
  const amp = 34;
  let d = '';
  for (let x = 0; x <= PERIOD * 2; x += STEP) {
    const v = x / PERIOD;
    const env = 0.55 + 0.45 * Math.sin(TAU * v + phase);
    const y = mid + amp * env * (st * Math.sin(TAU * 2 * v + phase) + 0.34 * Math.sin(TAU * 5 * v + st * 1.9));
    d += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)}`;
  }
  return d;
}

// tone: which palette slot the strand uses (blue, pale, gold); dur in seconds; rev = moves right.
const STRANDS = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map((st, i) => ({
  d: strandPath(st, 0.35 * i),
  tone: st === 0 ? 'gold' : Math.abs(st) === 0.25 ? 'pale' : Math.abs(st) === 0.75 ? 'gold-dim' : 'blue',
  dur: 9 + ((i * 7) % 9) * 1.6,
  rev: i % 3 === 1,
}));

/** @param {{ size?: 'lg' | 'md' }} props */
export default function Waveform({ size = 'md' }) {
  const ref = useRef(/** @type {HTMLDivElement|null} */ (null));

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-on', entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`design-a__wave design-a__wave--${size}`} aria-hidden="true">
      <svg viewBox={`0 0 ${PERIOD} ${HEIGHT}`} preserveAspectRatio="none" focusable="false">
        {STRANDS.map((s, i) => (
          <path
            key={i}
            d={s.d}
            className={`design-a__strand design-a__strand--${s.tone}${s.rev ? ' design-a__strand--rev' : ''}`}
            style={{ animationDuration: `${s.dur}s` }}
          />
        ))}
      </svg>
    </div>
  );
}
