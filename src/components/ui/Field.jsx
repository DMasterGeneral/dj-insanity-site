import './ui.css';

/**
 * A labelled form control with an optional hint and error message.
 * The control gets aria-describedby (hint + error) and aria-invalid when `error` is set.
 * All other props (value, onChange, onBlur, type, required, autoComplete, ref…) go to the control.
 *
 *   <Field id="a-name" label="Your name" error={errors.name} value={v} onChange={…} />
 *   <Field as="select" id="a-type" label="Event type">{options}</Field>
 *
 * @param {{
 *   id: string, label: React.ReactNode, as?: 'input'|'textarea'|'select', hint?: React.ReactNode,
 *   error?: string|null, optional?: boolean, className?: string, controlClassName?: string,
 *   children?: React.ReactNode,
 * } & Record<string, any>} props
 */
export default function Field({
  id,
  label,
  as = 'input',
  hint,
  error,
  optional = false,
  className = '',
  controlClassName = '',
  children,
  ...controlProps
}) {
  const Control = as;
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`ui-field ${className}`.trim()}>
      <label className="ui-field__label" htmlFor={id}>
        {label}
        {optional && <span className="ui-field__optional"> (optional)</span>}
      </label>
      <Control
        id={id}
        className={`ui-field__control ${controlClassName}`.trim()}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        {...controlProps}
      >
        {children}
      </Control>
      {hint && (
        <p id={hintId} className="ui-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="ui-field__error">
          {error}
        </p>
      )}
    </div>
  );
}
