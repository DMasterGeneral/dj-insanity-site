import { useCallback, useEffect, useRef, useState } from 'react';

export const BASE_TITLE = 'DJ Dashboard';
const HIGHLIGHT_MS = 4000;
const EMPTY = [];

/** A short two-tone beep, generated (no audio file). @param {AudioContext} ctx */
function beep(ctx) {
  const t = ctx.currentTime;
  for (const [i, freq] of [880, 1320].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = t + i * 0.14;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.13);
  }
}

/**
 * Spots requests that arrive after the first load. Returns the ids to highlight, a sentence for
 * the live region, and the alerts switch. With alerts on, each arrival beeps, vibrates and adds
 * to a count in the tab title; the count clears when the tab gets focus.
 * @param {{ id: string, title: string, artist: string }[]} requests  every request the listener returned
 * @param {boolean} loading
 */
export function useNewRequestAlerts(requests, loading) {
  const [track, setTrack] = useState({ source: /** @type {any} */ (null), ids: /** @type {Set<string>|null} */ (null), fresh: EMPTY, batch: 0 });
  const [clearedBatch, setClearedBatch] = useState(0);
  const [alertsOn, setAlertsOn] = useState(false);
  const audioRef = useRef(/** @type {AudioContext|null} */ (null));
  const handledBatch = useRef(0);
  const titleCount = useRef(0);

  // Compare with the previous list during render (React's "adjust state on prop change" pattern).
  if (!loading && track.source !== requests) {
    const ids = new Set(track.ids || []);
    const fresh = [];
    for (const r of requests) {
      if (ids.has(r.id)) continue;
      ids.add(r.id);
      if (track.ids) fresh.push(r);
    }
    setTrack({ source: requests, ids, fresh: fresh.length ? fresh : track.fresh, batch: track.batch + (fresh.length ? 1 : 0) });
  }

  useEffect(() => {
    if (!track.batch) return undefined;
    const batch = track.batch;
    const timer = setTimeout(() => setClearedBatch(batch), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [track.batch]);

  useEffect(() => {
    if (track.batch === handledBatch.current) return;
    handledBatch.current = track.batch;
    if (!alertsOn) return;
    if (audioRef.current) {
      try {
        beep(audioRef.current);
      } catch {
        /* audio is a nice-to-have */
      }
    }
    if (typeof navigator.vibrate === 'function') navigator.vibrate([120, 80, 120]);
    titleCount.current += track.fresh.length;
    document.title = `(${titleCount.current}) ${BASE_TITLE}`;
  }, [track, alertsOn]);

  useEffect(() => {
    const previous = document.title;
    document.title = BASE_TITLE;
    function clear() {
      if (document.visibilityState !== 'visible' || !titleCount.current) return;
      titleCount.current = 0;
      document.title = BASE_TITLE;
    }
    window.addEventListener('focus', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('focus', clear);
      document.removeEventListener('visibilitychange', clear);
      document.title = previous;
    };
  }, []);

  useEffect(
    () => () => {
      if (audioRef.current) audioRef.current.close().catch(() => {});
    },
    [],
  );

  /** Must be called from a tap/click: that gesture is what lets the page play sound. */
  const toggleAlerts = useCallback(() => {
    if (alertsOn) {
      setAlertsOn(false);
      return;
    }
    const Ctx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (Ctx) {
      try {
        if (!audioRef.current) audioRef.current = new Ctx();
        audioRef.current.resume().catch(() => {});
        beep(audioRef.current);
      } catch {
        /* no audio on this device; vibration and the title count still work */
      }
    }
    setAlertsOn(true);
  }, [alertsOn]);

  const highlighted = track.batch > clearedBatch ? new Set(track.fresh.map((r) => r.id)) : null;
  const announcement = track.fresh.length
    ? track.fresh.length === 1
      ? `New request: ${track.fresh[0].title}${track.fresh[0].artist ? ` by ${track.fresh[0].artist}` : ''}`
      : `${track.fresh.length} new requests`
    : '';

  return { highlighted, announcement, alertsOn, toggleAlerts };
}
