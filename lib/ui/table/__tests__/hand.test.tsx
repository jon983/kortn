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
