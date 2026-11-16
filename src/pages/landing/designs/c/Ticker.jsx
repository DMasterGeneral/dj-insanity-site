import { useState } from 'react';
import { Pause, Play } from 'lucide-react';

/**
 * The marquee band: the name and event types scrolling past in giant type. Decorative (the same
 * words are on the page as text), so the moving copy is hidden from screen readers. A button
 * pauses it; under prefers-reduced-motion it never moves and the button is not shown.
 * @param {{ words: string[] }} props
 */
export default function Ticker({ words }) {
  const [paused, setPaused] = useState(false);
  const run = (
    <span className="c-ticker__run">
      {words.map((w) => (
        <span key={w} className="c-ticker__word">
          {w}
          <span className="c-ticker__star" />
        </span>
      ))}
    </span>
  );

  return (
    <div className={`c-ticker${paused ? ' is-paused' : ''}`}>
      <div className="c-ticker__track" aria-hidden="true">
        {run}
        {run}
      </div>
      <button
        type="button"
        className="c-ticker__toggle"
        aria-pressed={paused}
        aria-label="Pause the scrolling banner"
        onClick={() => setPaused((p) => !p)}
      >
        {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
      </button>
    </div>
  );
}
