// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

// A fake Web Audio context that records each oscillator's wave, pitch and when it stops.
const oscs: { type: string; freq: number; stop: number }[] = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
(window as any).AudioContext = class {
  state = 'running'; currentTime = 0; destination = {};
  createGain() { return { gain: param(), connect: (n: any) => n }; }
  createOscillator() {
    const o = { type: 'sine', frequency: param(), connect: (n: any) => n, start() {}, stop(t: number) { oscs.push({ type: o.type, freq: o.frequency.value, stop: t }); } };
    return o;
  }
};

describe('your-turn sound', () => {
  it('rings like a struck bell: pure tones, bell-like (not harmonic) overtones, a long fade', async () => {
    const { playYourTurn } = await import('../table/sounds');
    playYourTurn();
    expect(oscs.length).toBeGreaterThanOrEqual(6);
    expect(oscs.every((o) => o.type === 'sine')).toBe(true);
    expect(Math.max(...oscs.map((o) => o.stop))).toBeGreaterThanOrEqual(2.5);
    const pitches = [...new Set(oscs.map((o) => Math.round(o.freq)))].sort((a, b) => a - b);
    const ratios = pitches.map((f) => f / pitches[0]).filter((r) => r > 1.5);
    // a bell's overtones fall between the harmonics, unlike a plain musical note
    expect(ratios.some((r) => Math.abs(r - Math.round(r)) > 0.2)).toBe(true);
  });
});
