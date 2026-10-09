// The Cybertron backdrop's look (components/worlds/looks.js): scanned. The
// statues, the Hall and the citadel under the house look and tone mapper
// (houseOn; the ACES line before it never drew a frame, and is gone), the
// city's own shaders and fog left as they are.

export const LOOK = {
  art: 'scanned',
  tone: 'house',
  bloom: { threshold: 0.92, strength: 0.6, radius: 0.55 },
  why: {
    bloom: 'the city’s edge lights were tuned to glow from 0.92 (the palettes’ `edge` colours); lifting them over 1 with hot() and the threshold to the house’s 1 is a pass with shots of the four palettes',
  },
};
