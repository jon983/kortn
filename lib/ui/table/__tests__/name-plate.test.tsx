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
  it('long names can wrap', () => {
    seat({ name: 'Bartholomew-Featherstonehaugh' });
    expect(screen.getByText('Bartholomew-Featherstonehaugh').className).toContain('[overflow-wrap:anywhere]');
  });
});
