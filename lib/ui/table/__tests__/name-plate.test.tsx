// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpponentSeat } from '../OpponentSeat';

const seat = (over: Partial<Parameters<typeof OpponentSeat>[0]> = {}) =>
  render(<OpponentSeat name="Ines" handCount={13} score={43} status="active" isTurn={false} melds={[]} {...over} />);

describe('name plates', () => {
  it('shows the name and the count line on a cream plate', () => {
    const { container } = seat();
    expect(screen.getByText('Ines')).toBeInTheDocument();
    expect(screen.getByText('13 cards · 43 pts')).toBeInTheDocument();
    expect(container.querySelector('[data-plate]')!.className).toContain('bg-deli-cream');
  });
  it('wears the turn ribbon only on their turn', () => {
    expect(seat({ isTurn: true }).container.querySelector('[data-turn-ribbon]')).not.toBeNull();
  });
  it('no ribbon when it is not their turn', () => {
    expect(seat().container.querySelector('[data-turn-ribbon]')).toBeNull();
  });
  it('long names wrap inside a width-capped plate (short names stay whole)', () => {
    const { container } = seat({ name: 'Bartholomew-Featherstonehaugh' });
    expect(screen.getByText('Bartholomew-Featherstonehaugh').className).toContain('break-words');
    expect(container.querySelector('[data-plate]')!.className).toMatch(/max-w-\[34vw\]/);
  });
  it('top seat: the video shares one grid with the plate and the cards (beside them, not above)', () => {
    const { container } = seat({ media: <span data-testid="vid" /> });
    const grid = container.querySelector('[data-seat-grid]')!;
    expect(grid).not.toBeNull();
    expect(grid.contains(screen.getByTestId('vid'))).toBe(true);
    expect(grid.contains(container.querySelector('[data-plate]'))).toBe(true);
    expect(grid.contains(container.querySelector('[data-cardback]'))).toBe(true);
    // wider screens: the video spans both rows, to the left of plate and cards
    expect(screen.getByTestId('vid').parentElement!.className).toContain('sm:[grid-row:1/span_2]');
  });
  it('a lone top seat balances its columns so the cards stay centred; several top seats do not', () => {
    const lone = seat({ media: <span />, centreHand: true }).container.querySelector('[data-seat-grid]')!;
    expect(lone.className).toContain('grid-cols-[1fr_auto_1fr]');
    expect(lone.className).not.toContain('sm:grid-cols-[auto_auto]');
    const shared = seat({ media: <span /> }).container.querySelector('[data-seat-grid]')!;
    expect(shared.className).toContain('sm:grid-cols-[auto_auto]');
  });
  it('small screens show just the name plate — no card backs — for top and side seats', () => {
    for (const side of [undefined, 'left'] as const) {
      const { container, unmount } = seat({ side });
      const backs = container.querySelector('[data-cardback]')!;
      expect(backs.closest('.max-sm\\:hidden')).not.toBeNull();
      expect(container.querySelector('[data-plate]')!.closest('.max-sm\\:hidden')).toBeNull();
      unmount();
    }
  });
  it('top seat: the melds start below the table’s cream line (a spacer shares the plate’s grid cell)', () => {
    const { container } = seat({ melds: [{ id: 'm1', ownerSeat: 1, cards: [] } as any] });
    const clear = container.querySelector('[data-line-clear]')!;
    expect(clear).not.toBeNull();
    expect(clear.className).toContain('table-line-clear');
    // the spacer and the plate+cards overlap in one cell, so the cell is as tall as the taller of them
    const cell = clear.parentElement!;
    expect(cell.contains(container.querySelector('[data-seat-grid]'))).toBe(true);
    expect(cell.className).toContain('grid');
    // the melds come after that cell
    expect(cell.nextElementSibling).not.toBeNull();
  });
  it('side seats have no line spacer', () => {
    expect(seat({ side: 'left' }).container.querySelector('[data-line-clear]')).toBeNull();
  });
});
