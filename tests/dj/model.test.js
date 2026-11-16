import { describe, expect, it } from 'vitest';
import {
  formatAge,
  formatMoney,
  formatTimeRange,
  hasPaidTip,
  normalizeBooking,
  normalizeRequest,
  paidTipCents,
  sortBookings,
  sortNewest,
  sortTipsFirst,
  toMillis,
  tonightTotals,
} from '../../src/pages/dj/data/model.js';

const NOW = Date.UTC(2026, 10, 16, 3, 0, 0);
const MIN = 60 * 1000;

function req(id, { ago = 1, status = 'pending', tip = { amountCents: 0, state: 'none' }, ...rest } = {}) {
  return normalizeRequest(id, {
    song: { title: `Song ${id}`, artist: 'Artist', explicit: false },
    status,
    tip,
    createdAt: NOW - ago * MIN,
    ...rest,
  });
}

describe('toMillis', () => {
  it('reads Firestore Timestamps, Dates, numbers and {seconds} objects', () => {
    expect(toMillis({ toMillis: () => 123 })).toBe(123);
    expect(toMillis(new Date(5000))).toBe(5000);
    expect(toMillis(42)).toBe(42);
    expect(toMillis({ seconds: 2, nanoseconds: 5e6 })).toBe(2005);
  });
  it('returns null for anything else', () => {
    for (const v of [undefined, null, 'yesterday', NaN, {}, [], new Date('nope'), { toMillis: () => { throw new Error('x'); } }]) {
      expect(toMillis(v)).toBeNull();
    }
  });
});

describe('normalizeRequest', () => {
  it('maps a current request document', () => {
    const r = normalizeRequest('abc', {
      song: { title: ' Mr. Brightside ', artist: 'The Killers', explicit: false, artworkUrl: 'https://img.example/a.jpg' },
      note: 'For Jess',
      requesterName: 'Sam',
      status: 'pending',
      tip: { amountCents: 1000, state: 'paid', paymentIntentId: 'pi_1' },
      createdAt: { toMillis: () => NOW },
      updatedAt: { toMillis: () => NOW },
    });
    expect(r).toEqual({
      id: 'abc',
      title: 'Mr. Brightside',
      artist: 'The Killers',
      artworkUrl: 'https://img.example/a.jpg',
      explicit: false,
      url: null,
      note: 'For Jess',
      requesterName: 'Sam',
      status: 'pending',
      tip: { amountCents: 1000, state: 'paid' },
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('tolerates old 2025 test docs (type/content/title/tip:number/timestamp)', () => {
    const r = normalizeRequest('old1', { type: 'search', content: 'Hey Ya', title: 'Hey Ya - OutKast', tip: 5, timestamp: { seconds: 1 }, status: 'archived' });
    expect(r.title).toBe('Hey Ya - OutKast');
    expect(r.artist).toBe('');
    expect(r.tip).toEqual({ amountCents: 0, state: 'none' }); // a bare number was never verified
    expect(r.createdAt).toBeNull();
    expect(r.status).toBe('unknown');

    const link = normalizeRequest('old2', { type: 'link', content: 'https://open.spotify.com/track/1', tip: 0 });
    expect(link.url).toBe('https://open.spotify.com/track/1');
    expect(link.title).toBe('https://open.spotify.com/track/1');
  });

  it('never throws on odd shapes', () => {
    for (const data of [undefined, null, 7, 'x', [], { song: 'nope', tip: 'lots', note: 5 }, { song: { title: 9 }, tip: { amountCents: -5, state: 'paid' } }]) {
      const r = normalizeRequest('x', data);
      expect(r.id).toBe('x');
      expect(typeof r.title).toBe('string');
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.tip.amountCents).toBeGreaterThanOrEqual(0);
    }
    expect(normalizeRequest('x', { tip: { amountCents: 2.5, state: 'paid' } }).tip.amountCents).toBe(0);
    expect(normalizeRequest('x', { tip: { amountCents: 500, state: 'bogus' } }).tip.state).toBe('none');
  });

  it('keeps only https artwork and a real explicit flag', () => {
    expect(normalizeRequest('x', { song: { title: 'a', artworkUrl: 'http://x/a.jpg' } }).artworkUrl).toBeNull();
    expect(normalizeRequest('x', { song: { title: 'a', artworkUrl: 'javascript:alert(1)' } }).artworkUrl).toBeNull();
    expect(normalizeRequest('x', { song: { title: 'a', explicit: 'yes' } }).explicit).toBe(false);
    expect(normalizeRequest('x', { song: { title: 'a', explicit: true } }).explicit).toBe(true);
  });
});

describe('tip chip logic', () => {
  it('counts only tips whose state is paid', () => {
    const states = ['none', 'pending', 'paid', 'failed'];
    const got = states.map((state) => [state, paidTipCents(req('t', { tip: { amountCents: 1000, state } }))]);
    expect(got).toEqual([['none', 0], ['pending', 0], ['paid', 1000], ['failed', 0]]);
    expect(hasPaidTip(req('t', { tip: { amountCents: 1000, state: 'paid' } }))).toBe(true);
    expect(hasPaidTip(req('t', { tip: { amountCents: 1000, state: 'failed' } }))).toBe(false);
    expect(hasPaidTip(req('t', { tip: { amountCents: 0, state: 'paid' } }))).toBe(false);
  });
});

describe('sorting', () => {
  const list = [
    req('a', { ago: 10 }),
    req('b', { ago: 2, tip: { amountCents: 500, state: 'paid' } }),
    req('c', { ago: 5, tip: { amountCents: 2000, state: 'paid' } }),
    req('d', { ago: 1 }),
    req('e', { ago: 3, tip: { amountCents: 5000, state: 'failed' } }),
    req('f', { ago: 8, tip: { amountCents: 500, state: 'paid' } }),
  ];

  it('newest first', () => {
    expect(sortNewest(list).map((r) => r.id)).toEqual(['d', 'b', 'e', 'c', 'f', 'a']);
  });

  it('tips first, ties (and no tip) by time, unpaid tips ignored', () => {
    expect(sortTipsFirst(list).map((r) => r.id)).toEqual(['c', 'b', 'f', 'd', 'e', 'a']);
  });

  it('does not mutate the input', () => {
    const ids = list.map((r) => r.id);
    sortTipsFirst(list);
    sortNewest(list);
    expect(list.map((r) => r.id)).toEqual(ids);
  });
});

describe('tonightTotals', () => {
  it('counts the last 12 hours: pending, played, and paid tips only', () => {
    const list = [
      req('p1', { ago: 5, tip: { amountCents: 1000, state: 'paid' } }),
      req('p2', { ago: 60, tip: { amountCents: 700, state: 'pending' } }),
      req('pl', { ago: 30, status: 'played', tip: { amountCents: 500, state: 'paid' } }),
      req('ds', { ago: 40, status: 'dismissed', tip: { amountCents: 300, state: 'paid' } }),
      req('fail', { ago: 3, tip: { amountCents: 9900, state: 'failed' } }),
      req('old', { ago: 13 * 60, status: 'played', tip: { amountCents: 4000, state: 'paid' } }),
      normalizeRequest('legacy', { title: 'Old', tip: 20, status: 'pending' }),
    ];
    expect(tonightTotals(list, NOW)).toEqual({ pending: 3, played: 1, tipsCents: 1800 });
  });
});

describe('bookings', () => {
  it('normalises and labels event types, tolerating odd docs', () => {
    const b = normalizeBooking('b1', {
      name: 'Priya', phone: '+15555550142', contactPreference: 'text', date: '2026-12-01',
      startTime: '20:00', endTime: '01:00', eventType: 'club_bar', status: 'contacted', createdAt: NOW,
    });
    expect(b.eventTypeLabel).toBe('Club / bar');
    expect(b.status).toBe('contacted');
    expect(b.email).toBeNull();

    const odd = normalizeBooking('b2', { status: 'weird', date: 'soon', eventType: 'rave', timestamp: { seconds: 3 } });
    expect(odd).toMatchObject({ name: 'No name given', status: 'new', date: null, eventTypeLabel: 'rave', createdAt: 3000 });
    expect(() => normalizeBooking('b3', null)).not.toThrow();
  });

  it('sorts upcoming soonest first, then past most recent first, then undated', () => {
    const mk = (id, date, startTime = '18:00') => normalizeBooking(id, { name: id, date, startTime, endTime: '22:00', createdAt: NOW });
    const list = [mk('past-old', '2026-01-01'), mk('later', '2026-12-24'), mk('nodate', ''), mk('today-late', '2026-11-16', '21:00'), mk('today-early', '2026-11-16', '12:00'), mk('past-recent', '2026-11-10')];
    expect(sortBookings(list, '2026-11-16').map((b) => b.id)).toEqual(['today-early', 'today-late', 'later', 'past-recent', 'past-old', 'nodate']);
  });
});

describe('formatting', () => {
  it('formats ages, money and time ranges', () => {
    expect(formatAge(NOW - 20 * 1000, NOW)).toBe('just now');
    expect(formatAge(NOW - 4 * MIN, NOW)).toBe('4 min ago');
    expect(formatAge(NOW - 125 * MIN, NOW)).toBe('2 h ago');
    expect(formatAge(null, NOW)).toBe('unknown time');
    expect(formatMoney(1000)).toBe('$10');
    expect(formatMoney(1250)).toBe('$12.50');
    expect(formatTimeRange('20:00', '01:00')).toBe('8:00 PM – 1:00 AM (5 h)');
    expect(formatTimeRange('18:30', '21:00')).toBe('6:30 PM – 9:00 PM (2 h 30 min)');
    expect(formatTimeRange(null, null)).toBeNull();
  });
});
