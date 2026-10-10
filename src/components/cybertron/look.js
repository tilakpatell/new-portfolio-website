// The Cybertron page's look (components/worlds/looks.js): its planet
// (./planet3d.js) and Optimus's transformation (./transform3d.js), each a
// renderer of its own; the planet's bloom carries the energon, the fires
// and the portal.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: { threshold: 1, strength: 0.8, radius: 0.5 },
  why: {
    art: 'a planet built in code and one transforming model, no kit and no ramp: drawn as they are',
    tone: 'ACES, as both were lit for; the move to the house’s Neutral changes their pictures, so it waits for a pass that shoots them before and after',
  },
};
