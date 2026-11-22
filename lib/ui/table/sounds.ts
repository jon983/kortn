'use client';
// Tiny Web Audio chimes — no asset files, no network, CSP-safe. Browsers block
// audio until a user gesture, so call unlockAudioOnce() to resume on first input.

let ctx: AudioContext | null = null;
let masterVolume = 1; // 0..1, set from the volume control

/** Set the master output level (0 = silent, 1 = full). */
export function setVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
}

/** Apply the volume the player chose at the table (saved in this browser), so mute holds everywhere. */
export function loadSavedVolume(): void {
  try {
    const saved = parseFloat(localStorage.getItem('kortn-volume') ?? '');
    if (!Number.isNaN(saved)) setVolume(saved);
  } catch { /* storage blocked: keep the default */ }
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

function tone(c: AudioContext, freq: number, start: number, dur: number, gain = 1.0, type: OscillatorType = 'triangle') {
  const peak = gain * masterVolume;
  if (peak <= 0) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + start;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

/**
 * One ringing overtone of a struck bell: a soft strike, then a long fade. Two
 * sines a hair apart (±0.7 Hz) beat slowly against each other, giving the
 * gentle shimmer of a singing bowl.
 */
function ring(c: AudioContext, freq: number, gain: number, decay: number) {
  const peak = gain * masterVolume;
  if (peak <= 0) return;
  const t0 = c.currentTime;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak / 2, t0 + 0.008); // two sines share it
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  g.connect(c.destination);
  for (const beat of [-0.7, 0.7]) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq + beat;
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
}

/** Singing-bowl overtones: [ratio to the fundamental, loudness, seconds to fade]. Higher ones fade sooner. */
const BELL: [number, number, number][] = [
  [1, 0.55, 3.2],
  [2.71, 0.22, 2.2],
  [5.15, 0.1, 1.3],
  [8.43, 0.05, 0.7],
];
const BELL_PITCH = 660; // Hz; bright enough to carry over a video call

/** A struck meditation bell, ringing out for about three seconds: "it's your turn". */
export function playYourTurn(): void {
  const c = getCtx();
  if (!c) return;
  for (const [ratio, gain, decay] of BELL) ring(c, BELL_PITCH * ratio, gain, decay);
}

/** Gentle three-note descending flourish — the hand has ended. */
export function playHandEnd(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, 784.0, 0, 0.22);    // G5
  tone(c, 659.25, 0.17, 0.22); // E5
  tone(c, 523.25, 0.34, 0.42); // C5
}

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
