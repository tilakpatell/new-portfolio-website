// Opens the command palette from anywhere (the nav button, the terminal).
export const openPalette = () => window.dispatchEvent(new Event('tp:palette'));

// Opens the guide (the ? button's panel) from anywhere: a page's own Controls
// button, or on a tab ('todo': ⌘K's "Things to do"). (A button's click event
// isn't a tab: openGuide is handed straight to onClick.)
export const openGuide = (tab) => window.dispatchEvent(new CustomEvent('tp:guide', { detail: typeof tab === 'string' ? { tab } : undefined }));

export const shortcutLabel = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
