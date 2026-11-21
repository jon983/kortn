// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hand, sortHand } from '../Hand';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string, pack = 'A'): Card =>
  ({ id: `${pack}-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: pack as any });
const joker = (): Card => ({ id: 'A-joker', kind: 'joker', pack: 'A' } as any);

describe('sortHand', () => {
  it('orders by rank ascending with jokers last, deterministically', () => {
    const out = sortHand([nat(9, 'clubs'), joker(), nat(3, 'hearts'), nat(9, 'diamonds')]);
    expect(out.map((c) => c.id)).toEqual(['A-hearts-3', 'A-clubs-9', 'A-diamonds-9', 'A-joker']);
  });
});

const card = (c: Card) => ({ id: c.id, card: c });
const space = (id: string) => ({ id, card: null });

describe('Hand', () => {
  it('toggles selection on a tap (pointer down/up without movement)', () => {
    const onToggle = vi.fn();
    const onReorder = vi.fn();
    render(<Hand items={[card(nat(5, 'hearts'))]} selectedIds={[]} onToggle={onToggle} onReorder={onReorder} />);
    const el = screen.getAllByText('5')[0];
    fireEvent.pointerDown(el, { clientX: 10, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 10, pointerId: 1 });
    expect(onToggle).toHaveBeenCalledWith('A-hearts-5');
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('reorders (not selects) when the pointer moves past the threshold', () => {
    const onToggle = vi.fn();
    const onReorder = vi.fn();
    render(<Hand items={[card(nat(5, 'hearts')), card(nat(9, 'clubs'))]} selectedIds={[]} onToggle={onToggle} onReorder={onReorder} />);
    const el = screen.getAllByText('5')[0];
    fireEvent.pointerDown(el, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(el, { clientX: 40, pointerId: 1 });
    fireEvent.pointerUp(el, { clientX: 40, pointerId: 1 });
    expect(onReorder).toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('removes a spacer dragged off the end', () => {
    const onReorder = vi.fn();
    const { container } = render(
      <Hand
        items={[card(nat(5, 'hearts')), card(nat(9, 'clubs')), space('__space_1')]}
        selectedIds={[]} onToggle={() => {}} onReorder={onReorder}
      />,
    );
    const sp = container.querySelector('[data-card-id="__space_1"]') as HTMLElement;
    // already at the last index: a drag that ends there removes it
    fireEvent.pointerDown(sp, { clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(sp, { clientX: 40, pointerId: 1 });
    fireEvent.pointerUp(sp, { clientX: 40, pointerId: 1 });
    expect(onReorder).toHaveBeenLastCalledWith(['A-hearts-5', 'A-clubs-9']);
  });
});

describe('fanOverlap (the hand fits narrow screens)', () => {
  it('keeps the usual overlap when there is room', async () => {
    const { fanOverlap } = await import('../Hand');
    const items = Array.from({ length: 13 }, (_, i) => card(nat(i + 2, 'clubs')));
    expect(fanOverlap(items, 1200)).toBe(40);
    expect(fanOverlap(items, 0)).toBe(40); // not measured yet
  });
  it('overlaps more so 13 cards fit a phone, but always leaves the corner index showing', async () => {
    const { fanOverlap, handWidth } = await import('../Hand');
    const items = Array.from({ length: 13 }, (_, i) => card(nat((i % 13) + 2, 'clubs')));
    const ov = fanOverlap(items, 366);
    expect(handWidth(items, ov)).toBeLessThanOrEqual(366);
    expect(96 - ov).toBeGreaterThanOrEqual(18); // ≥18px of each card still visible
  });
  it('counts spacers, which never overlap', async () => {
    const { fanOverlap, handWidth } = await import('../Hand');
    const items = [card(nat(2, 'clubs')), card(nat(3, 'clubs')), space('s1'), ...Array.from({ length: 11 }, (_, i) => card(nat(i + 4, 'hearts')))];
    const ov = fanOverlap(items, 440);
    expect(handWidth(items, ov)).toBeLessThanOrEqual(440);
    // too narrow even at the tightest fan: stop at the corner-index limit (the row scrolls)
    expect(96 - fanOverlap(items, 300)).toBe(18);
  });
});
