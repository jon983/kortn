// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { LeaderboardTabs } from '../../../app/LeaderboardTabs';
import type { Leaderboards } from '../../stats/hands';

const e = (userId: string, name: string, value: number) => ({ userId, name, value, hands: 50, count: 10 });
const boards: Leaderboards = {
  vsPar: [e('j', 'Jonathan', 1.36), e('i', 'Ines', 0.71)],
  pointsPerHand: [e('j', 'Jonathan', 11.3)],
  winsPer100: [e('i', 'Ines', 61.9), e('j', 'Jonathan', 32)],
  kalookisPer100: [],
  treasuresPer100: [],
};

describe('LeaderboardTabs', () => {
  it('switches lists when a tab is clicked (no View Transitions support needed)', () => {
    render(<LeaderboardTabs boards={boards} meId="j" minHands={10} />);
    const first = () => within(screen.getByRole('tabpanel')).getAllByRole('listitem')[0];
    expect(first()).toHaveTextContent('Jonathan');
    fireEvent.click(screen.getByRole('tab', { name: 'Wins' }));
    expect(first()).toHaveTextContent('Ines');
    expect(screen.getByRole('tab', { name: 'Wins' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'vs par' })).toHaveAttribute('aria-selected', 'false');
  });
});
