// Start the site over from the beginning, as on a first visit: the welcome,
// the opening crawl, the cockpit (the Falcon again), the launch and the front
// door's choice. What the site remembers about the visit goes; what you've
// unlocked and set (achievements, colours, dark mode, sound, best scores)
// stays. It reloads at the front door, so every page, game and sound starts
// fresh, with the intro's dark cover (index.html) up first so there's no flash.

export const VISIT_KEYS = [
  'tp-intro', // the intro has played (index.html and App's IntroJump)
  'tp-start', // the front door's choice (pages/Front)
  'tp-cockpit', // the last cockpit you sat in
  'tp-universe-ship', // the ship you fly on the map
  'tp-tour', // the tour's offer, and whether it was taken (lib/tour)
];

export function forgetVisit(storage) {
  for (const key of VISIT_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      /* storage unavailable */
    }
  }
}

export function restartSite() {
  let storage = null;
  try {
    storage = window.localStorage;
  } catch {
    /* storage unavailable */
  }
  forgetVisit(storage);
  document.documentElement.dataset.intro = '1';
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/`);
  window.location.reload();
}
