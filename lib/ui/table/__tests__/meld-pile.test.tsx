// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { MeldPile } from '../MeldPile';

const nat = (rank: number) => ({ id: `A-hearts-${rank}`, kind: 'natural', rank, suit: 'hearts', pack: 'A' }) as any;

describe('MeldPile', () => {
  it('a meld settles in when it lands', () => {
    const { container } = render(<MeldPile meld={{ id: 'm1', kind: 'run', ownerSeat: 0, cards: [nat(4), nat(5), nat(6)] } as any} />);
    expect(container.querySelector('[data-meld]')!.className).toContain('meld-land');
  });
  it('after landing, a lay-off flash still pulses (the settle no longer overrides it)', () => {
    vi.useFakeTimers();
    const meld = { id: 'm1', kind: 'run', ownerSeat: 0, cards: [nat(4), nat(5), nat(6)] } as any;
    const { container, rerender } = render(<MeldPile meld={meld} />);
    act(() => { vi.advanceTimersByTime(400); });
    rerender(<MeldPile meld={{ ...meld, cards: [...meld.cards, nat(7)] }} flash />);
    const el = container.querySelector('[data-meld]')!;
    expect(el.className).toContain('animate-pulse');
    expect(el.className).not.toContain('meld-land');
  });
});
afterEach(() => { vi.useRealTimers(); });
