'use client';
// Tiny Web Audio chimes — no asset files, no network, CSP-safe. Browsers block
// audio until a user gesture, so call unlockAudioOnce() to resume on first input.

let ctx: AudioContext | null = null;
let masterVolume = 1; // 0..1, set from the volume control

/** Set the master output level (0 = silent, 1 = full). */
export function setVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
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

function tone(c: AudioContext, freq: number, start: number, dur: number, gain = 0.6, type: OscillatorType = 'triangle') {
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

/** Bright rising two-note chime — "it's your turn". */
export function playYourTurn(): void {
  const c = getCtx();
  if (!c) return;
  tone(c, 659.25, 0, 0.18);   // E5
  tone(c, 987.77, 0.11, 0.3); // B5
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
