// The second Death Star’s conversations, as data for rules/talk.js (see
// it for the shape). Jerjerrod is “Commander” on screen and a Moff in
// canon; his nameplate says Moff, and he would rather you didn’t mention
// it. Only short famous lines are the film’s own.
//
//   DS2_TALKS: { [id]: talk }

const jerjerrod = {
  station: 'ds2',
  start: 'greet',
  nodes: {
    greet: {
      who: 'jerjerrod',
      say: 'Commander Jerjerrod. If Lord Vader sent you, the answer is yes, my men are working as fast as they can.',
      choices: [
        { say: 'Your nameplate says Moff, sir.', to: 'nameplate' },
        { say: 'The Emperor is coming, sir.', to: 'emperor' },
        { say: 'Carry on, Commander.', to: 'carry' },
      ],
    },
    nameplate: {
      who: 'jerjerrod',
      say: 'The nameplate was made for the day this station is finished. Facilities got ahead of themselves. Again.',
      end: true,
    },
    emperor: { who: 'jerjerrod', say: 'We shall double our efforts.', end: true },
    carry: { who: 'jerjerrod', say: 'I always do. It’s the station that doesn’t.', end: true },
  },
};

export const DS2_TALKS = { jerjerrod };
