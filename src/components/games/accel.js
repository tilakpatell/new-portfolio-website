// How to turn hardware acceleration back on, browser by browser. The games
// that only draw in WebGL show the visitor's own browser first.

export const STEPS = {
  chrome: {
    name: 'Chrome',
    settings: 'chrome://settings/system',
    steps: ['Open Settings from the ⋮ menu, then System.', 'Turn on “Use graphics acceleration when available”.', 'Press Relaunch, and come back to this page.'],
  },
  edge: {
    name: 'Edge',
    settings: 'edge://settings/system',
    steps: ['Open Settings from the … menu, then System and performance.', 'Turn on “Use graphics acceleration when available”.', 'Press Restart, and come back to this page.'],
  },
  brave: {
    name: 'Brave',
    settings: 'brave://settings/system',
    steps: ['Open Settings from the ≡ menu, then System.', 'Turn on “Use graphics acceleration when available”.', 'Press Relaunch, and come back to this page.'],
  },
  opera: {
    name: 'Opera',
    settings: 'opera://settings/system',
    steps: ['Open Settings, then System (under Advanced).', 'Turn on “Use graphics acceleration when available”.', 'Relaunch Opera, and come back to this page.'],
  },
  firefox: {
    name: 'Firefox',
    settings: 'about:preferences#general',
    steps: ['Open Settings, General, and scroll down to Performance.', 'Untick “Use recommended performance settings”.', 'Tick “Use hardware acceleration when available”, then restart Firefox.'],
  },
  safari: {
    name: 'Safari',
    steps: [
      'Safari draws with the graphics chip unless WebGL has been switched off.',
      'In Safari, Settings, Advanced, tick “Show features for web developers”.',
      'Then in the Develop menu, Feature Flags, make sure WebGL is on, and reload.',
    ],
  },
  ios: {
    name: 'iPhone and iPad',
    steps: ['Every browser on an iPhone or iPad draws WebGL with the graphics chip, so this is unusual.', 'Turn off Low Power Mode, close a few tabs, and reload.', 'If it still shows, update iOS.'],
  },
  other: {
    name: 'your browser',
    steps: ['Look in its settings (often under System or Performance) for “hardware acceleration” or “graphics acceleration”.', 'Turn it on and restart the browser.', 'If it is already on, your graphics driver may be blocked: updating it usually helps.'],
  },
};

// The browser to explain first, from its user agent. `brave` is
// navigator.brave being there (Brave reports itself as Chrome); `touchMac` is
// an iPad asking for the desktop site, which reports itself as a Mac.
export function browserFor(ua = '', { brave = false, touchMac = false } = {}) {
  const s = String(ua ?? '');
  if (/iPhone|iPad|iPod/.test(s) || (touchMac && /Macintosh/.test(s))) return 'ios';
  if (/Edg\//.test(s)) return 'edge';
  if (/OPR\/|Opera/.test(s)) return 'opera';
  if (/SamsungBrowser/.test(s)) return 'other';
  if (/Firefox\//.test(s)) return 'firefox';
  if (/Chrome\//.test(s)) return brave ? 'brave' : 'chrome';
  if (/Safari\//.test(s)) return 'safari';
  return 'other';
}

export const thisBrowser = () => {
  if (typeof navigator === 'undefined') return 'other';
  return browserFor(navigator.userAgent, { brave: Boolean(navigator.brave), touchMac: navigator.maxTouchPoints > 1 });
};
