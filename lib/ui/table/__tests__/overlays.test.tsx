// lib/ui/table/__tests__/overlays.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RoundSummary, RebuyPrompt, MatchSummary } from '../overlays';

const view: any = { roundWinnerSeat: 0, goOutType: 'kalooki', pot: 18, seat: 1,
  you: { score: 12 }, opponents: [{ seat: 0, score: 0 }], matchWinnerSeat: 0 };

describe('overlays', () => {
  it('RoundSummary shows go-out type and Continue', () => {
    const onContinue = vi.fn();
    render(<RoundSummary view={view} onContinue={onContinue} />);
    expect(screen.getByText(/kalooki/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalled();
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
