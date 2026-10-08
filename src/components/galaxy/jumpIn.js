// The jump into the galaxy from the universe map holds its tunnel for the
// galaxy (hyperspace3d/timeline.js's handJump). This says when the
// galaxy's page lets it go: once the galaxy has drawn, while the page is
// frozen (the intro's black covers the load itself), or as soon as the
// galaxy won't draw (failed, lost, 3D off). Pure, so it's tested in Node.
//
// `making`: the runtime is making the galaxy, or has it. A page's status
// starts as the runtime's, which is still 'failed' or 'lost' after an
// earlier world went that way, and the page's first commit sees that
// although its own mount has just begun. So a failure counts only when the
// galaxy isn't on its way.
//
// letsJumpGo({ drawn, meant, frozen, making }) → bool

export const letsJumpGo = ({ drawn, meant, frozen, making }) => Boolean(drawn || frozen || (!meant && !making));
