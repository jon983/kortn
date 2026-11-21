// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { CountUp } from '../CountUp';

function setReducedMotion(on: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: on && q.includes('prefers-reduced-motion'), media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  // Drive requestAnimationFrame from fake timers (~60fps).
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16) as unknown as number);
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  setReducedMotion(false);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const text = (id: string) => screen.getByTestId(id).textContent;

describe('CountUp', () => {
  it('counts a signed value up to +64, passing through values in between', () => {
    render(<span data-testid="n"><CountUp value={64} signed /></span>);
    act(() => { vi.advanceTimersByTime(300); });
    const mid = Number(text('n')!.replace('+', ''));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(64);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(text('n')).toBe('+64');
  });

  it('keeps two decimals and the × suffix throughout', () => {
    render(<span data-testid="n"><CountUp value={1.36} decimals={2} suffix="×" /></span>);
    act(() => { vi.advanceTimersByTime(200); });
    expect(text('n')).toMatch(/^\d\.\d{2}×$/);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(text('n')).toBe('1.36×');
  });

  it('handles negatives and percent suffixes', () => {
    render(<><span data-testid="a"><CountUp value={-12} /></span><span data-testid="b"><CountUp value={75} suffix="%" /></span></>);
    act(() => { vi.advanceTimersByTime(1200); });
    expect(text('a')).toBe('-12');
    expect(text('b')).toBe('75%');
  });

  it('shows the final value immediately when reduced motion is requested', () => {
    setReducedMotion(true);
    render(<span data-testid="n"><CountUp value={64} signed /></span>);
    expect(text('n')).toBe('+64');
  });

  it('does not reset to 0 when its panel has already finished appearing (cold load / background tab)', () => {
    // A .settle panel whose entrance finished long ago (800ms in, no delay).
    const { container } = render(<div className="settle"><span data-testid="n"><CountUp value={64} signed /></span></div>);
    const panel = container.querySelector('.settle') as unknown as { getAnimations: () => unknown[] };
    panel.getAnimations = () => [{ currentTime: 800, effect: { getTiming: () => ({ delay: 0 }) } }];
    act(() => { vi.advanceTimersByTime(16); });
    expect(text('n')).toBe('+64');
    act(() => { vi.advanceTimersByTime(1000); });
    expect(text('n')).toBe('+64');
  });

  it('still counts up when its panel is just starting to appear (client navigation)', () => {
    const { container } = render(<div className="settle"><span data-testid="n"><CountUp value={64} signed /></span></div>);
    const panel = container.querySelector('.settle') as unknown as { getAnimations: () => unknown[] };
    panel.getAnimations = () => [{ currentTime: 20, effect: { getTiming: () => ({ delay: 90 }) } }];
    act(() => { vi.advanceTimersByTime(300); });
    const mid = Number(text('n')!.replace('+', ''));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(64);
  });
});
