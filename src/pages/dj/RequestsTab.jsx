import { useState } from 'react';
import { Bell, BellOff, Check, Music, RotateCcw, X } from 'lucide-react';
import { source } from './data/source.js';
import { formatAge, formatMoney, hasPaidTip, sortNewest, sortTipsFirst, tonightTotals } from './data/model.js';

/**
 * @param {{
 *   requests: import('./data/model.js').DashRequest[], loading: boolean, now: number,
 *   highlighted: Set<string>|null, alertsOn: boolean, onToggleAlerts: () => void,
 *   notify: (text: string, action?: { label: string, onClick: () => void }) => void, closeToast: () => void,
 * }} props
 */
export default function RequestsTab({ requests, loading, now, highlighted, alertsOn, onToggleAlerts, notify, closeToast }) {
  const [sort, setSort] = useState(/** @type {'newest'|'tips'} */ ('newest'));
  const [showDone, setShowDone] = useState(false);

  const totals = tonightTotals(requests, now);
  const sorter = sort === 'tips' ? sortTipsFirst : sortNewest;
  const pending = sorter(requests.filter((r) => r.status === 'pending'));
  const done = showDone
    ? requests.filter((r) => r.status !== 'pending').sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    : [];

  function setStatus(r, status) {
    const verb = status === 'played' ? 'Played' : 'Dismissed';
    const undo = () => {
      closeToast();
      source.setRequestStatus(r.id, 'pending').catch(() => notify("Couldn't undo. Check the connection and try again."));
    };
    notify(`${verb}: ${r.title}`, { label: 'Undo', onClick: undo });
    source.setRequestStatus(r.id, status).catch(() => notify("Couldn't save that. Check the connection and try again."));
  }

  function restore(r) {
    source.setRequestStatus(r.id, 'pending').then(
      () => notify(`Back in the queue: ${r.title}`),
      () => notify("Couldn't save that. Check the connection and try again."),
    );
  }

  return (
    <div className="dj-stack">
      <section className="dj-tonight" aria-labelledby="dj-tonight-title">
        <h2 id="dj-tonight-title" className="dj-tonight__title">
          Tonight <span className="dj-muted">(last 12 hours)</span>
        </h2>
        <dl className="dj-tonight__stats">
          <div>
            <dt>Waiting</dt>
            <dd>{totals.pending}</dd>
          </div>
          <div>
            <dt>Played</dt>
            <dd>{totals.played}</dd>
          </div>
          <div className="is-gold">
            <dt>Tips</dt>
            <dd>{formatMoney(totals.tipsCents)}</dd>
          </div>
        </dl>
      </section>

      <div className="dj-toolbar">
        <div className="dj-segmented" role="group" aria-label="Sort requests">
          <button type="button" aria-pressed={sort === 'newest'} onClick={() => setSort('newest')}>
            Newest
          </button>
          <button type="button" aria-pressed={sort === 'tips'} onClick={() => setSort('tips')}>
            Tips first
          </button>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={alertsOn}
          className={`dj-chip-toggle ${alertsOn ? 'is-on' : ''}`}
          onClick={onToggleAlerts}
        >
          {alertsOn ? <Bell size={18} aria-hidden="true" /> : <BellOff size={18} aria-hidden="true" />}
          Alerts {alertsOn ? 'on' : 'off'}
        </button>
        <label className="dj-check">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show played/dismissed
        </label>
      </div>

      {loading ? (
        <p className="dj-empty" role="status">
          Loading requests…
        </p>
      ) : pending.length === 0 ? (
        <p className="dj-empty">No requests waiting. Guests can scan the QR code on the Controls tab.</p>
      ) : (
        <ul className="dj-cards" aria-label="Waiting requests">
          {pending.map((r) => (
            <RequestCard key={r.id} r={r} now={now} isNew={!!highlighted?.has(r.id)}>
              <button type="button" className="dj-action dj-action--played" onClick={() => setStatus(r, 'played')}>
                <Check size={22} aria-hidden="true" /> Played
                <span className="dj-sr-only">: {r.title}</span>
              </button>
              <button type="button" className="dj-action dj-action--dismiss" onClick={() => setStatus(r, 'dismissed')}>
                <X size={22} aria-hidden="true" /> Dismiss
                <span className="dj-sr-only">: {r.title}</span>
              </button>
            </RequestCard>
          ))}
        </ul>
      )}

      {showDone && (
        <section aria-labelledby="dj-done-title" className="dj-stack">
          <h2 id="dj-done-title" className="dj-section-title">
            Played &amp; dismissed
          </h2>
          {done.length === 0 ? (
            <p className="dj-empty">Nothing played or dismissed yet.</p>
          ) : (
            <ul className="dj-cards" aria-label="Played and dismissed requests">
              {done.map((r) => (
                <RequestCard key={r.id} r={r} now={now} done>
                  <button type="button" className="dj-action dj-action--restore" onClick={() => restore(r)}>
                    <RotateCcw size={20} aria-hidden="true" /> Back to queue
                    <span className="dj-sr-only">: {r.title}</span>
                  </button>
                </RequestCard>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** @param {{ r: import('./data/model.js').DashRequest, now: number, isNew?: boolean, done?: boolean, children: any }} props */
function RequestCard({ r, now, isNew = false, done = false, children }) {
  return (
    <li className={`dj-card dj-req ${isNew ? 'is-new' : ''} ${done ? 'is-done' : ''}`}>
      <div className="dj-req__top">
        {r.artworkUrl ? (
          <img className="dj-req__art" src={r.artworkUrl} alt="" width="64" height="64" loading="lazy" decoding="async" />
        ) : (
          <span className="dj-req__art dj-req__art--blank" aria-hidden="true">
            <Music size={26} />
          </span>
        )}
        <div className="dj-req__body">
          <p className="dj-req__title">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer">
                {r.title}
              </a>
            ) : (
              r.title
            )}
            {r.explicit && (
              <span className="dj-badge" title="Explicit">
                E<span className="dj-sr-only">xplicit</span>
              </span>
            )}
          </p>
          {r.artist && <p className="dj-req__artist">{r.artist}</p>}
          <p className="dj-req__meta">
            {isNew && <span className="dj-new-tag">New</span>}
            {done && <span className={`dj-status dj-status--${r.status}`}>{r.status === 'played' ? 'Played' : 'Dismissed'}</span>}
            <span>{formatAge(r.createdAt, now)}</span>
            {r.requesterName && <span>from {r.requesterName}</span>}
          </p>
        </div>
        {hasPaidTip(r) && (
          <span className="dj-tip">
            {formatMoney(r.tip.amountCents)}
            <span className="dj-sr-only"> tip</span>
          </span>
        )}
      </div>
      {r.note && <p className="dj-req__note">“{r.note}”</p>}
      <div className="dj-req__actions">{children}</div>
    </li>
  );
}
