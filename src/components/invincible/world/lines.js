// What the city's people say when Mark comes by (./npcs.js stands them about,
// ./scene.js puts Allen and Thragg out in space and Dad over downtown), by
// who they are: a person's own, or a townsperson's by the part they play.
export const LINES = {
  debbie: ['You’re home early. Did you fly?', 'There’s lasagna in the fridge.', 'Your father’s out. Again.', 'Be careful up there, sweetie.'],
  cecil: ['Kid. You’re making a lot of noise over my city.', 'Break the sound barrier over downtown and I get the calls.', 'We should talk about your future with the GDA.', 'Don’t look at the building. It’s a records annex.'],
  eve: ['Race you to the river?', 'You know you can just float, right? You don’t have to flap.', 'I’m on patrol. You’re… sightseeing?', 'Nice landing. The street disagrees.'],
  omni: ['Think, Mark!', 'Keep up.', 'You’re flying like a human.', 'Five hundred years from now, this city will be dust. Think about that.'],
  manager: ['You’re late.', 'Fries don’t drop themselves, Grayson.', 'Is that a costume? Take it off before the dinner rush.'],
  student: ['Was that you on the news?', 'Grayson! Did you do the reading?', 'There’s a guy on the roof of the gym. Oh, it’s you.'],
  allen: ['Hi! Allen. Allen the Alien. I test the champions of new worlds for the Coalition of Planets.', 'So you’re Earth’s new guy? You’re younger than I pictured.', 'Your moon’s quieter than I expected. Nice view, though.', 'Ask your dad about the Viltrumites sometime. Really ask.'],
  thragg: ['So this is Nolan’s son.', 'Viltrum will have this world, boy. Sooner than you think.', 'Go back to your little city while it’s still there.'],
  fan: ['Is that Invincible?', 'Can I get a picture?', 'My cousin says you can’t even lift a bus.', 'Do you know Omni-Man?', 'You flew over my car. It’s fine. It’s fine.'],
};

// And what's said in passing, over the HUD (./InvWorld.jsx's say): who says
// it (one of the people above) and the line as it's shown.
export const CALLS = {
  portal: { who: 'cecil', text: 'Cecil: “Portal over the river. Flaxans again. Go.”' },
  spar: { who: 'omni', text: '“Think, Mark!” Down the page, over the city.' },
  mimic: { who: 'omni', text: 'Dad, in your ear: “Look what they need to mimic a fraction of our power.”' },
};
