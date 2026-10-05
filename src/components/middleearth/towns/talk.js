// Conversations as data: who says what, the replies you can pick, and how
// it ends. { start, nodes: { id: { who, say, next?, choices?: [{ text, to }],
// end?: 'won' | 'lost' } } }. A node with choices waits for one; one with
// `next` goes on when you click; one with `end` finishes the conversation.

export const newTalk = (convo) => ({ at: convo.start, end: null });

export const talkNode = (convo, talk) => convo.nodes[talk.at] ?? null;

// On from where the talk is: by the choice picked, or to what comes next.
export function talkOn(convo, talk, choice = null) {
  if (talk.end) return talk;
  const node = talkNode(convo, talk);
  if (!node) return { ...talk, end: 'lost' };
  if (node.end) return { ...talk, end: node.end };
  if (node.choices) {
    const c = node.choices[choice];
    return c ? { at: c.to, end: null } : talk;
  }
  return node.next ? { at: node.next, end: null } : { ...talk, end: 'won' };
}
