# The portfolio as a feed

Date: 2026-10-05. Branch: `claude/cool-bell-gvmjo2`.

## Intent

A reader suggested the portfolio should read like an Instagram feed: you scroll, and when you reach the end of one page the next category begins under it, instead of stopping at a footer and a click. The six portfolio pages (Home, Experience, Projects, Résumé, Travel, Contact) become one continuous feed. Each stays a page of its own at its own address, so every link on and off the site keeps working; what changes is what happens at the bottom of each one.

What this is for: a recruiter who lands on any one page and keeps scrolling sees the whole portfolio without deciding where to click next. Success is that the scroll never dead-ends on a portfolio page, the address bar, nav highlight, tab title and theme always say which category is on screen, and nothing about the pages themselves (their deep links, filters, 3D, games) breaks.

Assumptions made on the reader's behalf, since the recommendation was one sentence:

- The feed is the six portfolio pages, in this order: Home, Experience, Projects, Résumé, Travel, Contact. The universe map, the worlds, the terminal and the project detail pages stay what they are: they are not read top to bottom.
- The feed wraps: after Contact comes Home, so a visitor who lands on Travel still gets everything. Each category appears once, then the feed ends with a card (back to the top, fly the universe) and the footer.
- The address follows the scroll with `replaceState`, never `pushState`: scrolling through six categories leaves one history entry, and Back goes where the visitor came from.

## How it works

### The order (`src/components/feed/feed.js`, tested)

`FEED` lists the six categories with their path, label and a one-line blurb for the divider. `categoryAt(pathname)` says which category a path belongs to (`/experience/aws` is Experience; `/projects/gameboy-emulator` is a project page, not the feed). `nextOf(id)` wraps round. `feedFrom(id)` is the six in order starting at one. `isFeedMove(location, navigationType)` is true for the feed's own address changes (a `REPLACE` carrying `state.feed`), which the rest of the app uses to tell them from a visitor's click.

### The feed (`src/components/feed/Feed.jsx`)

One component is the element of all six routes. It keeps a stack of category ids, starting at the one in the address, and renders each as a lazily loaded page inside a wrapper:

- **Mounting ahead.** A sentinel after the last mounted page, watched one viewport ahead, appends the next category. The next page's chunk is imported as soon as a page becomes the last one, so the append is a render, not a download. The sentinel only exists once the last page has actually rendered (a sibling inside its Suspense reports it), so a tall fallback never chains every page in at once.
- **Which page is current.** Each wrapper is watched against the middle line of the viewport (`rootMargin: -50% 0 -50% 0`, the same line the theme follows). Whichever page holds that line is current. When that changes, the feed navigates to its path with `replace: true` and `state: { feed: true }`. Scrolling back up works the same way.
- **A page's own address state.** Experience (`?track=`), Projects (`?tech=`) and Résumé (`?view=`, `?skills=`) keep state in the address. The feed remembers each page's search string while it is off the address and puts it back when the page is current again, so a PDF tab or a filter survives a scroll away and back. `usePageParams()` (in `lib/hooks`) is `useSearchParams` for a page in the feed: live while the page is current, frozen while it is not (so the page above does not snap to defaults at the boundary), and written through to the feed so a change made at the edge of the screen is kept.
- **A visitor's own navigation.** Any address change that is not a feed move (a nav click, Back, a link in a page) with a different category resets the stack to that category and scrolls to the top, exactly as navigating today does. The same category (clicking the nav link of the page you are on) only scrolls to the top.
- **Dividers and the end.** Every page after the first opens with a divider: the number in the feed, the category and its blurb. After the sixth, an end card.
- **Heroes that animate in.** A page mounted a viewport ahead would play its hero animation unseen. The wrapper carries `data-wait` until any part of it enters the viewport, and `.hero-in` is paused under it.

### What the rest of the app learns

- `lib/page.js`: a `PageContext` (`{ active, remember }`), true by default, that the feed provides per page. `useDocumentTitle` only writes the title for the active page. `useSectionThemes(containerRef)` observes only its own page's sections and only while active, so one observer runs instead of six.
- `App.jsx`: the six paths share one page key (`/feed`), as the universe map's do, so the feed is not remounted when its address changes. `ScrollToTop` and the nav's un-hide skip feed moves. Résumé joins the idle preload.
- Print: only the current page prints; dividers and the end card do not.

## Not built

- No snapping or full-screen cards; the pages keep their own long-form layouts.
- No infinite repetition; each category once per visit to the feed.
- No change to the pages' content, 3D or games.

## Testing

`npm run lint`, `npm test` (feed order and matching), `npx vite build`, and a browser pass with Playwright: land on each category, scroll to the end of the feed and back, check the address, nav, title and theme at each boundary, check Back, deep links (`/experience/aws`, `/travel?place=is`, `/resume?view=pdf`) and a filter kept across a scroll away and back.
