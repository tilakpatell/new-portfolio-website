// Rick's rooms ("Vindicators 3: The Return of Worldender"): the drunk night
// Rick spent rigging the Vindicators' ship with a gauntlet of his own, three
// rooms one after another. A right pick goes on to the next room, a wrong one
// loses the lot, and a retry starts again from the first. Pure: the ship's
// hall (./vindicators.js) draws the rooms; RmWorld.jsx asks the questions.

export const ROOMS = [
  {
    id: 'levers',
    prompt: 'Two levers. One opens the door, the other fills the room with acid. They’re labelled. Rick swapped the labels.',
    choices: [
      { id: 'door', text: 'Pull the one marked “Door”' },
      { id: 'acid', text: 'Pull the one marked “Acid”', right: true },
      { id: 'neither', text: 'Pull neither, and wait for it to pass' },
    ],
  },
  {
    id: 'riddle',
    prompt: 'A screen, in Rick’s handwriting: “The more you take, the more you leave behind. What am I?”',
    choices: [
      { id: 'time', text: 'Time' },
      { id: 'footsteps', text: 'Footsteps', right: true },
      { id: 'ricks', text: 'Ricks' },
      { id: 'memories', text: 'Memories' },
    ],
  },
  {
    id: 'button',
    prompt: 'A row of buttons with the Vindicators’ faces on. A note: “Press the one I actually like.”',
    choices: [
      { id: 'vance', text: 'Vance Maximus' },
      { id: 'supernova', text: 'Supernova' },
      { id: 'crocubot', text: 'Crocubot' },
      { id: 'noobnoob', text: 'Noob-Noob', right: true },
    ],
  },
];

export const newTrial = () => ({ room: 0, state: 'on', picks: [] });

// a pick in the room the trial's in: 'next', 'won' or 'lost', or null when
// the trial's over or it isn't one of that room's choices
export function pick(trial, id) {
  if (trial.state !== 'on') return null;
  const choice = ROOMS[trial.room].choices.find((c) => c.id === id);
  if (!choice) return null;
  trial.picks.push(id);
  if (!choice.right) {
    trial.state = 'lost';
    return 'lost';
  }
  if (trial.room === ROOMS.length - 1) {
    trial.state = 'won';
    return 'won';
  }
  trial.room += 1;
  return 'next';
}

// back to the first room
export function retry(trial) {
  return Object.assign(trial, newTrial());
}
