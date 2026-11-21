// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const joinTableAction = vi.fn();
vi.mock('../../../app/actions/lobby', () => ({ joinTableAction: (fd: FormData) => joinTableAction(fd) }));
import { JoinPill } from '../../../app/JoinPill';

beforeEach(() => { push.mockReset(); joinTableAction.mockReset(); });

describe('JoinPill', () => {
  it('opens into a code box, submits with Enter and goes to the lobby', async () => {
    joinTableAction.mockResolvedValue({ matchId: 'm1' });
    render(<JoinPill />);
    fireEvent.click(screen.getByRole('button', { name: /join with a code/i }));
    const input = screen.getByRole('textbox', { name: /table code/i });
    fireEvent.change(input, { target: { value: 'abcd' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/match/m1/lobby'));
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
});
