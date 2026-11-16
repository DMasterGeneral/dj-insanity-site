// Copy that Design B needs and src/content/site.js does not have yet (that file is shared and
// frozen for design builders). Same placeholder shape as site.js; render through <Sample>.
// If B is picked, move `howItWorks` and `photoPending` into site.js and import them from there.

export const copyB = {
  // The booking path: three steps before the form.
  howItWorks: {
    heading: 'How booking works',
    steps: [
      {
        title: 'Send your date',
        text: { text: 'Share the date, the times and the kind of event in the form below. There is no commitment yet.', placeholder: true },
      },
      {
        title: 'Plan the music together',
        text: { text: 'I confirm the date, then we go through the songs you love, the moments that matter and anything to avoid.', placeholder: true },
      },
      {
        title: 'Enjoy the night',
        text: { text: 'I set up, run the music and read the room, so you can be a guest at your own event.', placeholder: true },
      },
    ],
  },
  // Shown inside an empty photo frame until the DJ supplies real event photos.
  photoPending: 'Event photo to come',
  menu: { open: 'Menu', close: 'Close menu' },
};

export default copyB;
