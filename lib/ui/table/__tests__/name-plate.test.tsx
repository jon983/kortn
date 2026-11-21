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
  it('top seat: the video sits beside the plate, not above it', () => {
    const { container } = seat({ media: <span data-testid="vid" /> });
    const row = container.querySelector('[data-plate-row]')!;
    expect(row).not.toBeNull();
    expect(row.contains(screen.getByTestId('vid'))).toBe(true);
    expect(row.contains(container.querySelector('[data-plate]'))).toBe(true);
  });
});
