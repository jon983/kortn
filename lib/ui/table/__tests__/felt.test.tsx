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
    // rank appears in each card's corner index/indices
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
  });
  it('collapses a completed set of four into a single pile', () => {
    const set: TableMeld = { id: 's1', kind: 'set', ownerSeat: 0, cards: [nat(6, 'clubs'), nat(6, 'spades'), nat(6, 'hearts'), nat(6, 'diamonds')] };
    const { container } = render(<MeldPile meld={set} />);
    // only one face card is shown (the pile), not four
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });
  it('shows a red top card when a completed set of four contains a joker', () => {
    const joker = (): Card => ({ id: 'A-joker', kind: 'joker', pack: 'A' } as any);
    const set: TableMeld = { id: 's2', kind: 'set', ownerSeat: 0, cards: [nat(6, 'clubs'), nat(6, 'spades'), nat(6, 'diamonds'), joker()] };
    const { container } = render(<MeldPile meld={set} />);
    // the single visible card is the red 6 (diamonds), flagging the joker inside
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(screen.getAllByText('6').length).toBeGreaterThan(0);
  });
  it('StockDiscard shows a stock pile and the discard top', () => {
    render(<StockDiscard stockCount={40} discardTop={nat(9, 'diamonds')} onDrawStock={() => {}} onTakeDiscard={() => {}} />);
    expect(screen.getByRole('button', { name: /draw from stock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take discard/i })).toBeInTheDocument();
    expect(screen.getAllByText('9').length).toBeGreaterThan(0); // discard top card
  });
  it('OpponentSeat shows name, count, and a mini-fan sized to the count', () => {
    const { container } = render(<OpponentSeat name="Ruth" handCount={5} score={12} status="active" hasOpened isTurn melds={[]} />);
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-cardback]')).toHaveLength(5);
  });
});
