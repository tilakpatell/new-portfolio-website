// What the Caribbean fetches (models, textures, skies, sound): the install's list (scripts/packs.mjs, src/runtime/install.js); scripts/pack-check.mjs fails when its source names an asset this misses.
export const PACK = {
  id: '/caribbean',
  pages: ['src/pages/Caribbean.jsx'], // page modules: the build adds their JS/CSS chunks
  src: ['src/components/caribbean', 'src/pages/Caribbean.jsx'], // where its source is (files or folders, repo-relative): pack-check scans these
  urls: [
    '/audio/clips/why-is-the-rum-always-gone.mp3',
    '/audio/clips/jar-of-dirt.mp3',
    '/audio/clips/pirates-theme.mp3',
    '/audio/clips/welcome-to-the-caribbean.mp3',
    '/audio/clips/almost-caught-captain-jack-sparrow.mp3',
    '/audio/clips/but-you-have-heard-of-me.mp3',
    '/audio/clips/madness-or-brilliance.mp3',
    '/audio/clips/without-a-drop-of-rum.mp3',
    '/audio/clips/not-good.mp3',
    '/audio/clips/did-everyone-see-that.mp3',
    '/audio/clips/oh-bugger.mp3',
    '/audio/clips/do-you-fear-death.mp3',
    '/audio/clips/why-should-the-afterlife.mp3',
    '/audio/clips/take-what-you-can.mp3',
    '/audio/clips/drink-up-me-hearties.mp3',
  ], // single files
  globs: ['/games/caribbean**'], // folders: `*` within a folder, `**` any depth
};
