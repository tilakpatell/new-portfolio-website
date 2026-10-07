// The ways a jump across the map can look. The site's own is the jump to
// lightspeed (components/Hyperspace.jsx); the crews on the universe map each
// go their own way (universe/crews.js says which): Rick's cruiser through a
// portal (PortalJump.jsx), Walt and Jesse's RV by crystallising into Blue
// Sky and shattering out of it (BlueSkyJump.jsx). All of them run on the
// hyperspace jump's timeline, so the pages that ask for one needn't know
// which plays. Pure, so it's tested in Node.

export const JUMP_STYLES = ['hyper', 'portal', 'bluesky'];

// a jump style, or the site's own for anything that isn't one
export const jumpStyle = (v) => (JUMP_STYLES.includes(v) ? v : 'hyper');

// the event App.jsx listens for: window.dispatchEvent(jumpEvent(style, {
// onPeak })). `onPeak` is called once, when the jump has the screen dark (its
// flash), or when it ends or another takes its place without getting there,
// for a page to change under it; App marks the event `taken` when it will.
export const jumpEvent = (style = 'hyper', { onPeak } = {}) => new CustomEvent('tp:hyperspace', { detail: { style: jumpStyle(style), ...(onPeak ? { onPeak } : {}) } });
