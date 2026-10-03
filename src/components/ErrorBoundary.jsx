import { Component } from 'react';

// Keeps a failure in one page (or a stale chunk after a deploy) from blanking the site.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    const stale = /dynamically imported module|Failed to fetch|Loading chunk/i.test(error.message || '');
    return (
      <div className="shell flex min-h-[70vh] items-center py-32">
        <div className="max-w-lg">
          <p className="eyebrow">Something went wrong</p>
          <h1 className="title mt-3">{stale ? 'The site was just updated.' : 'This page didn’t load.'}</h1>
          <p className="lead mt-4">
            {stale
              ? 'Reload to get the latest version.'
              : 'Reload the page, or head back to the home page. Everything else on the site still works.'}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
            <a className="btn btn-ghost" href="#/">
              Go to home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
