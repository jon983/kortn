// lib/ui/table/__tests__/action-bar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBar } from '../ActionBar';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });
const view = (over: any = {}) => ({
  seat: 0, currentTurn: 0, phase: 'awaitingDiscard', seatNames: ['Ruth', 'Sol'],
  you: { hasOpened: false }, discard: [nat(9, 'diamonds')], ...over,
});

describe('ActionBar (info strip)', () => {
  it('shows the laying-down tray with points-to-open', () => {
    render(<ActionBar view={view() as any}
      stagedGroups={[{ cards: [nat(3, 'clubs'), nat(3, 'hearts'), nat(3, 'spades')] }]}
      onClearTray={() => {}} onReturnDiscard={() => {}} />);
    expect(screen.getByText(/laying down/i)).toBeInTheDocument();
    expect(screen.getByText(/to open/i)).toBeInTheDocument(); // 9 staged, 31 to open
  });
  it('offers to return the taken discard when holding an unusable draw obligation', () => {
    const onReturn = vi.fn();
    render(<ActionBar view={view({ you: { hasOpened: false, drawObligationId: 'A-diamonds-9' } }) as any}
      stagedGroups={[]} onClearTray={() => {}} onReturnDiscard={onReturn} />);
    const btn = screen.getByRole('button', { name: /put it back/i });
    btn.click();
    expect(onReturn).toHaveBeenCalled();
  });
  it('renders nothing actionable during the draw phase', () => {
    const { container } = render(<ActionBar view={view({ phase: 'awaitingDraw' }) as any}
      stagedGroups={[]} onClearTray={() => {}} onReturnDiscard={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows waiting message when not your turn', () => {
    render(<ActionBar view={view({ currentTurn: 1 }) as any}
      stagedGroups={[]} onClearTray={() => {}} onReturnDiscard={() => {}} />);
    expect(screen.getByText(/waiting for sol/i)).toBeInTheDocument();
  });
});
