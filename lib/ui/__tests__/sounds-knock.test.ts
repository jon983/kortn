// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

// A fake Web Audio context recording each oscillator (start/stop) and noise burst.
const oscs: { start: number; stop: number }[] = [];
const noises: { start: number; filter: string }[] = [];
const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
(window as any).AudioContext = class {
  state = 'running'; currentTime = 0; destination = {}; sampleRate = 44100;
  createGain() { return { gain: param(), connect: (n: any) => n }; }
  createBuffer(_ch: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  createBiquadFilter() { const f = { type: '', frequency: param(), Q: param(), connect: (n: any) => n }; return f; }
  createBufferSource() {
    const s: any = { buffer: null, connect: (n: any) => { s.filter = n.type; return n; }, start(t: number) { noises.push({ start: t, filter: s.filter }); }, stop() {} };
    return s;
  }
  createOscillator() {
    let start = 0;
    return { type: 'sine', frequency: param(), connect: (n: any) => n, start(t: number) { start = t; }, stop(t: number) { oscs.push({ start, stop: t }); } };
  }
};

describe('your-turn sound', () => {
  it('is two quick knocks on the wooden table, over in about half a second', async () => {
    const { playYourTurn } = await import('../table/sounds');
    playYourTurn();
    const starts = [...new Set(oscs.map((o) => o.start.toFixed(2)))];
    expect(starts).toEqual(['0.00', '0.16']); // two knocks
    expect(Math.max(...oscs.map((o) => o.stop))).toBeLessThan(0.6);
    // each knock has a band-passed click of noise (the knuckle on the wood)
    expect(noises.map((n) => n.start.toFixed(2))).toEqual(['0.00', '0.16']);
    expect(noises.every((n) => n.filter === 'bandpass')).toBe(true);
  });
});
