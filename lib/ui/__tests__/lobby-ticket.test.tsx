// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
const startGameAction = vi.fn();
vi.mock('../../../app/actions/match', () => ({ startGameAction: (id: string) => startGameAction(id) }));
vi.mock('../../../app/actions/lobby', () => ({ leaveTableAction: vi.fn(), deleteMatchAction: vi.fn(), endGameAction: vi.fn() }));
import { LobbyTicket } from '../../../app/LobbyTicket';

beforeEach(() => { push.mockReset(); refresh.mockReset(); startGameAction.mockReset(); });

const host = { id: 'm1', number: 33, seats: 3, joinCode: 'ABCD', hostName: 'You', isHost: true };

describe('LobbyTicket', () => {
  it('host, table not full: the code, an empty chair, and Deal waiting', () => {
    render(<LobbyTicket {...host} players={[{ name: 'You', score: null }, { name: 'Ines', score: null }]} />);
    expect(screen.getByText('ABCD')).toBeInTheDocument();
    expect(screen.getAllByText(/empty chair/i)).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^deal$/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /leave/i })).toBeNull();
  });

  it('host, table full: Deal goes straight to the table', async () => {
    startGameAction.mockResolvedValue({ ok: true });
    render(<LobbyTicket {...host} players={[{ name: 'You', score: null }, { name: 'Ines', score: null }, { name: 'Rocco', score: null }]} />);
    const deal = screen.getByRole('button', { name: /^deal$/i });
    expect(deal).not.toBeDisabled();
    fireEvent.click(deal);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/match/m1/table'));
    expect(startGameAction).toHaveBeenCalledWith('m1');
  });

  it('guest: waiting for the host, with a way to leave (and no Deal or delete)', () => {
    render(<LobbyTicket {...host} isHost={false} hostName="Jonathan" players={[{ name: 'Jonathan', score: null }, { name: 'You', score: null }]} />);
    expect(screen.getByText(/waiting for Jonathan to deal · 2\/3 seated/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^deal$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('Share copies the code when there is no share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<LobbyTicket {...host} players={[{ name: 'You', score: null }]} />);
    fireEvent.click(screen.getByRole('button', { name: /share/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('ABCD'));
    expect(await screen.findByText(/copied/i)).toBeInTheDocument();
  });
});
