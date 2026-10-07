# Tours across pages: recruiter, player, mixed

The design of the site-wide tour modes lives in the project's design doc
(Claude Docs, "Tour system design", 2026-10-07): three scripts on one runner,
legs as the unit of navigation and skipping, `data-tour` marks as the only
targeting, two localStorage keys for status and resume. In short:

- **Recruiter** (about 2 minutes): home, a role, projects, the résumé, contact,
  and one look at the universe.
- **Player** (about 5 minutes, each world skippable): the map and ships, the
  galaxy, Avengers HQ, Middle-earth, Scranton, Invincible, C-137, Albuquerque,
  the games, the terminal, achievements, online.
- **Mixed** ("Both", about 3 minutes): the recruiter spine (without its look at
  the universe) and then the player's stops tagged `taste`, in the player's
  order, with the recruiter's look at the universe folded into the player's
  universe leg (`scripts/mixed.js`, built from the other two).

A phone waits for a world's 3D like any device: while a world's gate asks
whether to download, the leg waits for the answer however long it takes (the
six-second patience is for pages that never come ready, not for a question),
and a world kept light runs the leg on its 2D version with a notice on the
first card. A leg is judged ready only once the router has reached its page,
since the address bar runs ahead of a page still loading. The runner, the script
shape (`lib/tour.js`) and the memory keys are in
[the site tour's design](2026-10-07-site-tour-design.md), "Where things live".

Planned as four PRs (the runner; the recruiter script with the mode picker
and the `?tour=` link; the player script; mixed and polish), all landed as
commits on PR #559 at the owner's choice. Each mode has an entry in ⌘K, the
guide's "The site" tab and the terminal's `tour` (`tour recruiter`, `tour
player`, `tour both`), and an achievement (`tour-recruiter`, `tour-player`,
`tour-mixed`).
