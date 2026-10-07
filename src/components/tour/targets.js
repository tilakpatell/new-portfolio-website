// The first element marked data-tour="name" that's showing (the guide's "?"
// is the corner button on most pages, the panel's own on the map). A name
// can be one of several on an element: data-tour="panel navmap".
export function targetOf(name) {
  for (const el of document.querySelectorAll(`[data-tour~="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1 && getComputedStyle(el).visibility !== 'hidden') return el;
  }
  return null;
}
