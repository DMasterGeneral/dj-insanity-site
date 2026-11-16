import { useEffect, useState } from 'react';
import { Check, Clock, Disc3, X } from 'lucide-react';
import { ApiError, apiGet } from '../../lib/api.js';
import Button from '../../components/ui/Button.jsx';
import '../../components/ui/ui.css';
import './request.css';

// /request/thanks?rid=<request id>: where the tip payment returns to (plan section 4.2).
// Polls GET /api/requests/:id until the tip is paid or failed. Reads only; nothing depends on
// sessionStorage, so a forged or stale link just shows a neutral thank-you.

const POLL_MS = 2000;
const MAX_MS = 20000;
const RID_RE = /^[A-Za-z0-9_-]{20,40}$/;

/** @typedef {'generic'|'neutral'|'confirming'|'paid'|'failed'|'slow'} View */

const VIEWS = {
  generic: { icon: Check, title: 'Thanks!', text: 'Want to hear something else? Send another request.' },
  neutral: { icon: Check, title: 'Thanks!', text: 'Want to hear something else? Send another request.' },
  confirming: { icon: null, title: 'Confirming your tip…', text: 'This takes a few seconds.' },
  paid: { icon: Check, title: 'Thanks — your tip is in', text: 'The DJ has your request.' },
  failed: { icon: X, title: "The payment didn't go through", text: 'Please try again from the request page.' },
  slow: { icon: Clock, title: 'Thanks!', text: "We'll add it as soon as the payment clears." },
};

function initialView() {
  const rid = new URLSearchParams(window.location.search).get('rid');
  if (!rid) return { rid: null, view: /** @type {View} */ ('generic') };
  if (!RID_RE.test(rid)) return { rid: null, view: /** @type {View} */ ('neutral') };
  return { rid, view: /** @type {View} */ ('confirming') };
}

export default function Thanks() {
  const [{ rid, view: firstView }] = useState(initialView);
  const [view, setView] = useState(firstView);

  useEffect(() => {
    if (!rid) return undefined;
    let stopped = false;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let next;
    const controller = new AbortController();
    /** @param {View} v */
    const finish = (v) => {
      if (stopped) return;
      stopped = true;
      clearTimeout(next);
      clearTimeout(deadline);
      controller.abort();
      setView(v);
    };
    const deadline = setTimeout(() => finish('slow'), MAX_MS);

    async function poll() {
      try {
        const d = await apiGet(`/api/requests/${encodeURIComponent(rid)}`, { signal: controller.signal });
        if (d.tipState === 'paid' || d.tipState === 'failed') return finish(d.tipState);
      } catch (err) {
        if (stopped) return undefined;
        if (err instanceof ApiError && err.status === 404) return finish('neutral');
        // Anything else (server busy, offline): keep trying until the deadline.
      }
      if (!stopped) next = setTimeout(poll, POLL_MS);
      return undefined;
    }
    poll();

    return () => {
      stopped = true;
      clearTimeout(next);
      clearTimeout(deadline);
      controller.abort();
    };
  }, [rid]);

  const { icon: Icon, title, text } = VIEWS[view];
  const busy = view === 'confirming';

  return (
    <div className="rq-page">
      <main className="rq-main">
        <header className="rq-header">
          <a href="/" className="rq-brand">
            <Disc3 size={22} aria-hidden="true" />
            <span>DJ Insanity</span>
          </a>
        </header>
        <section className="rq-done" aria-live="polite" aria-busy={busy}>
          <div className={`rq-done__badge${view === 'failed' ? ' rq-done__badge--bad' : ''}`} aria-hidden="true">
            {busy ? <span className="rq-spinner rq-spinner--lg" /> : <Icon size={30} strokeWidth={3} />}
          </div>
          <h1 className="rq-done__title">{title}</h1>
          <p className="rq-done__text">{text}</p>
          {!busy && (
            <Button href="/request" className="rq-button-lg rq-button-block">
              Request a song
            </Button>
          )}
        </section>
      </main>
    </div>
  );
}
