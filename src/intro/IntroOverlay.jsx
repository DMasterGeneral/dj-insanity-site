import { useCallback, useEffect, useRef, useState } from 'react';
import { ENGINES, INTRO, introOverride } from './config';
import './intro.css';

// Plays over the already-rendered landing page, once per browser session.
const SEEN_KEY = 'dj-intro-seen';
const FADE_MS = 400;
const SCROLL_KEYS = new Set([' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']);

let seenThisLoad = false; // used when sessionStorage is unavailable: once per page load

function seenThisSession() {
  if (seenThisLoad) return true;
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen() {
  seenThisLoad = true;
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    // storage blocked: seenThisLoad covers this page load
  }
}

function choosePlan() {
  const override = introOverride(window.location.search);
  if (override?.off) return null;
  if (!override && seenThisSession()) return null;
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return override
    ? { engine: override.engine, speed: override.speed, reducedMotion }
    : { engine: INTRO.engine, speed: INTRO.speed, reducedMotion };
}

export default function IntroOverlay() {
  const [plan] = useState(choosePlan);
  const [phase, setPhase] = useState(plan ? 'playing' : 'off'); // playing -> closing (fade) -> off
  const overlayRef = useRef(null);
  const stageRef = useRef(null);
  const ctlRef = useRef(null);
  const closingRef = useRef(false);
  const active = phase !== 'off';

  const close = useCallback(() => {
    closingRef.current = true;
    setPhase((p) => (p === 'playing' ? 'closing' : p));
  }, []);

  const skip = useCallback(() => {
    try {
      ctlRef.current?.skip();
    } catch {
      // closing anyway
    }
    close();
  }, [close]);

  // Load and run the engine; block background scrolling while the overlay is up.
  useEffect(() => {
    if (!active) return undefined;
    markSeen();
    const overlay = overlayRef.current;
    let cancelled = false;
    const fail = (err) => {
      if (cancelled) return;
      console.warn('Intro failed, removing it:', err);
      setPhase('off');
    };
    Promise.resolve()
      .then(() => ENGINES[plan.engine]())
      .then((engine) => {
        if (cancelled || closingRef.current) return;
        ctlRef.current = engine.play(stageRef.current, {
          speed: plan.speed,
          reducedMotion: plan.reducedMotion,
          onComplete: close,
          onError: fail,
        });
      })
      .catch(fail);
    const stopScroll = (e) => e.preventDefault();
    overlay.addEventListener('wheel', stopScroll, { passive: false });
    overlay.addEventListener('touchmove', stopScroll, { passive: false });
    return () => {
      cancelled = true;
      overlay.removeEventListener('wheel', stopScroll);
      overlay.removeEventListener('touchmove', stopScroll);
      ctlRef.current?.destroy();
      ctlRef.current = null;
    };
  }, [active, plan, close]);

  // Any key skips.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const onKey = (e) => {
      if (SCROLL_KEYS.has(e.key)) e.preventDefault();
      skip();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, skip]);

  // Fade out, then unmount.
  useEffect(() => {
    if (phase !== 'closing') return undefined;
    const id = setTimeout(() => setPhase('off'), FADE_MS);
    return () => clearTimeout(id);
  }, [phase]);

  if (!active) return null;
  return (
    <div
      ref={overlayRef}
      className="intro-overlay"
      data-closing={phase === 'closing' ? '' : undefined}
      onClick={skip}
    >
      <div ref={stageRef} className="intro-stage" />
      <button type="button" className="intro-skip" onClick={skip}>
        Skip intro
      </button>
    </div>
  );
}
