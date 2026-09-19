// lib/ui/table/__tests__/table-view.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../useMatchStream', () => ({ useMatchStream: (_id: string, initial: any) => initial }));
const playAction = vi.fn(async (_id: string, _action: any) => ({ ok: true as const }));
vi.mock('../../../../app/actions/play', () => ({ playAction: (id: string, action: any) => playAction(id, action) }));

import { TableView } from '../TableView';
import type { Card } from '../../../kalooki';
const nat = (r: number, s: string, p = 'A'): Card => ({ id: `${p}-${s}-${r}`, kind: 'natural', rank: r as any, suit: s as any, pack: p as any });

const baseView: any = {
  seat: 0, currentTurn: 0, phase: 'awaitingDraw',
  you: { seat: 0, hand: [nat(4, 'clubs'), nat(5, 'hearts')], handCount: 2, score: 0, status: 'active', hasOpened: false },
  opponents: [{ seat: 1, handCount: 13, score: 0, status: 'active', hasOpened: false }],
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
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /draw stock/i })).toBeNull();
  });
});
