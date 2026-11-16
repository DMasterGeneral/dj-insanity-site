import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './ui.css';

/**
 * A short status message announced politely to screen readers. The live region is always in the
 * page (so announcements are not missed); it shows a toast while `message` is set.
 * Render it inside your design root so it picks up your --ui-* variables.
 *
 *   const [msg, setMsg] = useState(null);
 *   <Toast message={msg} onClose={() => setMsg(null)} />
 *
 * @param {{ message: React.ReactNode | null, onClose?: () => void, duration?: number,
 *           action?: { label: string, onClick: () => void }, className?: string }} props
 *   duration: ms before onClose is called automatically (0 = stay until closed). Default 5000.
 */
export default function Toast({ message, onClose, duration = 5000, action, className = '' }) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!message || !duration) return undefined;
    const t = setTimeout(() => onCloseRef.current?.(), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  return (
    <div className={`ui-toast-region ${className}`.trim()} role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div className="ui-toast">
          <span className="ui-toast__message">{message}</span>
          {action && (
            <button type="button" className="ui-button ui-button--secondary ui-button--sm" onClick={action.onClick}>
              {action.label}
            </button>
          )}
          {onClose && (
            <button type="button" className="ui-toast__close" onClick={onClose} aria-label="Dismiss">
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
