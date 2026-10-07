// The hidden collectibles, one on each page, each from a different interest.
// Find them all for the Collector achievement. `voice` says the quote aloud
// where no clip of it plays (lib/voiced.js; ./voicelines.js lists them).
export const EGGS = {
  oneup: { page: '/', name: '1-UP', from: 'Gaming', quote: 'One more life.', by: 'Every platformer ever', sound: 'oneUp' },
  mjolnir: { page: '/experience', name: 'Mjolnir', from: 'Marvel', quote: 'Whosoever holds this hammer, if he be worthy…', by: 'Mjolnir’s inscription', sound: 'thunder' },
  saul: { page: '/projects', name: 'A business card', from: 'Better Call Saul', quote: 'Better call Saul!', by: 'Saul Goodman, attorney at law', sound: 'ding', gif: 'saulGood' },
  mug: { page: '/travel', name: 'A mug', from: 'The Office', quote: 'I’m not superstitious, but I am a little stitious.', by: 'Michael Scott', sound: 'ding' },
  hologram: { page: '/contact', name: 'A hologram', from: 'Star Wars', quote: 'Help me, Obi-Wan Kenobi. You’re my only hope.', by: 'Princess Leia', sound: 'beeps' },
  reactor: { page: '/resume', name: 'An arc reactor', from: 'Marvel', quote: 'Genius, billionaire, playboy, philanthropist.', by: 'Tony Stark', sound: 'repulsor', voice: 'tony' },
  cassette: { page: '/music', name: 'A cassette', from: 'Transformers', quote: 'Laserbeak, eject.', by: 'Soundwave', sound: 'transform', voice: 'soundwave' },
  lost: { page: '*', name: 'A lost sentence', from: 'The Office', quote: 'Sometimes I’ll start a sentence and I don’t even know where it’s going.', by: 'Michael Scott', sound: 'ding', voice: 'michael' },
};

export const EGG_KEY = 'tp-eggs';
