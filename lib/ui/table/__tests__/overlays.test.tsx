// lib/ui/table/__tests__/overlays.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoundSummary, RebuyPrompt, MatchSummary } from '../overlays';

const view: any = { roundWinnerSeat: 0, goOutType: 'kalooki', pot: 18, seat: 1, seatNames: ['Ruth', 'Sol'],
  readyNext: [false, false],
  you: { seat: 1, score: 12, bits: -2, status: 'active' },
  opponents: [{ seat: 0, score: 0, bits: 2, status: 'active' }], matchWinnerSeat: 0 };

describe('overlays', () => {
  it('RoundSummary shows go-out type and a Next hand ready button', () => {
    const onReady = vi.fn();
    render(<RoundSummary view={view} onReady={onReady} />);
    expect(screen.getByText(/kalooki/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next hand/i }));
    expect(onReady).toHaveBeenCalled();
  });
  it('RebuyPrompt fires rebuy and decline', () => {
    const onRebuy = vi.fn(); const onDecline = vi.fn();
    render(<RebuyPrompt onRebuy={onRebuy} onDecline={onDecline} />);
    fireEvent.click(screen.getByRole('button', { name: /buy back in/i })); expect(onRebuy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /decline/i })); expect(onDecline).toHaveBeenCalled();
  });
  it('MatchSummary announces the winner', () => {
    render(<MatchSummary view={view} />);
    expect(screen.getByText(/winner/i)).toBeInTheDocument();
  });
});
