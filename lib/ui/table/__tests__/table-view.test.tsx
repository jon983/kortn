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
    expect(screen.getByText("Sol's turn")).toBeInTheDocument();
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
  it('shows the Your turn ribbon on your turn', () => {
    render(<TableView matchId="m1" initial={baseView} />);
    expect(screen.getAllByText(/your turn/i)).toHaveLength(1);
  });
  it('your hand sits in the middle of three columns with equal sides (stays centred)', () => {
    const { container } = render(<TableView matchId="m1" initial={baseView} />);
    const row = container.querySelector('[data-hand-row]')!;
    expect(row.className).toContain('grid-cols-[1fr_minmax(0,auto)_1fr]');
    expect(row.children[1].hasAttribute('data-hand')).toBe(true);
  });
  it('the table photo starts below the header (landscape, or portrait on upright screens)', () => {
    const { container } = render(<TableView matchId="m1" initial={baseView} />);
    const surface = container.querySelector('[data-table-surface]')!;
    const header = container.querySelector('[data-table-header]')!;
    expect(surface).not.toBeNull();
    expect(surface.parentElement!.contains(header)).toBe(false);
    const photo = surface.querySelector('[data-table-photo]')!;
    expect(photo.className).toContain('bg-[url(/art/table-surface.jpg)]');
    expect(photo.className).toContain('portrait:bg-[url(/art/table-surface-portrait.jpg)]');
  });
  it('a cream trim line separates the header from the table', () => {
    const { container } = render(<TableView matchId="m1" initial={baseView} />);
    expect(container.querySelector('[data-table-header]')!.className).toContain('var(--color-deli-cream)');
  });
  it('side players sit in from the table edge (on the green, not the chrome)', () => {
    const view = { ...baseView, seatNames: ['Ruth', 'Sol', 'Ines'], opponents: [...baseView.opponents, { ...baseView.opponents[0], seat: 2 }] };
    const { container } = render(<TableView matchId="m1" initial={view} />);
    expect(container.querySelector('[data-seat-column="left"]')!.className).toContain('table-seat-inset');
    expect(container.querySelector('[data-seat-column="right"]')!.className).toContain('table-seat-inset');
  });
  it('phones: the hand gets the full width, with the four buttons in a row above it', () => {
    const { container } = render(<TableView matchId="m1" initial={baseView} />);
    const row = container.querySelector('[data-hand-row]')!;
    expect(row.className).toContain('grid-cols-2');
    expect(row.className).toContain('sm:grid-cols-[1fr_minmax(0,auto)_1fr]');
    const hand = row.querySelector('[data-hand]')!;
    expect(hand.className).toContain('col-span-2');
    expect(hand.className).toContain('row-start-2');
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
  it('Scores opens the order pad', () => {
    render(<TableView matchId="m1" initial={{ ...baseView, history: [] }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Scores' }));
    expect(screen.getByRole('heading', { name: 'Scores' })).toBeInTheDocument();
    expect(screen.queryByText(/scorecard/i)).toBeNull();
  });
});
