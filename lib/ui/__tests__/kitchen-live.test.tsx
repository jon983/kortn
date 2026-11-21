// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const playYourTurn = vi.fn();
const loadSavedVolume = vi.fn();
vi.mock('../table/sounds', () => ({ playYourTurn: () => playYourTurn(), unlockAudioOnce: vi.fn(), loadSavedVolume: () => loadSavedVolume() }));
import { KitchenLive } from '../../../app/KitchenLive';

type G = { id: string; status: 'lobby' | 'active'; yourTurn?: boolean };
const lobby: G[] = [{ id: 'l', status: 'lobby' }];
const active: G[] = [{ id: 'g', status: 'active' }];
const turns = (...ids: string[]): G[] => ids.map((id) => ({ id, status: 'active', yourTurn: true }));

let hidden = false;
beforeEach(() => {
  vi.useFakeTimers();
  refresh.mockReset(); playYourTurn.mockReset(); loadSavedVolume.mockReset();
  hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
});
afterEach(() => { vi.useRealTimers(); });

describe('KitchenLive', () => {
  it('refreshes every 4 s while a table is being set up', () => {
    render(<KitchenLive games={lobby} />);
    act(() => { vi.advanceTimersByTime(3999); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('otherwise every 15 s', () => {
    render(<KitchenLive games={active} />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(refresh).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(11000); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('skips refreshes while the tab is hidden, and refreshes on coming back', () => {
    hidden = true;
    render(<KitchenLive games={lobby} />);
    act(() => { vi.advanceTimersByTime(8000); });
    expect(refresh).not.toHaveBeenCalled();
    hidden = false;
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('never chimes on first load, only when a game newly becomes your move', () => {
    const { rerender } = render(<KitchenLive games={turns('a')} />);
    expect(playYourTurn).not.toHaveBeenCalled();
    rerender(<KitchenLive games={turns('a', 'b')} />);
    expect(playYourTurn).toHaveBeenCalledTimes(1);
    rerender(<KitchenLive games={turns('a', 'b')} />);
    expect(playYourTurn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet with no tables at all (nothing can change without you)', () => {
    render(<KitchenLive games={[]} />);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('chimes when a table you are waiting at gets dealt, even if it is not your move', () => {
    const { rerender } = render(<KitchenLive games={[{ id: 'x', status: 'lobby' }]} />);
    rerender(<KitchenLive games={[{ id: 'x', status: 'active' }]} />);
    expect(playYourTurn).toHaveBeenCalledTimes(1);
  });

  it('applies the volume saved at the table, so mute holds here too', () => {
    render(<KitchenLive games={[]} />);
    expect(loadSavedVolume).toHaveBeenCalled();
  });
});
