import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PageContext } from '../lib/page';
import PageTitle from './PageTitle';

const inFeed = (active) =>
  renderToStaticMarkup(
    <PageContext.Provider value={{ active, remember: null }}>
      <PageTitle id="t" className="display">
        Let’s talk.
      </PageTitle>
    </PageContext.Provider>,
  );

describe('a page’s title', () => {
  it('is the document’s h1 on the page that’s on the address', () => {
    expect(inFeed(true)).toBe('<h1 data-page-title="" id="t" class="display">Let’s talk.</h1>');
  });
  it('is an h2 on the feed’s other pages, so there’s one h1', () => {
    expect(inFeed(false)).toBe('<h2 data-page-title="" id="t" class="display">Let’s talk.</h2>');
  });
  it('is an h1 outside the feed', () => {
    expect(renderToStaticMarkup(<PageTitle>Terminal</PageTitle>)).toBe('<h1 data-page-title="">Terminal</h1>');
  });
});
