// lib/ui/table/__tests__/table-view.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../useMatchStream', () => ({ useMatchStream: (_id: string, initial: any) => ({ view: initial, chat: [], connected: true }) }));
vi.mock('../ChatPanel', () => ({ ChatPanel: () => null })); // avoids pulling in the server action chain

const playAction = vi.fn(async (_id: string, _action: any) => ({ ok: true as const }));
vi.mock('../../../../app/actions/play', () => ({ playAction: (id: string, action: any) => playAction(id, action) }));

import { TableView } from '../TableView';
import type { Card } from '../../../kalooki';
const nat = (r: number, s: string, p = 'A'): Card => ({ id: `${p}-${s}-${r}`, kind: 'natural', rank: r as any, suit: s as any, pack: p as any });

const baseView: any = {
  seat: 0, currentTurn: 0, phase: 'awaitingDraw', seatNames: ['Ruth', 'Sol'],
  you: { seat: 0, hand: [nat(4, 'clubs'), nat(5, 'hearts')], handCount: 2, score: 0, bits: 0, status: 'active', hasOpened: false, drawObligationId: null },
  opponents: [{ seat: 1, handCount: 13, score: 0, bits: 0, status: 'active', hasOpened: false }],
  stockCount: 40, discard: [nat(9, 'diamonds')], melds: [],
  pot: 8, roundNumber: 1, roundFinished: false, roundWinnerSeat: null, goOutType: null,
  matchFinished: false, matchWinnerSeat: null,
};

beforeEach(() => { playAction.mockClear(); (globalThis as any).EventSource = class { close() {} } as any; });

describe('TableView', () => {
  it('renders your hand, stock/discard, and submits a draw', async () => {
    render(<TableView matchId="m1" initial={baseView} />);    fireEvent.click(screen.getByRole('button', { name: /draw from stock/i }));
    expect(playAction).toHaveBeenCalledWith('m1', { type: 'draw', source: 'stock' });
  });
  it('is read-only when not your turn', () => {
    render(<TableView matchId="m1" initial={{ ...baseView, currentTurn: 1 }} />);
    // Whose turn it is shows in the top bar; the draw affordance is not offered.
    expect(screen.getByText("Sol's move")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draw stock/i })).toBeNull();
  });
  it('adds a space at the left end of your hand', () => {
    const { container } = render(<TableView matchId="m1" initial={baseView} />);
    const handIds = () => [...container.querySelectorAll('[data-hand] [data-card-id]')].map((el) => el.getAttribute('data-card-id'));
    expect(handIds()[0]).toBe('A-clubs-4');
    fireEvent.click(screen.getByRole('button', { name: /add space/i }));
    const ids = handIds();
    expect(ids).toHaveLength(3);
    expect(ids[0]).not.toMatch(/^A-/); // the new spacer leads
    expect(ids.slice(1)).toEqual(['A-clubs-4', 'A-hearts-5']);
  });
  it('shows the Your move ribbon on your turn', () => {
    render(<TableView matchId="m1" initial={baseView} />);
    expect(screen.getByText('Your move')).toBeInTheDocument();
    expect(screen.queryByText(/your turn/i)).toBeNull();
  });
  it('header shows hand and pot tags', () => {
    render(<TableView matchId="m1" initial={baseView} />);
    expect(screen.getByText('Hand 1')).toBeInTheDocument();
    expect(screen.getByText('Pot 8 bits')).toBeInTheDocument();
  });
  it('your plate has no name, and wears the ribbon on your turn', () => {
    const { container } = render(<TableView matchId="m1" initial={baseView} />);
    const you = container.querySelector('[data-you-seat]')!;
    expect(you.textContent).toContain('2 cards · 0 pts');
    expect(you.textContent).not.toContain('Ruth');
    expect(you.querySelector('[data-turn-ribbon]')).not.toBeNull();
  });
});
