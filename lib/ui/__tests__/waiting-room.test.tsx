// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../../../app/actions/match', () => ({
  getLobbyState: vi.fn(async () => ({ seats: 4, hostUserId: 'u1', status: 'lobby',
    players: [{ seat: 0, name: 'You' }, { seat: 1, name: 'Ruth' }] })),
  startGameAction: vi.fn(async () => ({ ok: true })),
}));
// jsdom lacks EventSource
beforeEach(() => { (globalThis as any).EventSource = class { close() {} addEventListener() {} onmessage: any; }; });

import { WaitingRoom } from '../../../app/match/[id]/lobby/WaitingRoom';

describe('WaitingRoom', () => {
  it('shows the code, seated names, empty seats, and a disabled Deal until full', async () => {
    render(<WaitingRoom matchId="m1" joinCode="MIRZ" viewerId="u1"
      initial={{ seats: 4, hostUserId: 'u1', status: 'lobby', players: [{ seat: 0, name: 'You' }, { seat: 1, name: 'Ruth' }] }} />);
    expect(screen.getByText('MIRZ')).toBeInTheDocument();
    expect(screen.getByText('Ruth')).toBeInTheDocument();
    expect(screen.getAllByText(/waiting/i).length).toBeGreaterThan(0);   // 2 empty seats
    expect(screen.getByRole('button', { name: /deal/i })).toBeDisabled(); // not full
  });
});
