import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, X } from 'lucide-react';
import './DesignSwitcher.css';

// Floating "A · B · C · Classic" pill for comparing landing designs. Temporary: deleted once the
// owner picks a design. Bottom-left so it stays clear of each design's sticky Book button (bottom-right).
const OPTIONS = [
  { key: 'a', label: 'A', title: 'Design A: Club night', to: '/designs/a' },
  { key: 'b', label: 'B', title: 'Design B: Premium events', to: '/designs/b' },
  { key: 'c', label: 'C', title: 'Design C: Gig poster', to: '/designs/c' },
  { key: 'classic', label: 'Classic', title: 'Classic: the original landing page', to: '/classic' },
];

/** @param {{ current: string }} props */
export default function DesignSwitcher({ current }) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <nav className={`design-switcher${open ? '' : ' design-switcher--collapsed'}`} aria-label="Design options">
      <button
        type="button"
        className="design-switcher__toggle"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={open ? 'Hide design switcher' : 'Show design switcher'}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X size={16} aria-hidden="true" /> : <Layers size={18} aria-hidden="true" />}
      </button>
      <ul id={listId} className="design-switcher__list" hidden={!open}>
        {OPTIONS.map((o) => (
          <li key={o.key}>
            <Link
              to={o.to}
              className="design-switcher__link"
              aria-current={o.key === current ? 'page' : undefined}
              aria-label={o.title}
              title={o.title}
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
