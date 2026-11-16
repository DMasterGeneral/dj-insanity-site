import { source } from './data/source.js';

/** Shared page frame: theme root, demo ribbon in demo mode, optional centred column. */
export default function Frame({ children, narrow = false, ribbon = true }) {
  return (
    <div className="dj-app">
      {ribbon && source.isDemo && (
        <p className="dj-ribbon">
          <strong>Demo data</strong> — nothing here is real, and changes stay in this tab.
        </p>
      )}
      {narrow ? <div className="dj-center">{children}</div> : children}
    </div>
  );
}
