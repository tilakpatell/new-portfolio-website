// What Scranton fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/scranton',
  pages: ['src/pages/Scranton.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/office', 'src/pages/Scranton.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/hdri/office.hdr',
    '/audio/clips/thank-you.mp3',
    '/audio/clips/no-god.mp3',
    '/audio/clips/why-are-you-the-way-that-you-are.mp3',
    '/audio/clips/dwight-punish.mp3',
    '/audio/clips/undercook-the-onions.mp3',
    '/audio/clips/boom-roasted.mp3',
    '/audio/clips/fire-drill.mp3',
    '/audio/clips/bears-beets-battlestar-galactica.mp3',
    '/audio/clips/identity-theft.mp3',
    '/audio/clips/parkour.mp3',
    '/audio/clips/thats-what-she-said.mp3',
    '/audio/clips/like-to-be-liked.mp3',
    '/audio/clips/little-stitious.mp3',
    '/audio/clips/did-i-stutter.mp3',
    '/audio/clips/i-declare-bankruptcy.mp3',
    '/audio/clips/inside-jokes.mp3',
    '/audio/clips/beyonce-always.mp3',
    '/audio/clips/prison-mike.mp3',
    '/audio/clips/dwight-you-ignorant-slut.mp3',
    '/audio/clips/pam-gamble.mp3',
    '/audio/clips/office-theme.mp3',
  ], // single files
  globs: ['/models/office/**', '/textures/office/*'], // folders: `*` within a folder, `**` any depth
};
