// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const playYourTurn = vi.fn();
vi.mock('../table/sounds', () => ({ playYourTurn: () => playYourTurn(), unlockAudioOnce: vi.fn() }));
import { KitchenLive } from '../../../app/KitchenLive';

let hidden = false;
beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset(); playYourTurn.mockReset();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
afterEach(() => { vi.useRealTimers(); });

describe('KitchenLive', () => {
  it('refreshes every 4 s while a table is being set up', () => {
    render(<KitchenLive hasLobby yourTurnIds={[]} />);
    act(() => { vi.advanceTimersByTime(3999); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('otherwise every 15 s', () => {
    render(<KitchenLive hasLobby={false} yourTurnIds={[]} />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(11000); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('skips refreshes while the tab is hidden, and refreshes on coming back', () => {
    hidden = true;
    render(<KitchenLive hasLobby yourTurnIds={[]} />);
    act(() => { vi.advanceTimersByTime(8000); });
    expect(refresh).not.toHaveBeenCalled();
    hidden = false;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never chimes on first load, only when a game newly becomes your move', () => {
    const { rerender } = render(<KitchenLive hasLobby={false} yourTurnIds={['a']} />);
    expect(playYourTurn).not.toHaveBeenCalled();
    rerender(<KitchenLive hasLobby={false} yourTurnIds={['a', 'b']} />);
    expect(playYourTurn).toHaveBeenCalledTimes(1);
    rerender(<KitchenLive hasLobby={false} yourTurnIds={['a', 'b']} />);
    expect(playYourTurn).toHaveBeenCalledTimes(1);
  });
});
