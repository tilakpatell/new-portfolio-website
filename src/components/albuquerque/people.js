// Albuquerque's people, as the page's cast cards have them (Cast.jsx): who
// they are, the button, and what comes back when it's pressed (done).
// `said`: that's them talking, with no recording of it, so it's said in
// their own voice where it's been made (lib/voiced.js); the others play the
// show's own clip, or are a sound, or what happens.
export const CAST = [
  { id: 'walt', name: 'Walter White', role: 'Chemistry teacher', text: 'A high-school chemistry teacher in Albuquerque who goes by another name in the business he gets into.', action: 'Say my name', done: 'Heisenberg.' },
  { id: 'jesse', name: 'Jesse Pinkman', role: 'His former student', text: 'Walt’s old student and partner, who learns more chemistry than either of them planned.', action: 'Science!', done: 'Yeah, Mr. White! Yeah, science!' },
  { id: 'gus', name: 'Gustavo Fring', role: 'Los Pollos Hermanos', text: 'Owns a chain of chicken restaurants. Calm, polite, meticulous. Hides in plain sight.', action: 'Order the chicken', done: 'Your order is ready. The manager hopes you enjoy it.' },
  { id: 'mike', name: 'Mike Ehrmantraut', role: 'Security', text: 'A retired Philadelphia cop who handles problems quietly, and never halfway.', action: 'Half measures?', done: 'No more half measures.', said: true },
  { id: 'saul', name: 'Saul Goodman', role: 'Attorney at law', text: 'Jimmy McGill, practicing law as Saul Goodman, from an office with an inflatable Statue of Liberty on the roof.', action: 'Better call Saul', done: 'S’all good, man.', said: true },
  { id: 'lalo', name: 'Lalo Salamanca', role: 'The cousin', text: 'The most charming Salamanca, which makes him the most dangerous one in the room.', action: 'Lalo’s back', done: 'He walks in smiling. Nobody else is.' },
  { id: 'hector', name: 'Hector Salamanca', role: 'Tio', text: 'Says everything he needs to with a bell on his wheelchair.', action: 'Ring the bell', done: 'Ding. Ding. Ding.' },
  { id: 'hank', name: 'Hank Schrader', role: 'DEA', text: 'Walt’s brother-in-law, DEA agent, and a serious collector of minerals.', action: 'See the collection', done: 'They’re minerals.', said: true },
];

// Saul, in his office in the world (world/places.jsx), when you've bought
// something off him: the superlab gets a line of its own.
export const SAUL = {
  superlab: 'Done. The superlab’s under the laundry at the east end of Central. Don’t ask how.',
  bought: (name) => `${name}: done. S’all good, man.`,
};
