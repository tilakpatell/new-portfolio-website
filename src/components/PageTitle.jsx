import { usePageActive } from '../lib/page';

// A page's title: its h1 while it's the page on the address, and an h2
// while it's one of the others in the feed (components/feed), so a document
// has one h1 however many pages are on the screen. (The themes that dress
// a page's title find it by data-page-title, h1 or h2.)
export default function PageTitle(props) {
  const Tag = usePageActive() ? 'h1' : 'h2';
  return <Tag data-page-title="" {...props} />;
}
