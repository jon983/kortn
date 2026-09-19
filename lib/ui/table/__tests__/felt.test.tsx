// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeldPile } from '../MeldPile';
import { StockDiscard } from '../StockDiscard';
import { OpponentSeat } from '../OpponentSeat';
import type { Card, TableMeld } from '../../../kalooki';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });

describe('felt pieces', () => {
  it('MeldPile renders all cards of the meld', () => {
    const meld: TableMeld = { id: 'm1', kind: 'run', ownerSeat: 0, cards: [nat(4, 'hearts'), nat(5, 'hearts'), nat(6, 'hearts')] };
    render(<MeldPile meld={meld} />);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });
  it('StockDiscard shows the stock count and discard top', () => {
    render(<StockDiscard stockCount={40} discardTop={nat(9, 'diamonds')} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });
  it('OpponentSeat shows name, count, opened badge, and a mini-fan sized to the count', () => {
    const { container } = render(<OpponentSeat name="Ruth" handCount={5} score={12} status="active" hasOpened isTurn melds={[]} />);
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(screen.getByText(/opened/i)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-cardback]')).toHaveLength(5);
  });
});
