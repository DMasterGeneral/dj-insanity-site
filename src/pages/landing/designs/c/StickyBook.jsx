import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { site } from '../../../../content/site.js';

/**
 * Phone-only floating "Book" button, bottom-right. Hidden while the hero's own Book button is on
 * screen, and for good once the booking section has scrolled into view (or past), so it never sits
 * over the form. CSS hides it on wide screens.
 * @param {{ heroCta: React.RefObject<HTMLElement|null> }} props
 */
export default function StickyBook({ heroCta }) {
  const [heroVisible, setHeroVisible] = useState(true);
  const [reachedBook, setReachedBook] = useState(false);

  useEffect(() => {
    const book = document.getElementById(site.bookCta.href.slice(1));
    const hero = heroCta.current;
    if (!book || !hero || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === hero) setHeroVisible(e.isIntersecting);
        // Book is on screen, or above it (scrolled past).
        else setReachedBook(e.isIntersecting || e.boundingClientRect.top < 0);
      }
    });
    io.observe(hero);
    io.observe(book);
    return () => io.disconnect();
  }, [heroCta]);

  const shown = !heroVisible && !reachedBook;

  return (
    <a
      className={`c-sticky${shown ? ' is-shown' : ''}`}
      href={site.bookCta.href}
      aria-hidden={shown ? undefined : 'true'}
      tabIndex={shown ? undefined : -1}
    >
      {site.bookCta.label}
      <ArrowRight aria-hidden="true" />
    </a>
  );
}
