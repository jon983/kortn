// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
const createTableAction = vi.fn();
vi.mock('../../../app/actions/lobby', () => ({ createTableAction: (fd: FormData) => createTableAction(fd) }));
import { SetTablePill } from '../../../app/SetTablePill';

beforeEach(() => { refresh.mockReset(); createTableAction.mockReset(); });

describe('SetTablePill', () => {
  it('opens in place with a choice of chairs (4 by default)', () => {
    render(<SetTablePill />);
    fireEvent.click(screen.getByRole('button', { name: /set the table/i }));
    for (const n of ['2', '3', '4', '5']) expect(screen.getByRole('button', { name: n })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/bits/i)).toBeNull(); // no buy-in reminder
  });

  it('sets a table with the chosen chairs and stays in the kitchen', async () => {
    createTableAction.mockResolvedValue({ matchId: 'm1', joinCode: 'ABCD' });
    render(<SetTablePill />);
    fireEvent.click(screen.getByRole('button', { name: /set the table/i }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    fireEvent.click(screen.getByRole('button', { name: /deal us in/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect((createTableAction.mock.calls[0][0] as FormData).get('seats')).toBe('3');
    expect(screen.getByRole('button', { name: /set the table/i })).toBeInTheDocument(); // collapsed again
  });

  it('shows a problem inline and never sticks', async () => {
    createTableAction.mockRejectedValue(new Error('boom'));
    render(<SetTablePill />);
    fireEvent.click(screen.getByRole('button', { name: /set the table/i }));
    fireEvent.click(screen.getByRole('button', { name: /deal us in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
    expect(screen.getByRole('button', { name: /deal us in/i })).not.toBeDisabled();
  });
});
