// All landing-page copy and data, in one place. Every landing design imports from here only.
//
// PLACEHOLDERS — one shape, used everywhere in this file:
//   * A confirmed string is a plain string:            tagline: 'Weddings • Clubs • Private Events'
//   * An unconfirmed string is wrapped:                city: { text: 'Los Angeles', placeholder: true }
//   * An unconfirmed record (testimonial, gear item,
//     social link, photo…) carries the flag itself:    { quote: '…', author: '…', placeholder: true }
// Use `textOf(v)` to get the string out of either string form and `isPlaceholder(v)` to test any value.
// Render anything flagged through <Sample> (src/components/Sample.jsx), which adds a small "sample" tag
// on every host except production. When the DJ confirms a value, replace it with the plain string (or
// drop `placeholder: true` from the record) — nothing else needs to change.
//
// Rules (CLAUDE.md): never invent real-looking testimonials, venues, credentials, client names or awards.
// Sample testimonials are attributed to "Sample client". Contact details use reserved fake values
// (example.com, 555-01xx) until the real ones are supplied.

import { EVENT_TYPES } from '../../shared/contracts.js';

/** Hosts where the "sample" tags are hidden. */
export const PRODUCTION_HOSTS = ['dj-insanity-site.pages.dev'];

/**
 * The display string of a content value (plain string or `{ text, placeholder }`).
 * @param {string | { text: string, placeholder?: boolean } | null | undefined} v
 * @returns {string}
 */
export function textOf(v) {
  if (v == null) return '';
  return typeof v === 'string' ? v : v.text;
}

/**
 * True when a content value (wrapped string or record) is flagged as a placeholder.
 * @param {unknown} v
 */
export function isPlaceholder(v) {
  return typeof v === 'object' && v !== null && /** @type {any} */ (v).placeholder === true;
}

// Icon names below are lucide-react component names; src/content/icons.js maps them to components.

/** @type {Record<string, { icon: string, description: { text: string, placeholder: true } }>} */
const SERVICE_DETAILS = {
  wedding: {
    icon: 'Heart',
    description: { text: 'Ceremony, cocktail hour and reception, with your must-play and do-not-play lists.', placeholder: true },
  },
  birthday: {
    icon: 'Cake',
    description: { text: 'From milestone birthdays to backyard parties, music that suits the crowd.', placeholder: true },
  },
  corporate: {
    icon: 'Briefcase',
    description: { text: 'Background sets, announcements and an after-party when the work is done.', placeholder: true },
  },
  club_bar: {
    icon: 'Disc3',
    description: { text: 'Open-format club sets that read the room and keep the floor moving.', placeholder: true },
  },
  school: {
    icon: 'GraduationCap',
    description: { text: 'Dances, proms and graduations, with clean edits only.', placeholder: true },
  },
  private_party: {
    icon: 'PartyPopper',
    description: { text: 'House parties and private celebrations of any size.', placeholder: true },
  },
  other: {
    icon: 'Sparkles',
    description: { text: 'Something else in mind? Ask, and we will work it out together.', placeholder: true },
  },
};

export const site = {
  name: 'DJ Insanity',
  // From the original hero ("Elevating nightlife experiences with cutting-edge sound design.")
  tagline: 'Elevating nightlife experiences with cutting-edge sound design.',
  // The original hero's sub-line
  eventsLine: 'Weddings • Clubs • Private Events',

  // The original hero said "Live From LA"; not confirmed.
  city: { text: 'Los Angeles', placeholder: true },
  area: { text: 'Los Angeles and Southern California', placeholder: true },

  about: {
    heading: 'About',
    short: {
      text: 'Open-format DJ for weddings, parties and nights out. Reads the room, takes requests, and keeps the floor full from the first song to the last.',
      placeholder: true,
    },
    long: [
      {
        text: 'Every crowd is different, so every set is too. Before your event we talk through the music you love, the songs you never want to hear, and the moments that matter, then build the night around them.',
        placeholder: true,
      },
      {
        text: 'On the night, guests can request songs straight from their phones, and the mix moves between eras and genres to keep everyone dancing.',
        placeholder: true,
      },
    ],
  },

  // Photos: none confirmed yet. `src: null` means "no photo"; designs show a graphic instead.
  photos: {
    hero: { src: null, alt: 'DJ Insanity behind the decks', placeholder: true },
    about: { src: null, alt: 'DJ Insanity at an event', placeholder: true },
  },

  services: {
    heading: 'Events',
    intro: 'What I play',
    // Same values and labels as the booking form's event types (shared/contracts.js EVENT_TYPES).
    items: EVENT_TYPES.map((t) => ({ value: t.value, label: t.label, ...SERVICE_DETAILS[t.value] })),
  },

  // "What I bring" — from the original Gear Locker, without purchase prices. Not confirmed.
  gear: {
    heading: 'What I bring',
    intro: 'Professional sound, lighting and effects, set up and run by me.',
    items: [
      { icon: 'Disc3', name: 'Pioneer CDJ-3000', description: 'Professional DJ multi player', placeholder: true },
      { icon: 'SlidersHorizontal', name: 'DJM-A9 mixer', description: '4-channel professional mixer', placeholder: true },
      { icon: 'Speaker', name: 'QSC KW153 speakers', description: '15" 3-way active loudspeakers', placeholder: true },
      { icon: 'CloudFog', name: 'Fog machine', description: 'Chauvet Hurricane 1800 Flex', placeholder: true },
      { icon: 'Lightbulb', name: 'Moving head lights', description: 'ADJ Focus Spot 4Z', placeholder: true },
      { icon: 'Sparkles', name: 'Laser system', description: 'X-Laser Mobile Beat MAX', placeholder: true },
    ],
  },

  // Samples only. Real quotes replace these once the DJ supplies them (with permission to use them).
  testimonials: {
    heading: 'What people say',
    items: [
      { quote: 'Absolutely insane energy! Best DJ we have ever booked.', author: 'Sample client', event: 'Wedding', placeholder: true },
      { quote: 'Made our wedding unforgettable. 10/10 would recommend!', author: 'Sample client', event: 'Wedding', placeholder: true },
      { quote: 'The crowd was going crazy all night long.', author: 'Sample client', event: 'Club night', placeholder: true },
      { quote: 'Professional, punctual, and incredibly talented.', author: 'Sample client', event: 'Corporate event', placeholder: true },
      { quote: 'Knows exactly how to read the room.', author: 'Sample client', event: 'Birthday', placeholder: true },
      { quote: 'Booked for three events so far. Never disappoints!', author: 'Sample client', event: 'Private party', placeholder: true },
    ],
  },

  // Reserved fake values (example.com, 555-01xx) until the DJ supplies real ones.
  contact: {
    heading: 'Contact',
    intro: 'Questions before you book? Get in touch.',
    email: { text: 'bookings@example.com', href: 'mailto:bookings@example.com', placeholder: true },
    phone: { text: '(555) 010-0199', href: 'tel:+15550100199', placeholder: true },
  },

  socials: [
    { label: 'Instagram', icon: 'Instagram', href: 'https://www.instagram.com/', placeholder: true },
  ],

  booking: {
    heading: 'Book DJ Insanity',
    intro: 'Tell me about your event and I will check the date. Add a phone number or an email (or both) so I can reach you.',
    submitLabel: 'Check availability',
    sendingLabel: 'Sending…',
    success: {
      heading: 'Request received',
      // States how and when they will hear back; the response time is not confirmed.
      text: {
        text: 'Thanks! I will get back to you within 24 hours, by your preferred contact method, to confirm the date and talk details.',
        placeholder: true,
      },
    },
    failure: {
      heading: 'Your request was not sent',
      text: 'Something went wrong on our side. Your details are still filled in, so you can try again. If it keeps happening, contact me directly.',
      retryLabel: 'Try again',
    },
  },

  // Shown only while useLiveStatus() reports live.
  live: {
    label: 'Live now',
    text: 'Request a song from your phone.',
    cta: 'Request a song',
    href: '/request',
  },

  // Anchor ids every design must provide (see src/pages/landing/designs/README.md).
  nav: [
    { label: 'About', href: '#about' },
    { label: 'Events', href: '#services' },
    { label: 'Gear', href: '#gear' },
    { label: 'Reviews', href: '#testimonials' },
    { label: 'Contact', href: '#contact' },
  ],
  bookCta: { label: 'Book now', href: '#book' },

  footer: {
    // Designs prepend "© <current year>".
    text: 'DJ Insanity. All rights reserved.',
  },
};

export default site;
