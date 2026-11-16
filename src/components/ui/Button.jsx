import './ui.css';

/**
 * Button, or a link styled as one when `href` is given.
 * @param {{ variant?: 'primary'|'secondary'|'ghost', size?: 'md'|'sm', href?: string, className?: string } & Record<string, any>} props
 */
export default function Button({ variant = 'primary', size = 'md', href, className = '', type, ...rest }) {
  const cls = ['ui-button', `ui-button--${variant}`, size === 'sm' && 'ui-button--sm', className].filter(Boolean).join(' ');
  if (href !== undefined) return <a href={href} className={cls} {...rest} />;
  return <button type={type || 'button'} className={cls} {...rest} />;
}
