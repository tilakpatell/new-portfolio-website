// Opens the command palette from anywhere (the nav button, the terminal).
export const openPalette = () => window.dispatchEvent(new Event('tp:palette'));

export const shortcutLabel = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
