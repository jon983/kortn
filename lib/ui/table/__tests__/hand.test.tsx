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

describe('Hand', () => {
  it('toggles selection on card click', () => {
    const onToggle = vi.fn();
    render(<Hand cards={[nat(5, 'hearts')]} selectedIds={[]} onToggle={onToggle} onReorder={() => {}} />);
    fireEvent.click(screen.getAllByText('5')[0]);
    expect(onToggle).toHaveBeenCalledWith('A-hearts-5');
  });
});
