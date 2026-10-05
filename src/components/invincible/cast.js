// The Invincible page's people, as HD models: Invincible made for this
// page with Meshy (scripts/meshy-invincible.mjs), Omni-Man and Thragg from
// Sketchfab under CC BY (scripts/sketchfab-characters.mjs, credited in
// src/data/modelCredits.json). Each with how tall it stands and what of it
// came unskinned and rides on the chest (Omni-Man's cape).

export const CAST = {
  mark: { file: '/models/invincible/mark.glb', h: 1.78 },
  omni: { file: '/models/invincible/omni-man.glb', h: 1.95, attach: /cape/i },
  thragg: { file: '/models/invincible/thragg.glb', h: 2.05 },
};

// a file under public/, wherever the site is served from
export const asset = (file) => `${import.meta.env?.BASE_URL ?? '/'}${file.replace(/^\//, '')}`;
