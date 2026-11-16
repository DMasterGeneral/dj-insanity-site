import { useState } from 'react';
import { Field } from '../../components/ui';
import { source } from './data/source.js';
import QrCard from './QrCard.jsx';

/** On/off switch: a button with role="switch", its label and an optional note. */
function Switch({ id, label, note, checked, onChange }) {
  return (
    <div className="dj-switch-row">
      <div className="dj-switch-row__text">
        <span id={`${id}-label`} className="dj-switch-row__label">
          {label}
        </span>
        {note && (
          <span id={`${id}-note`} className="dj-muted dj-switch-row__note">
            {note}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={note ? `${id}-note` : undefined}
        className="dj-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="dj-switch__thumb" aria-hidden="true" />
        <span className="dj-switch__state" aria-hidden="true">
          {checked ? 'On' : 'Off'}
        </span>
      </button>
    </div>
  );
}

function formatUpdated(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return sameDay ? `today at ${time}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
}

/**
 * @param {{ settings: { live: boolean, requestsOpen: boolean, tipsEnabled: boolean, eventName?: string|null, updatedAt: number|null },
 *           loading: boolean, notify: (text: string) => void }} props
 */
export default function ControlsTab({ settings, loading, notify }) {
  // null while not editing, so the field follows the saved value until the DJ starts typing.
  const [draft, setDraft] = useState(/** @type {string|null} */ (null));
  const saved = settings.eventName || '';
  const updated = formatUpdated(settings.updatedAt);

  function save(patch, message) {
    source.updateSettings(patch).then(
      () => message && notify(message),
      () => notify("Couldn't save that. Check the connection and try again."),
    );
  }

  function commitName() {
    if (draft === null) return;
    const next = draft.trim();
    setDraft(null);
    if (next !== saved) save({ eventName: next || null }, next ? 'Event name saved.' : 'Event name cleared.');
  }

  return (
    <div className="dj-stack">
      <section className="dj-card dj-controls" aria-labelledby="dj-controls-title">
        <h2 id="dj-controls-title" className="dj-section-title">
          Event controls
        </h2>
        {loading ? (
          <p className="dj-empty" role="status">
            Loading settings…
          </p>
        ) : (
          <>
            <Switch
              id="dj-live"
              label="Live"
              note="Shows the “Live now” banner on the website."
              checked={settings.live}
              onChange={(v) => save({ live: v })}
            />
            <Switch
              id="dj-open"
              label="Requests open"
              note="When off, the request page says requests are closed."
              checked={settings.requestsOpen}
              onChange={(v) => save({ requestsOpen: v })}
            />
            <Switch
              id="dj-tips"
              label="Tips"
              note="Tips also need Stripe to be set up."
              checked={settings.tipsEnabled}
              onChange={(v) => save({ tipsEnabled: v })}
            />
            <Field
              id="dj-event-name"
              label="Event name"
              optional
              hint="Saved when you leave the field or press Enter."
              maxLength={80}
              autoComplete="off"
              value={draft ?? saved}
              onFocus={() => setDraft(saved)}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.currentTarget.blur();
                } else if (e.key === 'Escape') {
                  setDraft(saved);
                }
              }}
            />
            <p className="dj-muted dj-updated">{updated ? `Last changed ${updated}.` : 'Not changed yet.'}</p>
          </>
        )}
      </section>
      <QrCard notify={notify} />
    </div>
  );
}
