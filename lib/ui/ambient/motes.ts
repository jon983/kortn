/** One floating dust mote. left/top in %, size/blur/driftX in px, duration/delay in seconds. */
export interface Mote { left: number; top: number; size: number; blur: number; duration: number; delay: number; driftX: number }

/** Small seeded PRNG (mulberry32) so the server and client render identical dust. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);
const round = (n: number) => Math.round(n * 100) / 100;

export function makeMotes(count: number, seed: number): Mote[] {
  const r = rng(seed);
  return Array.from({ length: count }, () => {
    const size = between(r, 1.5, 4.5);
    return {
      // Most dust floats in the open margins either side of the centred panels,
      // where it can actually be seen; a few drift anywhere.
      left: round(r() < 0.8 ? (r() < 0.5 ? between(r, 0, 17) : between(r, 83, 100)) : between(r, 0, 100)),
      top: round(between(r, 40, 100)),
      size: round(size),
      // Bigger motes read as nearer the eye: a touch more blur.
      blur: round(size > 3.2 ? between(r, 0.8, 1.6) : between(r, 0, 0.6)),
      duration: round(between(r, 9, 22)),
      delay: round(between(r, 0, 22)),
      driftX: round(between(r, -40, 40)),
    };
  });
}
