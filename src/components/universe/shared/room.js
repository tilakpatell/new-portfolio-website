// The universe's face for its rooms: joining one as a visitor. Its own file,
// so a borrower can load it lazily and the relays' code stays out of its
// first chunk, as it was when the borrower imported nostr.js lazily itself.

export { joinAsVisitor } from '../online/nostr';
