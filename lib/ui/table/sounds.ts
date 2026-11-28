'use client';
// Tiny Web Audio chimes — no asset files, no network, CSP-safe. Browsers block
// audio until a user gesture, so call unlockAudioOnce() to resume on first input.

let ctx: AudioContext | null = null;
let masterVolume = 1; // 0..1, set from the volume control

/** Set the master output level (0 = silent, 1 = full). */
export function setVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
}

/** Apply the volume and your-turn sound the player chose at the table (saved in this browser), so they hold everywhere. */
export function loadSavedVolume(): void {
  try {
    const saved = parseFloat(localStorage.getItem('kortn-volume') ?? '');
    if (!Number.isNaN(saved)) setVolume(saved);
  } catch { /* storage blocked: keep the default */ }
  setTurnSound(savedTurnSound());
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** Create/resume the audio context — safe to call from a user gesture to unlock. */
export function primeAudio(): void {
  getCtx();
}

/**
 * One sine partial: a quick attack, then an exponential fade (time constant
 * `tau` seconds). `glide` starts the pitch that much higher and lets it drop,
 * like the thump of a knuckle on wood.
 */
function partial(c: AudioContext, at: number, freq: number, amp: number, tau: number, atk = 0.004, glide = 0) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * (1 + glide), t0);
  if (glide) osc.frequency.setTargetAtTime(freq, t0, 0.02);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(amp, t0 + atk);
  g.gain.setTargetAtTime(0, t0 + atk, tau);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + atk + tau * 9);
}

let noiseBuf: AudioBuffer | null = null;
/** A short burst of band-passed noise: the click of a knuckle or the snap of a card. */
function click(c: AudioContext, at: number, centre: number, q: number, amp: number, tau: number) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 0.25), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  const bp = c.createBiquadFilter();
  const g = c.createGain();
  src.buffer = noiseBuf;
  bp.type = 'bandpass';
  bp.frequency.value = centre;
  bp.Q.value = q;
  g.gain.setValueAtTime(amp, t0);
  g.gain.setTargetAtTime(0, t0, tau);
  src.connect(bp).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + tau * 9);
}

/** The your-turn sounds a player can choose from (the volume control), each under a second. */
export const TURN_SOUNDS = [
  { id: 'knock', label: 'Knock' },
  { id: 'marimba', label: 'Marimba' },
  { id: 'ding', label: 'Ding' },
  { id: 'pop', label: 'Pop' },
  { id: 'snap', label: 'Card snap' },
] as const;
export type TurnSound = (typeof TURN_SOUNDS)[number]['id'];
const isTurnSound = (v: unknown): v is TurnSound => TURN_SOUNDS.some((s) => s.id === v);

// Recipes, each given a level (k) so they all peak at the same loudness.
const RECIPES: Record<TurnSound, (c: AudioContext, k: number) => void> = {
  // Two knocks on the wooden table.
  knock: (c, k) => {
    for (const at of [0, 0.16]) {
      partial(c, at, 170, 1 * k, 0.035, 0.002, 0.4);
      partial(c, at, 420, 0.5 * k, 0.02, 0.002);
      partial(c, at, 900, 0.25 * k, 0.01, 0.001);
      click(c, at, 1800, 1.5, 0.35 * k, 0.006);
    }
  },
  // Two warm wooden notes, rising (G4 → C5).
  marimba: (c, k) => {
    for (const [at, f] of [[0, 392], [0.12, 523.25]]) {
      partial(c, at, f, 1 * k, 0.16, 0.003);
      partial(c, at, f * 3.93, 0.35 * k, 0.025, 0.002);
      partial(c, at, f * 9.2, 0.08 * k, 0.008, 0.001);
    }
  },
  // One light counter-bell ding, gone in about a second.
  ding: (c, k) => {
    for (const [r, a, tau] of [[1, 1, 0.22], [2.76, 0.3, 0.09], [5.4, 0.12, 0.04]]) partial(c, 0, 1320 * r, a * k, tau, 0.002);
  },
  // A soft, rounded pop, like a cork.
  pop: (c, k) => {
    partial(c, 0, 520, 1 * k, 0.045, 0.003, -0.35);
    partial(c, 0, 1040, 0.15 * k, 0.02, 0.003, -0.35);
  },
  // A card flicked down on the felt: a snap, then a soft thud.
  snap: (c, k) => {
    click(c, 0, 2600, 0.9, 1 * k, 0.012);
    click(c, 0.004, 600, 1.2, 0.6 * k, 0.03);
    partial(c, 0.004, 110, 0.4 * k, 0.03, 0.003);
  },
};
const LEVEL: Record<TurnSound, number> = { knock: 0.61, marimba: 0.49, ding: 0.59, pop: 0.77, snap: 1.15 };

let turnSound: TurnSound = 'knock';
/** Choose the your-turn sound (falls back to the knock for anything unknown). */
export function setTurnSound(id: string): void {
  turnSound = isTurnSound(id) ? id : 'knock';
}
/** The your-turn sound saved in this browser, or the knock. */
export function savedTurnSound(): TurnSound {
  try {
    const v = localStorage.getItem('kortn-turn-sound');
    return isTurnSound(v) ? v : 'knock';
  } catch { return 'knock'; }
}

/** "It's your turn": the sound the player chose (two knocks by default). */
export function playYourTurn(sound: TurnSound = turnSound): void {
  if (masterVolume <= 0) return;
  const c = getCtx();
  if (!c) return;
  RECIPES[sound](c, LEVEL[sound] * masterVolume);
}

/**
 * The hand has ended: a warm, rising vibraphone flourish. C5-E5-G5 rolled into
 * a chord that settles on a ringing C6, over a soft low C. Each note is a
 * mallet tone (a fundamental plus a quick overtone) with a barely detuned twin
 * for a gentle shimmer. About a second and a quarter.
 */
export function playHandEnd(): void {
  if (masterVolume <= 0) return;
  const c = getCtx();
  if (!c) return;
  const k = HAND_END_LEVEL * masterVolume;
  const notes: [number, number, number][] = [
    [0, 523.25, 0.35],    // C5
    [0.09, 659.25, 0.35], // E5
    [0.18, 783.99, 0.38], // G5
    [0.3, 1046.5, 0.6],   // C6, left to ring
  ];
  for (const [at, f, tau] of notes) {
    partial(c, at, f, 0.55 * k, tau, 0.004);
    partial(c, at, f * 1.003, 0.25 * k, tau, 0.004); // the shimmer
    partial(c, at, f * 4, 0.12 * k, 0.06, 0.002);    // the mallet's ping
  }
  partial(c, 0.3, 261.63, 0.35 * k, 0.5, 0.01); // C4 underneath
}
/** Keeps the flourish's chord (several notes ringing at once) about as loud as the turn sounds. */
const HAND_END_LEVEL = 0.35;

/** Prime/resume the audio context on the first user gesture. */
export function unlockAudioOnce(): void {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    getCtx();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
}
