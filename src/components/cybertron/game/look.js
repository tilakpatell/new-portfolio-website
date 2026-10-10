// Cybertron's world game's look (components/worlds/looks.js): its own. The
// plated stage and the robots under the house look (houseOn) but tone
// mapped and graded by the universe map’s post (universe/post.js), whose
// bloom it shares.

export const LOOK = {
  art: 'own',
  tone: 'none',
  bloom: { threshold: 1.7, strength: 0.8, radius: 0.55 },
  why: {
    art: 'the plated stage: each area’s ground and walls built and baked in code (./chunks.js), not the kit',
    tone: 'houseOn without its tone map: the universe map’s post (universe/post.js) tone maps and grades the frame, and its bloom is that post’s (these numbers are its, for the record)',
  },
};
