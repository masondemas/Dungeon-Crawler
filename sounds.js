// =============================================================
//  Sound manager: every sound in the game goes through here
// =============================================================
// Each sound has a NAME (see the list below). When the game asks for a sound:
//   1. If you've dropped an audio file called  sounds/<name>.mp3  into the game
//      folder, that file is played.
//   2. Otherwise a placeholder sound is generated in code (Web Audio API).
//
// HOW TO REPLACE A SOUND WITH A REAL RECORDING:
//   Put an .mp3 file in the "sounds" folder, named exactly like the sound,
//   e.g. sounds/hitFlesh.mp3. That's it: reload the game and it's used.
//   (Want a different file name or format? Change it in SOUND_FILES below.)
//   Every play still gets a small random pitch change so repeats sound different.
//
// Sound names:
//   swingLight    swoosh of a light weapon (dagger, sword)
//   swingHeavy    swoosh of a heavy weapon (axe, mace) and power attacks
//   hitFlesh      blade hitting a fleshy enemy (Ghouls, Crypt Lord)
//   hitBone       blade hitting a skeleton
//   hitStraw      blade hitting a training dummy
//   hitShield     an enemy's hit landing on your shield
//   blockWeapon   an enemy's hit blocked with just your weapon (metal clang)
//   hitWall       your swing hitting a wall instead of an enemy
//   playerGrunt   the player's effort grunt when swinging
//   playerHurt    the player getting hurt
//   enemyGroan    groan of a nearby Ghoul (deeper for bosses)
//   boneRattle    rattle of a nearby Skeleton

const SOUND_NAMES = [
  'swingLight', 'swingHeavy', 'hitFlesh', 'hitBone', 'hitStraw', 'hitShield',
  'blockWeapon', 'hitWall', 'playerGrunt', 'playerHurt', 'enemyGroan', 'boneRattle',
];

// Which file to look for, for each sound. Change a line to use a different file.
const SOUND_FILES = {};
for (const name of SOUND_NAMES) SOUND_FILES[name] = `sounds/${name}.mp3`;

// Overall volume (0 to 1) and how much pitch varies between plays (0.08 = ±8%)
const MASTER_VOLUME = 0.7;
const PITCH_VARIATION = 0.08;

let ctx = null;           // the Web Audio "audio context" (created after the first click)
let master = null;        // master volume knob
let noiseBuffer = null;   // one second of random noise, reused by many sounds
const fileBuffers = {};   // sounds loaded from files: name -> decoded audio
let muted = false;

// Browsers only allow sound after the player has clicked something,
// so the game calls this from the "click to play" screen.
export function unlockAudio() {
  if (ctx) { ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return; // no audio support: the game still works, just silently
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_VOLUME;
  master.connect(ctx.destination);

  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  loadFiles();
}

// Look for sound files. Any that are missing just use the generated sound.
// (Missing files may show as "404 not found" in the browser console. That's harmless.)
function loadFiles() {
  for (const name of SOUND_NAMES) {
    const url = SOUND_FILES[name];
    if (!url) continue;
    fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((data) => (data ? ctx.decodeAudioData(data) : null))
      .then((buffer) => { if (buffer) fileBuffers[name] = buffer; })
      .catch(() => {}); // not there or not a valid audio file: use the generated sound
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
  return muted;
}

// ---------- Playing a sound ----------
// options:
//   volume  0..1 (default 1)
//   pitch   pitch multiplier before the random variation (default 1)
//   pan     -1 (left) to 1 (right), for sounds coming from a direction
//   weight  0 (light) to 1 (heavy), used by the generated swoosh
export function play(name, options = {}) {
  if (!ctx || muted) return;
  const volume = options.volume ?? 1;
  const pitch = (options.pitch ?? 1) * (1 + (Math.random() * 2 - 1) * PITCH_VARIATION);

  // Route through a volume knob and (optionally) a left/right panner
  const out = ctx.createGain();
  out.gain.value = volume;
  if (options.pan && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, options.pan));
    out.connect(panner);
    panner.connect(master);
  } else {
    out.connect(master);
  }

  // A real audio file was dropped in? Play that.
  if (fileBuffers[name]) {
    const src = ctx.createBufferSource();
    src.buffer = fileBuffers[name];
    src.playbackRate.value = pitch;
    src.connect(out);
    src.start();
    return;
  }

  // Otherwise generate the placeholder sound
  const recipe = RECIPES[name];
  if (recipe) recipe(out, pitch, options);
}

// =============================================================
//  Generated placeholder sounds
// =============================================================
// Small building blocks first, then one "recipe" per sound.

// A burst of filtered noise. type: 'lowpass' | 'highpass' | 'bandpass'
function noise(out, { start = 0, duration, type = 'bandpass', freqFrom, freqTo = freqFrom, q = 1, gain = 1, attack = 0.005 }) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freqFrom, t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 20), t + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  src.connect(filter).connect(env).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + duration + 0.05);
}

// A tone that slides in pitch. wave: 'sine' | 'triangle' | 'sawtooth' | 'square'
function tone(out, { start = 0, duration, wave = 'sine', freqFrom, freqTo = freqFrom, gain = 1, attack = 0.005, filterFreq = null }) {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  osc.type = wave;
  osc.frequency.setValueAtTime(freqFrom, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqTo, 20), t + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  let node = osc;
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    node = osc.connect(f);
  }
  node.connect(env).connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

// A voice-like sound: a buzzy tone shaped by two "vowel" filters (formants).
// vowel = [first formant Hz, second formant Hz], e.g. "uh" = [600, 1000]
function voice(out, { duration, freqFrom, freqTo, vowel, gain = 1, attack = 0.03, wobble = 0 }) {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freqFrom, t);
  osc.frequency.exponentialRampToValueAtTime(freqTo, t + duration);
  if (wobble) {
    // slow wavering, for groans
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5 + Math.random() * 2;
    lfoGain.gain.value = wobble;
    lfo.connect(lfoGain).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + duration + 0.05);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.setValueAtTime(gain, t + duration * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  for (const [freq, q, g] of [[vowel[0], 6, 1], [vowel[1], 8, 0.5]]) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const fg = ctx.createGain();
    fg.gain.value = g;
    osc.connect(f).connect(fg).connect(env);
  }
  env.connect(out);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

const RECIPES = {
  // Swoosh: air rushing past, sweeping from high to low. Heavier = lower, longer, louder.
  swingLight(out, pitch, { weight = 0.3 }) {
    const w = Math.min(Math.max(weight, 0), 1);
    const duration = 0.16 + w * 0.12;
    noise(out, { duration, type: 'bandpass', freqFrom: (2600 - w * 1200) * pitch, freqTo: (900 - w * 400) * pitch, q: 1.2, gain: 1.1 + w * 0.3, attack: duration * 0.4 });
  },
  swingHeavy(out, pitch, { weight = 0.8 }) {
    const w = Math.min(Math.max(weight, 0), 1.4);
    const duration = 0.26 + w * 0.14;
    noise(out, { duration, type: 'bandpass', freqFrom: (1300 - w * 400) * pitch, freqTo: (320 - w * 80) * pitch, q: 0.9, gain: 1.5, attack: duration * 0.45 });
    noise(out, { duration: duration * 0.9, type: 'lowpass', freqFrom: 400 * pitch, freqTo: 150 * pitch, q: 0.7, gain: 0.7, attack: duration * 0.5 });
  },

  // Meaty impact: a deep thump plus a short wet crunch
  hitFlesh(out, pitch) {
    tone(out, { duration: 0.18, wave: 'sine', freqFrom: 140 * pitch, freqTo: 45 * pitch, gain: 1 });
    noise(out, { duration: 0.12, type: 'lowpass', freqFrom: 1800 * pitch, freqTo: 300 * pitch, q: 2, gain: 0.8 });
    noise(out, { start: 0.02, duration: 0.09, type: 'bandpass', freqFrom: 700 * pitch, freqTo: 400 * pitch, q: 4, gain: 0.4 });
  },
  // Bony crack: a sharp click plus a hollow knock
  hitBone(out, pitch) {
    noise(out, { duration: 0.05, type: 'highpass', freqFrom: 2500 * pitch, q: 1, gain: 0.9 });
    tone(out, { duration: 0.1, wave: 'triangle', freqFrom: 420 * pitch, freqTo: 260 * pitch, gain: 0.6 });
    tone(out, { start: 0.015, duration: 0.14, wave: 'sine', freqFrom: 110 * pitch, freqTo: 60 * pitch, gain: 0.6 });
  },
  // Straw rustle: soft crunchy noise
  hitStraw(out, pitch) {
    noise(out, { duration: 0.18, type: 'bandpass', freqFrom: 3000 * pitch, freqTo: 1500 * pitch, q: 0.8, gain: 0.5 });
    tone(out, { duration: 0.1, wave: 'sine', freqFrom: 120 * pitch, freqTo: 70 * pitch, gain: 0.4 });
  },
  // Dull thud on a wooden shield: low knock, muffled
  hitShield(out, pitch) {
    tone(out, { duration: 0.22, wave: 'triangle', freqFrom: 160 * pitch, freqTo: 70 * pitch, gain: 0.9, filterFreq: 600 });
    noise(out, { duration: 0.12, type: 'lowpass', freqFrom: 900 * pitch, freqTo: 200 * pitch, q: 1, gain: 0.7 });
  },
  // Metal clang: a few ringing, slightly out-of-tune tones
  blockWeapon(out, pitch) {
    for (const [f, g] of [[620, 0.28], [987, 0.2], [1530, 0.14], [2210, 0.08]]) {
      tone(out, { duration: 0.45, wave: 'sine', freqFrom: f * pitch, freqTo: f * pitch * 0.98, gain: g, attack: 0.002 });
    }
    noise(out, { duration: 0.05, type: 'highpass', freqFrom: 3000, q: 1, gain: 0.5 });
  },
  // Swing hitting stone: dull, short, gritty
  hitWall(out, pitch) {
    tone(out, { duration: 0.12, wave: 'sine', freqFrom: 110 * pitch, freqTo: 55 * pitch, gain: 0.8 });
    noise(out, { duration: 0.1, type: 'lowpass', freqFrom: 1200 * pitch, freqTo: 400 * pitch, q: 1.5, gain: 0.6 });
    noise(out, { start: 0.01, duration: 0.15, type: 'highpass', freqFrom: 2500, q: 0.5, gain: 0.15 }); // grit
  },
  // Effort grunt: short "uhh"
  playerGrunt(out, pitch) {
    voice(out, { duration: 0.18, freqFrom: 135 * pitch, freqTo: 105 * pitch, vowel: [600, 1000], gain: 2.2, attack: 0.02 });
    noise(out, { duration: 0.14, type: 'bandpass', freqFrom: 1200, freqTo: 800, q: 1, gain: 0.08 }); // breath
  },
  // Pained grunt: higher, longer "ahh", falling
  playerHurt(out, pitch) {
    voice(out, { duration: 0.32, freqFrom: 190 * pitch, freqTo: 120 * pitch, vowel: [780, 1180], gain: 2.4, attack: 0.015 });
    noise(out, { duration: 0.2, type: 'bandpass', freqFrom: 1400, freqTo: 900, q: 1, gain: 0.1 });
  },
  // Low groan: slow, wavering "ohh". options.pitch makes bosses deeper.
  enemyGroan(out, pitch) {
    const duration = 0.9 + Math.random() * 0.6;
    voice(out, { duration, freqFrom: 85 * pitch, freqTo: 62 * pitch, vowel: [420, 780], gain: 2.6, attack: 0.25, wobble: 3 });
  },
  // Skeleton rattle: a quick series of bony clicks
  boneRattle(out, pitch) {
    const clicks = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < clicks; i++) {
      const start = i * (0.035 + Math.random() * 0.03);
      noise(out, { start, duration: 0.03, type: 'bandpass', freqFrom: (1800 + Math.random() * 1200) * pitch, q: 6, gain: 3.0 });
    }
  },
};
