// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));
const joinTableAction = vi.fn();
vi.mock('../../../app/actions/lobby', () => ({ joinTableAction: (fd: FormData) => joinTableAction(fd) }));
import { JoinPill } from '../../../app/JoinPill';

beforeEach(() => { push.mockReset(); refresh.mockReset(); joinTableAction.mockReset(); });

describe('JoinPill', () => {
  it('opens into a code box, submits with Enter and stays in the kitchen', async () => {
    joinTableAction.mockResolvedValue({ matchId: 'm1' });
    render(<JoinPill />);
    fireEvent.click(screen.getByRole('button', { name: /join with a code/i }));
    const input = screen.getByRole('textbox', { name: /table code/i });
    fireEvent.change(input, { target: { value: 'abcd' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /join with a code/i })).toBeInTheDocument(); // collapsed again
    expect((joinTableAction.mock.calls[0][0] as FormData).get('joinCode')).toBe('abcd');
  });
  it('shows an error inline', async () => {
    joinTableAction.mockResolvedValue({ error: 'No such match' });
    render(<JoinPill />);
    fireEvent.click(screen.getByRole('button', { name: /join with a code/i }));
    fireEvent.submit(screen.getByRole('textbox', { name: /table code/i }).closest('form')!);
    expect(await screen.findByText('No such match')).toBeInTheDocument();
  });
  it('closes again with Escape', () => {
    render(<JoinPill />);
    fireEvent.click(screen.getByRole('button', { name: /join with a code/i }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: /table code/i }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: /join with a code/i })).toBeInTheDocument();
  });

  it('recovers if joining fails outright (e.g. the session expired)', async () => {
    joinTableAction.mockRejectedValue(new Error('unauthorized'));
    render(<JoinPill />);
    fireEvent.click(screen.getByRole('button', { name: /join with a code/i }));
    fireEvent.submit(screen.getByRole('textbox', { name: /table code/i }).closest('form')!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i);
    expect(screen.getByRole('button', { name: 'Join' })).not.toBeDisabled();
  });
});
