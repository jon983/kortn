// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const sendChatAction = vi.fn(async () => ({ ok: true }));
vi.mock('../../../../app/actions/chat', () => ({ sendChatAction: (...a: unknown[]) => sendChatAction(...(a as [])) }));
import { ChatPanel } from '../ChatPanel';
import { KitchenLink } from '../../RoomBackdrop';

const chat = [{ id: '1', seat: 1, body: 'Deal faster', at: '' }, { id: '2', seat: 0, body: 'Patience', at: '' }] as any;

describe('deli chat panel', () => {
  it('is a cream order slip with a script close, and still sends', () => {
    const onClose = vi.fn();
    const { container } = render(<ChatPanel matchId="m1" chat={chat} seatNames={['Ruth', 'Sol']} mySeat={0} open onClose={onClose} />);
    expect(container.querySelector('.deli-paper')).not.toBeNull();
    expect(screen.getByText('Table talk')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Nice!' }));
    expect(sendChatAction).toHaveBeenCalledWith('m1', 'Nice!');
  });
  it('your messages sit in green bubbles, others in cream', () => {
    render(<ChatPanel matchId="m1" chat={chat} seatNames={['Ruth', 'Sol']} mySeat={0} open onClose={() => {}} />);
    expect(screen.getByText('Patience').className).toContain('bg-deli-green');
    expect(screen.getByText('Deal faster').className).not.toContain('bg-deli-green');
  });
});

describe('Kitchen link', () => {
  it('reads just "Kitchen", as a deli tag', () => {
    render(<KitchenLink />);
    const a = screen.getByRole('link');
    expect(a.textContent).toBe('Kitchen');
    expect(a.className).toContain('bg-deli-green');
  });
});
