import { PRODUCTION_HOSTS, isPlaceholder, textOf } from '../content/site.js';
import './ui/ui.css';

const SHOW_TAGS = typeof window === 'undefined' || !PRODUCTION_HOSTS.includes(window.location.hostname);

/**
 * Marks placeholder content from site.js with a small "sample" tag (hidden on production hosts).
 *
 *   <Sample value={site.city} />                          a site.js string, plain or { text, placeholder }
 *   <Sample when={item.placeholder}>…</Sample>            any inline content
 *   <Sample as="div" block when={t.placeholder}>…</Sample>  a card: the tag sits in its top-right corner
 *
 * `value` mode returns the bare string when there is no tag to show. `children` mode always renders
 * the wrapper element (`as`, default span), so your layout is the same with or without the tag.
 *
 * @param {{ value?: any, when?: boolean, as?: string, block?: boolean, className?: string,
 *           children?: React.ReactNode }} props
 */
export default function Sample({ value, when, as = 'span', block = false, className = '', children }) {
  const Tag = as;
  const showTag = SHOW_TAGS && (when ?? isPlaceholder(value));
  const tag = showTag && (
    <span className="ui-sample-tag" title="Sample content, not confirmed yet">
      sample
    </span>
  );
  if (children === undefined) {
    const text = textOf(value);
    return showTag ? <span className="ui-sample">{text}{tag}</span> : text;
  }
  return (
    <Tag className={['ui-sample', block && 'ui-sample--block', className].filter(Boolean).join(' ')}>
      {children}
      {tag}
    </Tag>
  );
}
