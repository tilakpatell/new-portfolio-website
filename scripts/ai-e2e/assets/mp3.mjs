// An mp3's frames walked from its bytes, with no decoder and no dependency:
// enough to tell a real mp3 (a run of valid Layer III frames) from a
// renamed WAV or a file cut short, and to read its length.
//
//   mp3(buffer) → { frames, seconds }   (frames 0: not an mp3)

const BITRATES = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], // MPEG-2 and 2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// one frame's header at `at`: its length in bytes and samples, or null
function header(b, at) {
  if (at + 4 > b.length || b[at] !== 0xff || (b[at + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[at + 1] >> 3) & 3; // 3 MPEG-1, 2 MPEG-2, 0 MPEG-2.5
  const layer = (b[at + 1] >> 1) & 3; // 1 is Layer III
  if (version === 1 || layer !== 1) return null;
  const kbps = BITRATES[version === 3 ? 1 : 2][b[at + 2] >> 4];
  const rate = RATES[version]?.[(b[at + 2] >> 2) & 3];
  if (!kbps || !rate) return null;
  const padding = (b[at + 2] >> 1) & 1;
  const samples = version === 3 ? 1152 : 576;
  return { bytes: Math.floor(((samples / 8) * kbps * 1000) / rate) + padding, samples, rate };
}

export function mp3(b) {
  let at = 0;
  // an ID3v2 tag first: its size is four 7-bit bytes
  if (b.subarray(0, 3).toString('latin1') === 'ID3' && b.length >= 10) at = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
  let frames = 0;
  let seconds = 0;
  for (;;) {
    const h = header(b, at);
    if (!h || at + h.bytes > b.length) break;
    frames++;
    seconds += h.samples / h.rate;
    at += h.bytes;
  }
  return { frames, seconds };
}
