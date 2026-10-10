import { Component } from 'react';
import { browserOnline, isStale, mayReload, reloadFresh, session } from '../lib/stale';

// Keeps a failure in one page (or a stale chunk after a deploy) from blanking the site.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  // A file that 404s after a deploy (a page, its stylesheet) is fixed by
  // reloading from the new build (lib/stale); not twice in a row, so a real
  // outage can't loop.
  componentDidCatch(error) {
    if (isStale(error) && mayReload(session())) reloadFresh();
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    const stale = isStale(error);
    // a file that wouldn't come while the browser's offline: not a deploy
    const offline = stale && !browserOnline();
    return (
      <div className="shell flex min-h-[70vh] items-center py-32">
        <div className="max-w-lg">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="title mt-3">{offline ? 'You’re offline.' : stale ? 'The site was just updated.' : 'This page didn’t load.'}</h1>
          <p className="lead mt-4">
            {offline
              ? 'This part of the site hadn’t loaded yet. Reload once you’re back online.'
              : stale
                ? 'Reload to get the latest version.'
                : 'Reload the page, or head back to the home page. Everything else on the site still works.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={reloadFresh}>
              Reload page
            </button>
            <a className="btn btn-ghost" href="#/">
              Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
