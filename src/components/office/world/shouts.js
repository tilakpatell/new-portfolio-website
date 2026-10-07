// What the office's people say in the toasts as you go about the week, by
// who says it: said in their own voice where it's been made (lib/voiced.js
// makes the quoted part of each line; ./voicelines.js lists them for
// scripts/voices). Kept as data so the line and its voice stay one.

export const SHOUTS = {
  fire: { who: 'dwight', say: 'Dwight has set a fire in the conference room’s bin. “Today, smoking is going to save lives.” Get out by the stairwell, past the kitchen!' },
  fireOut: { who: 'dwight', say: 'Out in the stairwell. Dwight follows you through with a clipboard: “Everyone is dead. Except Jim. Good work, Jim.” Back to work.' },
  fireSlow: { who: 'dwight', say: 'Too slow. Dwight, from somewhere: “You are dead. Do it again.” Back in the conference room.' },
  chili: { who: 'kevin', say: 'On the counter, not a drop lost. Kevin, from his desk: “I just want people to like my chili.” They will.' },
  hoops: { who: 'darryl', say: 'Darryl: “Three out of five, office man. Michael said you were the ringer. Michael says a lot of things.”' },
  // (shown after the score, “3 of 5.”)
  hoopsWon: { who: 'darryl', say: 'Darryl, slowly: “Okay. Okay. The office has one.” The warehouse goes back to work.' },
  hoopsLost: { who: 'darryl', say: 'Darryl: “That’s what I thought.” Step up and go again.' },
  erinBack: { who: 'erin', say: 'Erin’s back early. “Did you just hang up on someone?” Come back to cover reception any time.' },
  caught: { who: 'dwight', say: 'Dwight: “What are you doing at my desk? FALSE. Whatever you were going to say: false.” The Jell-O goes back in the fridge.' },
  jello: { who: 'dwight', say: 'Dwight sits down. Looks at his desk. Looks at you. “JIM!” Pam, across the room, doesn’t even look up. She’s smiling.' },
};
