// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook, within } from '@testing-library/react';
import { useAutoRotate } from '../useAutoRotate';
import { LeaderboardTabs } from '../../../app/LeaderboardTabs';
import type { Leaderboards } from '../../stats/hands';

function setReducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('prefers-reduced-motion'), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
}
beforeEach(() => { vi.useFakeTimers(); setReducedMotion(false); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const KEYS = ['vsPar', 'pointsPerHand', 'winsPer100'] as const;
/** Advance one interval per act(): each countdown starts after React commits the previous change. */
const tick = (n = 1, ms = 6000) => { for (let i = 0; i < n; i++) act(() => { vi.advanceTimersByTime(ms); }); };

describe('useAutoRotate', () => {
  it('moves to the next list every 6 seconds, wrapping at the end', () => {
    const { result } = renderHook(() => useAutoRotate([...KEYS], { intervalMs: 6000, initial: 'vsPar' }));
    expect(result.current.current).toBe('vsPar');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(result.current.current).toBe('pointsPerHand');
    tick(2);
    expect(result.current.current).toBe('vsPar');
  });

  it('holds while paused and restarts the countdown on resume', () => {
    const { result } = renderHook(() => useAutoRotate([...KEYS], { intervalMs: 6000, initial: 'vsPar' }));
    act(() => { vi.advanceTimersByTime(4000); result.current.pause(); });
    act(() => { vi.advanceTimersByTime(10000); });
    expect(result.current.current).toBe('vsPar');
    act(() => { result.current.resume(); });
    act(() => { vi.advanceTimersByTime(5900); });
    expect(result.current.current).toBe('vsPar');
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current.current).toBe('pointsPerHand');
  });

  it('stops for good once you pick a list yourself', () => {
    const { result } = renderHook(() => useAutoRotate([...KEYS], { intervalMs: 6000, initial: 'vsPar' }));
    act(() => { result.current.select('winsPer100'); });
    tick(10);
    expect(result.current.current).toBe('winsPer100');
    expect(result.current.stopped).toBe(true);
  });

  it('never rotates when reduced motion is requested', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useAutoRotate([...KEYS], { intervalMs: 6000, initial: 'vsPar' }));
    tick(10);
    expect(result.current.current).toBe('vsPar');
  });
});

const e = (userId: string, name: string, value: number) => ({ userId, name, value, hands: 50, count: 10 });
const boards: Leaderboards = {
  vsPar: [e('j', 'Jonathan', 1.36)],
  pointsPerHand: [e('i', 'Ines', 11.3)],
  winsPer100: [e('r', 'Rosemary', 61.9)],
  kalookisPer100: [],
  treasuresPer100: [e('j', 'Jonathan', 5)],
};
const firstRow = () => within(screen.getByRole('tabpanel')).getAllByRole('listitem')[0];

describe('LeaderboardTabs rotation', () => {
  it('skips empty lists while rotating', () => {
    render(<LeaderboardTabs boards={boards} meId="j" minHands={10} />);
    tick(3); // vsPar → pts → wins → (skip kalookis) → treasures
    expect(screen.getByRole('tab', { name: 'Treasures' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Kalookis' })).toHaveAttribute('aria-selected', 'false');
  });

  it('pauses while hovered', () => {
    const { container } = render(<LeaderboardTabs boards={boards} meId="j" minHands={10} />);
    fireEvent.mouseEnter(container.firstElementChild!);
    tick(4);
    expect(firstRow()).toHaveTextContent('Jonathan');
    fireEvent.mouseLeave(container.firstElementChild!);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(firstRow()).toHaveTextContent('Ines');
  });

  it('stays paused while focused even if the mouse passes over and leaves', () => {
    const { container } = render(<LeaderboardTabs boards={boards} meId="j" minHands={10} />);
    const wrap = container.firstElementChild as HTMLElement;
    const tabA = screen.getByRole('tab', { name: 'Pts' });
    act(() => { tabA.focus(); });
    fireEvent.mouseEnter(wrap); fireEvent.mouseLeave(wrap);
    tick(1); // one rotation would land on Pts (Ines first)
    expect(firstRow()).toHaveTextContent('Jonathan');
  });

  it('moving focus between choices inside the leaderboard does not resume it', () => {
    render(<LeaderboardTabs boards={boards} meId="j" minHands={10} />);
    act(() => { screen.getByRole('tab', { name: 'Pts' }).focus(); });
    act(() => { screen.getByRole('tab', { name: 'Wins' }).focus(); });
    tick(1);
    expect(firstRow()).toHaveTextContent('Jonathan');
  });

  it('resumes once focus leaves the leaderboard', () => {
    render(<><LeaderboardTabs boards={boards} meId="j" minHands={10} /><button>elsewhere</button></>);
    act(() => { screen.getByRole('tab', { name: 'Pts' }).focus(); });
    act(() => { screen.getByRole('button', { name: 'elsewhere' }).focus(); });
    act(() => { vi.advanceTimersByTime(6000); });
    expect(firstRow()).toHaveTextContent('Ines');
  });
});
