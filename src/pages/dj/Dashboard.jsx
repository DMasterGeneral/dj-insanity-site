import { useEffect, useId, useRef, useState } from 'react';
import { Disc, ListMusic, CalendarDays, SlidersHorizontal, LogOut, WifiOff } from 'lucide-react';
import { Button, Toast } from '../../components/ui';
import { choice, source } from './data/source.js';
import { useNewRequestAlerts } from './useNewRequestAlerts.js';
import Frame from './Frame.jsx';
import Login from './Login.jsx';
import NotAuthorised from './NotAuthorised.jsx';
import RequestsTab from './RequestsTab.jsx';
import BookingsTab from './BookingsTab.jsx';
import ControlsTab from './ControlsTab.jsx';
import './dj.css';

const CLOCK_MS = 30 * 1000;

export default function Dashboard() {
  if (choice.kind === 'demo' && !choice.demoRequested && !choice.configured) {
    return <NotConnected production={choice.production} />;
  }
  return <Gate />;
}

function NotConnected({ production }) {
  return (
    <Frame narrow ribbon={false}>
      <main className="dj-panel">
        <Disc className="dj-panel__icon" size={36} aria-hidden="true" />
        <h1 className="dj-panel__title">DJ dashboard</h1>
        <p>Dashboard isn&apos;t connected to a database in this build.</p>
        {!production && (
          <Button href="/dj?demo=1" className="dj-wide">
            View demo
          </Button>
        )}
      </main>
    </Frame>
  );
}

function Gate() {
  const auth = source.useAuth();
  const admin = source.useIsAdmin(auth.user);
  if (auth.loading || admin.loading) {
    return (
      <Frame narrow>
        <p className="dj-loading" role="status">
          Loading…
        </p>
      </Frame>
    );
  }
  if (!auth.user) return <Login signIn={auth.signIn} />;
  if (!admin.isAdmin) return <NotAuthorised email={auth.user.email} signOut={auth.signOut} />;
  return <Main signOut={auth.signOut} />;
}

const TABS = [
  { id: 'requests', label: 'Requests', Icon: ListMusic },
  { id: 'bookings', label: 'Bookings', Icon: CalendarDays },
  { id: 'controls', label: 'Controls', Icon: SlidersHorizontal },
];

function Main({ signOut }) {
  const baseId = useId();
  const [tab, setTab] = useState('requests');
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState(/** @type {{ node: any, action?: { label: string, onClick: () => void } }|null} */ (null));
  const tabRefs = useRef(/** @type {Record<string, HTMLButtonElement|null>} */ ({}));

  const req = source.useRequests({ includeDone: true });
  const book = source.useBookings();
  const set = source.useSettings();
  const alerts = useNewRequestAlerts(req.requests, req.loading);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(t);
  }, []);

  /** @param {string} text @param {{ label: string, onClick: () => void }} [action] */
  function notify(text, action) {
    // The node is created once here, so the toast's 5 s timer is not reset by later renders.
    setToast({ node: <span>{text}</span>, action });
  }
  const closeToast = () => setToast(null);

  const counts = {
    requests: req.requests.filter((r) => r.status === 'pending').length,
    bookings: book.bookings.filter((b) => b.status === 'new').length,
    controls: 0,
  };
  const connectionError = req.error || book.error || set.error;

  function onTabKeyDown(e) {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = TABS[(i + 1) % TABS.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = TABS[(i - 1 + TABS.length) % TABS.length];
    else if (e.key === 'Home') next = TABS[0];
    else if (e.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <Frame>
      <header className="dj-header">
        <div className="dj-brand">
          <Disc size={22} aria-hidden="true" />
          <span>
            DJ Insanity <span className="dj-brand__sub">Dashboard</span>
          </span>
        </div>
        <span className={`dj-onair ${set.settings.live ? 'is-live' : ''}`}>
          <span className="dj-onair__dot" aria-hidden="true" />
          {set.settings.live ? 'Live' : 'Off air'}
        </span>
        {!source.isDemo && (
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </Button>
        )}
      </header>

      {connectionError && (
        <p className="dj-notice" role="alert">
          <WifiOff size={18} aria-hidden="true" /> {connectionError}
        </p>
      )}

      <p className="dj-sr-only" aria-live="polite" aria-atomic="true">
        {alerts.announcement}
      </p>

      <main className="dj-main">
        {TABS.map((t) => (
          <section
            key={t.id}
            id={`${baseId}-panel-${t.id}`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${t.id}`}
            hidden={tab !== t.id}
            tabIndex={-1}
            className="dj-tabpanel"
          >
            {t.id === 'requests' && (
              <RequestsTab
                requests={req.requests}
                loading={req.loading}
                now={now}
                highlighted={alerts.highlighted}
                alertsOn={alerts.alertsOn}
                onToggleAlerts={alerts.toggleAlerts}
                notify={notify}
                closeToast={closeToast}
              />
            )}
            {t.id === 'bookings' && <BookingsTab bookings={book.bookings} loading={book.loading} now={now} notify={notify} />}
            {t.id === 'controls' && <ControlsTab settings={set.settings} loading={set.loading} notify={notify} />}
          </section>
        ))}
      </main>

      <div className="dj-tabbar">
        <div className="dj-tabbar__inner" role="tablist" aria-label="Dashboard sections" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.id}`}
              aria-controls={`${baseId}-panel-${t.id}`}
              aria-selected={tab === t.id}
              tabIndex={tab === t.id ? 0 : -1}
              className="dj-tab"
              onClick={() => setTab(t.id)}
            >
              <t.Icon size={22} aria-hidden="true" />
              <span className="dj-tab__label">{t.label}</span>
              {counts[t.id] > 0 && (
                <span className="dj-tab__count">
                  {counts[t.id]}
                  <span className="dj-sr-only">{t.id === 'requests' ? ' waiting' : ' new'}</span>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Toast className="dj-toast" message={toast ? toast.node : null} action={toast?.action} onClose={closeToast} />
    </Frame>
  );
}
