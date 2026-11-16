import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CalendarHeart, Check, Disc3 } from 'lucide-react';
import { NAME_MAX, NOTE_MAX, validateSongRequest } from '../../../shared/contracts.js';
import { apiPost } from '../../lib/api.js';
import { createTurnstile } from '../../lib/turnstile.js';
import { useLiveStatus } from '../../lib/useLiveStatus.js';
import Button from '../../components/ui/Button.jsx';
import Field from '../../components/ui/Field.jsx';
import SongSearch, { Artwork, ExplicitBadge } from './SongSearch.jsx';
import {
  browserStorage,
  cooldownUntil,
  describeTyped,
  fieldErrorView,
  getClientId,
  markRequestSent,
  secondsLeft,
  submitErrorView,
} from './requestLogic.js';
import '../../components/ui/ui.css';
import './request.css';

// /request: the guest song-request page (plan sections 4.1 Client and 4.2, no tips yet).
// The browser never writes to Firestore: the request goes to POST /api/requests.

const PRODUCTION_HOST = 'dj-insanity-site.pages.dev';

/** `?preview=open` shows the open page before the database is connected; never on production. */
function previewOpen() {
  return (
    window.location.hostname !== PRODUCTION_HOST && new URLSearchParams(window.location.search).get('preview') === 'open'
  );
}

/**
 * The song a pick stands for, as the card and the confirmation show it.
 * @param {{ song: import('../../../shared/contracts.js').Song } | { typed: string }} pick
 */
function pickedSong(pick) {
  if ('song' in pick) return pick.song;
  const t = describeTyped(pick.typed);
  return { title: pick.typed, artist: '', explicit: false, source: t.ok ? t.source : 'typed' };
}

function Header({ eventName }) {
  return (
    <header className="rq-header">
      <a href="/" className="rq-brand">
        <Disc3 size={22} aria-hidden="true" />
        <span>DJ Insanity</span>
      </a>
      {eventName && <p className="rq-event">{eventName}</p>}
      <h1 className="rq-title">Request a song</h1>
    </header>
  );
}

function Closed() {
  return (
    <section className="rq-closed" aria-labelledby="rq-closed-title">
      <CalendarHeart className="rq-closed__icon" size={48} aria-hidden="true" />
      <h2 id="rq-closed-title" className="rq-closed__title">
        Requests open during events
      </h2>
      <p className="rq-closed__text">
        When DJ Insanity is playing, this is where you send him your songs. Check back once the party starts.
      </p>
      <Button href="/#book" className="rq-button-lg">
        Book DJ Insanity for your event
      </Button>
    </section>
  );
}

/** One song as picked: artwork, title, artist, E badge. */
function SongSummary({ song, size = 72 }) {
  const isLink = song.source === 'link';
  return (
    <div className="rq-song">
      <Artwork url={song.artworkUrl} size={size} />
      <div className="rq-song__text">
        <p className="rq-song__title">
          <span className={isLink ? 'rq-song__url' : undefined}>{song.title}</span>
          {song.explicit && <ExplicitBadge />}
        </p>
        <p className="rq-song__artist">{song.artist || (isLink ? 'Link request' : 'Typed request')}</p>
      </div>
    </div>
  );
}

function OpenRequests({ onClosed }) {
  const [storage] = useState(browserStorage);
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState(/** @type {null | { song: any } | { typed: string }} */ (null));
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState(/** @type {'edit'|'sending'|'sent'} */ ('edit'));
  const [sentSong, setSentSong] = useState(/** @type {any} */ (null));
  const [fieldErrors, setFieldErrors] = useState(/** @type {Record<string, string>} */ ({}));
  const [failure, setFailure] = useState(/** @type {string|null} */ (null));
  const [until, setUntil] = useState(() => cooldownUntil(storage, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [turnstile] = useState(() => createTurnstile('request'));

  const searchInput = useRef(/** @type {HTMLInputElement|null} */ (null));
  const cardTitle = useRef(/** @type {HTMLHeadingElement|null} */ (null));
  const doneTitle = useRef(/** @type {HTMLHeadingElement|null} */ (null));
  const turnstileBox = useRef(/** @type {HTMLDivElement|null} */ (null));

  const wait = secondsLeft(until, now);

  // Tick the cool-down countdown once a second while it runs.
  useEffect(() => {
    if (until <= now) return undefined;
    const t = setTimeout(() => setNow(Date.now()), Math.min(1000, until - now));
    return () => clearTimeout(t);
  }, [until, now]);

  useEffect(() => () => turnstile.remove(), [turnstile]);

  function dropFieldError(field) {
    setFieldErrors((errs) => {
      const next = { ...errs };
      delete next[field];
      return next;
    });
  }

  function clearErrors() {
    setFieldErrors({});
    setFailure(null);
  }

  function choose(p) {
    flushSync(() => {
      setPick(p);
      clearErrors();
      setNow(Date.now());
    });
    cardTitle.current?.focus();
    turnstile.start(turnstileBox.current);
  }

  function change() {
    flushSync(() => {
      setPick(null);
      clearErrors();
    });
    searchInput.current?.focus();
  }

  function requestAnother() {
    flushSync(() => {
      setPhase('edit');
      setSentSong(null);
      setQuery('');
    });
    searchInput.current?.focus();
  }

  async function submit() {
    if (!pick || phase === 'sending' || secondsLeft(until, Date.now()) > 0) return;
    const body = {
      ...('song' in pick ? { song: pick.song } : { typed: pick.typed }),
      note: note.trim() || undefined,
      requesterName: name.trim() || undefined,
      tipCents: 0,
      clientId: getClientId(storage),
    };
    const check = validateSongRequest(body);
    if (!check.ok) {
      const view = fieldErrorView(check.errors);
      setFieldErrors(view.fields);
      setFailure(view.message);
      return;
    }
    clearErrors();
    setPhase('sending');
    try {
      const token = await turnstile.getToken(turnstileBox.current);
      await apiPost('/api/requests', token ? { ...body, turnstileToken: token } : body);
      const t = Date.now();
      flushSync(() => {
        setSentSong(pickedSong(pick));
        setPick(null);
        setNote('');
        setUntil(markRequestSent(storage, t));
        setNow(t);
        setPhase('sent');
      });
      doneTitle.current?.focus();
    } catch (err) {
      const view = submitErrorView(err);
      if (view.closed) {
        onClosed();
        return;
      }
      setFieldErrors(view.fields);
      setFailure(view.message);
      setPhase('edit');
    } finally {
      turnstile.reset();
    }
  }

  let content;
  if (phase === 'sent' && sentSong) {
    content = (
      <section className="rq-done" aria-labelledby="rq-done-title">
        <div className="rq-done__badge" aria-hidden="true">
          <Check size={30} strokeWidth={3} />
        </div>
        <h2 id="rq-done-title" ref={doneTitle} tabIndex={-1} className="rq-done__title">
          The DJ has your request
        </h2>
        <SongSummary song={sentSong} />
        <Button className="rq-button-lg rq-button-block" onClick={requestAnother}>
          Request another
        </Button>
      </section>
    );
  } else if (pick) {
    const song = pickedSong(pick);
    const sending = phase === 'sending';
    content = (
      <form
        className="rq-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <section className="rq-card" aria-labelledby="rq-card-title">
          <div className="rq-card__head">
            <h2 id="rq-card-title" ref={cardTitle} tabIndex={-1} className="rq-card__label">
              Your song
            </h2>
            <Button variant="secondary" className="rq-change" onClick={change} disabled={sending}>
              Change
            </Button>
          </div>
          <SongSummary song={song} />
          {fieldErrors.song && <p className="ui-field__error rq-card__error">{fieldErrors.song}</p>}
        </section>

        <Field
          id="rq-name"
          label="Your name"
          optional
          autoComplete="given-name"
          maxLength={NAME_MAX}
          value={name}
          error={fieldErrors.name}
          hint={`${name.length}/${NAME_MAX}`}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) dropFieldError('name');
          }}
        />
        <Field
          id="rq-note"
          as="textarea"
          label="Note for the DJ"
          optional
          rows={3}
          maxLength={NOTE_MAX}
          placeholder="Shout-out, occasion, dedication…"
          value={note}
          error={fieldErrors.note}
          hint={`${note.length}/${NOTE_MAX}`}
          onChange={(e) => {
            setNote(e.target.value);
            if (fieldErrors.note) dropFieldError('note');
          }}
        />

        {failure && (
          <div className="rq-notice rq-notice--error" role="alert">
            <p>{failure}</p>
            <Button variant="secondary" className="rq-retry" onClick={submit} disabled={sending || wait > 0}>
              Try again
            </Button>
          </div>
        )}

        <Button type="submit" className="rq-button-lg rq-button-block" disabled={sending || wait > 0}>
          {sending ? 'Sending…' : wait > 0 ? `You can send another in ${wait} s` : 'Send request'}
        </Button>
      </form>
    );
  } else {
    content = <SongSearch query={query} onQueryChange={setQuery} onPick={choose} inputRef={searchInput} />;
  }

  return (
    <>
      {content}
      <div ref={turnstileBox} className="rq-turnstile" />
    </>
  );
}

export default function RequestPage() {
  const status = useLiveStatus();
  const [preview] = useState(previewOpen);
  const [closedByServer, setClosedByServer] = useState(false);

  const loading = status.loading && !preview;
  const open = !closedByServer && (preview || status.requestsOpen);

  return (
    <div className="rq-page">
      <main className="rq-main">
        <Header eventName={status.eventName} />
        {loading ? (
          <p className="rq-loading" role="status">
            <span className="rq-spinner" aria-hidden="true" />
            Loading…
          </p>
        ) : open ? (
          <OpenRequests onClosed={() => setClosedByServer(true)} />
        ) : (
          <Closed />
        )}
      </main>
    </div>
  );
}
