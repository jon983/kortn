export type SeatPos = { seat: number; xPct: number; yPct: number };

export function tableKind(seats: number): 'square' | 'pentagon' {
  return seats === 5 ? 'pentagon' : 'square';
}

// Square side midpoints, ordered: top, right, bottom, left.
const SQUARE_SIDES: Array<[number, number]> = [
  [50, 2], [98, 50], [50, 98], [2, 50],
];
// For 2 players use opposite sides (top, bottom); 3 use top,right,left; 4 use all.
const SQUARE_BY_COUNT: Record<number, Array<[number, number]>> = {
  2: [SQUARE_SIDES[0], SQUARE_SIDES[2]],
  3: [SQUARE_SIDES[0], SQUARE_SIDES[1], SQUARE_SIDES[3]],
  4: SQUARE_SIDES,
};

// Pentagon (point up) edge midpoints, computed once. Vertices at angles 90,162,234,306,18 deg.
function pentagonEdgeMidpoints(): Array<[number, number]> {
  const cx = 50, cy = 52, r = 52;
  const vAng = [90, 162, 234, 306, 18].map((d) => (d * Math.PI) / 180);
  const verts = vAng.map((a) => [cx + r * Math.cos(a), cy - r * Math.sin(a)] as [number, number]);
  const mids: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    const a = verts[i], b = verts[(i + 1) % 5];
    mids.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
  }
  return mids;
}

export function seatPositions(seats: number): SeatPos[] {
  const raw = seats === 5 ? pentagonEdgeMidpoints() : SQUARE_BY_COUNT[seats];
  if (!raw) throw new Error(`Unsupported seat count: ${seats}`);
  return raw.map(([x, y], seat) => ({
    seat,
    xPct: Math.max(0, Math.min(100, x)),
    yPct: Math.max(0, Math.min(100, y)),
  }));
}

/**
 * Seat the opponents around the viewer (who is always at the bottom) so play
 * runs clockwise on every screen: play passes seat → seat+1, so the next seat
 * to act sits on your left, then across the top (left → right), then on your
 * right. 2p → top; 3p → left/right; 4p → left/top/right; 5p → left/top×2/right.
 */
export function seatAround<T extends { seat: number }>(
  mySeat: number,
  seats: number,
  opponents: T[],
): { left: T[]; top: T[]; right: T[] } {
  const rel = (s: number) => (s - mySeat + seats) % seats;
  const o = [...opponents].sort((a, b) => rel(a.seat) - rel(b.seat));
  if (o.length <= 1) return { left: [], top: o, right: [] };
  if (o.length === 2) return { left: [o[0]], top: [], right: [o[1]] };
  return { left: [o[0]], top: o.slice(1, -1), right: [o[o.length - 1]] };
}
