import { useEffect, useId, useState } from 'react';
import { Link2, Music, PenLine, Search, X } from 'lucide-react';
import { searchSongs } from './searchSongs.js';
import { createLatestOnly, describeTyped, searchErrorMessage, SEARCH_DEBOUNCE_MS, shouldSearch } from './requestLogic.js';

// Search as you type (plan section 4.1, Client). A combobox: the input owns focus, the arrow keys
// move through the options, Enter picks, Escape clears. The last option is always the guest's own
// words, sent as a typed (or link) request, so a failed or empty search never blocks a request.

const SKELETON_ROWS = 4;

/**
 * @typedef {import('../../../shared/contracts.js').Song} Song
 * @typedef {{ song: Song } | { typed: string }} Pick
 */

/** Song artwork, or a placeholder of the same size. */
export function Artwork({ url, size = 56 }) {
  return (
    <span className="rq-art" style={{ width: size, height: size }} aria-hidden="true">
      {url ? (
        <img src={url} alt="" width={size} height={size} loading="lazy" decoding="async" />
      ) : (
        <Music size={Math.round(size / 2.4)} />
      )}
    </span>
  );
}

/** The "E" badge, read out as "Explicit". */
export function ExplicitBadge() {
  return (
    <span className="rq-e" role="img" aria-label="Explicit">
      E
    </span>
  );
}

/**
 * @param {{
 *   query: string,
 *   onQueryChange: (q: string) => void,
 *   onPick: (pick: Pick) => void,
 *   inputRef?: React.Ref<HTMLInputElement>,
 * }} props
 */
export default function SongSearch({ query, onQueryChange, onPick, inputRef }) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (i) => `${uid}-opt-${i}`;

  const [latest] = useState(createLatestOnly);
  // The last answer from the server, for the query it answered.
  const [answer, setAnswer] = useState(
    /** @type {{ q: string, results: Song[], error: string|null }} */ ({ q: '', results: [], error: null }),
  );
  const [active, setActive] = useState({ key: '', index: -1 });

  const key = query.trim();
  const searchable = shouldSearch(key);

  useEffect(() => {
    if (!searchable) {
      latest.cancel();
      return undefined;
    }
    const timer = setTimeout(() => {
      const call = latest.begin();
      searchSongs(key, { signal: call.signal }).then(
        (results) => {
          if (call.isLatest()) setAnswer({ q: key, results, error: null });
        },
        (err) => {
          if (!call.isLatest() || call.signal.aborted) return;
          setAnswer({ q: key, results: [], error: searchErrorMessage(err) });
        },
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [key, searchable, latest]);

  useEffect(() => () => latest.cancel(), [latest]);

  const answered = searchable && answer.q === key;
  const loading = searchable && !answered;
  // While a new query loads, keep showing the previous results instead of flashing skeletons.
  const showStale = loading && answer.results.length > 0;
  const results = answered || showStale ? answer.results : [];
  const error = answered ? answer.error : null;
  const empty = answered && !error && results.length === 0;

  const typed = key ? describeTyped(key) : null;
  const optionCount = results.length + (typed ? 1 : 0);
  const listKey = `${key}|${answer.q}`;
  const activeIndex = active.key === listKey && active.index < optionCount ? active.index : -1;

  /** @param {number} i */
  function pickAt(i) {
    if (i < results.length) onPick({ song: results[i] });
    else if (typed?.ok) onPick({ typed: key });
  }

  /** @param {React.KeyboardEvent<HTMLInputElement>} e */
  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!optionCount) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      const next = activeIndex === -1 ? (step === 1 ? 0 : optionCount - 1) : (activeIndex + step + optionCount) % optionCount;
      setActive({ key: listKey, index: next });
      document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex !== -1) pickAt(activeIndex);
    } else if (e.key === 'Escape') {
      if (!query) return;
      e.preventDefault();
      onQueryChange('');
    }
  }

  let status = '';
  if (loading) status = 'Searching…';
  else if (error) status = error;
  else if (answered) status = results.length ? `${results.length} songs found` : 'No songs found';

  return (
    <div className="rq-search" role="search">
      <label className="rq-label" htmlFor={`${uid}-input`}>
        Search for a song
      </label>
      <div className="rq-search__box">
        <Search className="rq-search__icon" size={22} aria-hidden="true" />
        <input
          ref={inputRef}
          id={`${uid}-input`}
          className="rq-search__input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={optionCount > 0}
          aria-controls={listId}
          aria-activedescendant={activeIndex !== -1 ? optionId(activeIndex) : undefined}
          aria-describedby={`${uid}-status`}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder="Song or artist"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button type="button" className="rq-search__clear" aria-label="Clear search" onClick={() => onQueryChange('')}>
            <X size={22} aria-hidden="true" />
          </button>
        )}
      </div>

      <p id={`${uid}-status`} className="rq-sr" aria-live="polite">
        {status}
      </p>

      {key.length === 0 && <p className="rq-hint">Can’t find it? Type it anyway and send it as written.</p>}
      {key.length === 1 && <p className="rq-hint">Keep typing to search…</p>}

      {error && (
        <div className="rq-notice rq-notice--error">
          <p>{error}</p>
        </div>
      )}
      {empty && (
        <div className="rq-notice">
          <p>No songs match “{key}”. Check the spelling, or request it as written below.</p>
        </div>
      )}

      {loading && !showStale && (
        <ul className="rq-list" aria-hidden="true">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <li key={i} className="rq-row rq-row--skeleton">
              <span className="rq-art rq-skel" style={{ width: 56, height: 56 }} />
              <span className="rq-row__text">
                <span className="rq-skel rq-skel--title" />
                <span className="rq-skel rq-skel--artist" />
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul id={listId} role="listbox" aria-label="Songs" className={`rq-list${showStale ? ' rq-list--stale' : ''}`} hidden={!optionCount}>
        {results.map((song, i) => (
          <li
            key={`${song.title}|${song.artist}|${i}`}
            id={optionId(i)}
            role="option"
            aria-selected={activeIndex === i}
            className="rq-row rq-row--option"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickAt(i)}
          >
            <Artwork url={song.artworkUrl} />
            <span className="rq-row__text">
              <span className="rq-row__title">
                <span className="rq-row__title-text">{song.title}</span>
                {song.explicit && <ExplicitBadge />}
              </span>
              <span className="rq-row__artist">{song.artist}</span>
            </span>
          </li>
        ))}
        {typed && (
          <li
            id={optionId(results.length)}
            role="option"
            aria-selected={activeIndex === results.length}
            aria-disabled={typed.ok ? undefined : true}
            className="rq-row rq-row--option rq-row--typed"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pickAt(results.length)}
          >
            <span className="rq-art rq-art--icon" style={{ width: 56, height: 56 }} aria-hidden="true">
              {typed.ok && typed.source === 'link' ? <Link2 size={24} /> : <PenLine size={24} />}
            </span>
            <span className="rq-row__text">
              {typed.ok && typed.source === 'link' ? (
                <>
                  <span className="rq-row__title">Request this link</span>
                  <span className="rq-row__artist rq-row__url">{typed.text}</span>
                </>
              ) : (
                <>
                  <span className="rq-row__title rq-row__title--wrap">Request “{key}” as written</span>
                  <span className={typed.ok ? 'rq-row__artist' : 'rq-row__artist rq-row__artist--error'}>
                    {typed.ok ? 'Not in the list? Send it anyway.' : typed.error}
                  </span>
                </>
              )}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
