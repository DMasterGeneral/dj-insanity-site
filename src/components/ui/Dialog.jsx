import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './ui.css';

const FOCUSABLE =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [contenteditable], [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog rendered into document.body: focus moves in on open, Tab is trapped, Escape and a
 * backdrop click close it, and focus returns to whatever had it before.
 *
 * It renders outside your design's root, so it does not inherit your --ui-* variables by itself.
 * Pass a class through `className` (added to the backdrop) and set your variables on it too, e.g.
 *   .design-a, .design-a-portal { --ui-accent: … }   <Dialog className="design-a-portal" …>
 *
 * `dismissible={false}` (e.g. while a payment is confirming) hides the close button and ignores
 * Escape and backdrop clicks until it is true again.
 *
 * @param {{ open: boolean, onClose: () => void, title: React.ReactNode, children?: React.ReactNode,
 *           className?: string, closeLabel?: string, dismissible?: boolean }} props
 */
export default function Dialog({ open, onClose, title, children, className = '', closeLabel = 'Close', dismissible = true }) {
  const titleId = useId();
  const dialogRef = useRef(/** @type {HTMLDivElement|null} */ (null));
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  }, [onClose, dismissible]);

  useEffect(() => {
    if (!open) return undefined;
    const previous = /** @type {HTMLElement|null} */ (document.activeElement);
    const dialog = dialogRef.current;
    const first = dialog?.querySelector(FOCUSABLE);
    // Focus the first control that is not the close button, else the dialog itself.
    const target = [...(dialog?.querySelectorAll(FOCUSABLE) || [])].find((el) => !el.classList.contains('ui-dialog__close'));
    /** @type {HTMLElement|null|undefined} */ (target || first || dialog)?.focus();

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    /** @param {KeyboardEvent} e */
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (dismissibleRef.current) onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = /** @type {HTMLElement[]} */ ([...dialog.querySelectorAll(FOCUSABLE)]).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === firstItem || !dialog.contains(active))) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (active === lastItem || !dialog.contains(active))) {
        e.preventDefault();
        firstItem.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className={`ui-dialog-backdrop ${className}`.trim()}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className="ui-dialog__title">
          {title}
        </h2>
        {dismissible && (
          <button type="button" className="ui-dialog__close" onClick={onClose} aria-label={closeLabel}>
            <X size={20} aria-hidden="true" />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
