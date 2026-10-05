// Opens the command palette from anywhere (the nav button, the terminal).
export const openPalette = () => window.dispatchEvent(new Event('tp:palette'));

// Opens the guide (the ? button's panel) from anywhere: a page's own Controls button.
export const openGuide = () => window.dispatchEvent(new Event('tp:guide'));

export const shortcutLabel = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
