// lib/ui/table/__tests__/overlays.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RoundSummary, RebuyPrompt, MatchSummary, ScorePad } from '../overlays';

const view: any = { roundWinnerSeat: 0, goOutType: 'kalooki', pot: 18, seat: 1, seatNames: ['Ruth', 'Sol'], roundNumber: 8,
  history: [{ roundNumber: 8, dealerSeat: 1, winnerSeat: 0, goOutType: 'kalooki', handPoints: [0, 23], scores: [40, 77], handBits: [2, -2] }],
  readyNext: [false, false],
  you: { seat: 1, score: 12, bits: -2, status: 'active' },
  opponents: [{ seat: 0, score: 0, bits: 2, status: 'active' }], matchWinnerSeat: 0 };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
const printed = () => act(() => { vi.advanceTimersByTime(2000); });

describe('overlays', () => {
  it('RoundSummary shows go-out type and a Next hand ready button', () => {
    const onReady = vi.fn();
    render(<RoundSummary view={view} onReady={onReady} />);
    expect(screen.getByText(/kalooki/i)).toBeInTheDocument();
    printed();
    fireEvent.click(screen.getByRole('button', { name: /next hand/i }));
    expect(onReady).toHaveBeenCalled();
  });
  it('receipt reads hand number, points, bits and pot', () => {
    render(<RoundSummary view={view} onReady={() => {}} />);
    printed();
    expect(screen.getByText('The card table · Hand No. 8')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('Bits to Ruth +2')).toBeInTheDocument();
    expect(screen.getByText('Pot: 18 bits')).toBeInTheDocument();
  });
  it('Next hand waits for the print, and a tap finishes it', () => {
    render(<RoundSummary view={view} onReady={() => {}} />);
    expect(screen.queryByRole('button', { name: /next hand/i })).toBeNull();
    fireEvent.click(screen.getByRole('document', { name: 'Receipt' }));
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();
  });
  it('a stream update does not restart the print', () => {
    const { rerender } = render(<RoundSummary view={view} onReady={() => {}} />);
    printed();
    rerender(<RoundSummary view={{ ...view, readyNext: [true, false] }} onReady={() => {}} />);
    expect(screen.getByRole('button', { name: /next hand/i })).toBeInTheDocument();
  });
  it('a player who is out sees the waiting line, not the pill', () => {
    render(<RoundSummary view={{ ...view, you: { ...view.you, status: 'out' } }} onReady={() => {}} />);
    printed();
    expect(screen.getByText(/Waiting for the next hand/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /next hand/i })).toBeNull();
  });
  it('RebuyPrompt fires rebuy and decline', () => {
    const onRebuy = vi.fn(); const onDecline = vi.fn();
    render(<RebuyPrompt onRebuy={onRebuy} onDecline={onDecline} />);
    fireEvent.click(screen.getByRole('button', { name: /buy back in/i })); expect(onRebuy).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /decline/i })); expect(onDecline).toHaveBeenCalled();
  });
  it('MatchSummary hangs a sign naming the winner', () => {
    const { container } = render(<MatchSummary view={{ ...view, matchFinished: true }} />);
    expect(screen.getByRole('heading', { name: 'Ruth takes the pot' })).toBeInTheDocument();
    expect(container.querySelector('.deli-swing-in')).not.toBeNull();
  });
  it('RebuyPrompt keeps its price and choices, on a ticket', () => {
    const { container } = render(<RebuyPrompt onRebuy={() => {}} onDecline={() => {}} />);
    expect(screen.getByText(/Buy back in for 4 bits/)).toBeInTheDocument();
    expect(container.querySelector('[data-ticket]')).not.toBeNull();
  });
  it('MatchSummary itemises the pot payout per seat', () => {
    render(<MatchSummary view={{ ...view, payout: [4, -4] }} />);
    const list = screen.getByRole('list', { name: /pot payout/i });
    expect(list).toHaveTextContent('Ruth: +4 bits');
    expect(list).toHaveTextContent('Sol: -4 bits');
  });
  it('MatchSummary for an abandoned game says there is no winner', () => {
    render(<MatchSummary view={{ ...view, matchAbandoned: true, matchWinnerSeat: null }} />);
    expect(screen.getByText(/game ended/i)).toBeInTheDocument();
    expect(screen.queryByText(/takes the pot/i)).toBeNull();
  });
  it('order pad keeps every hand row, on lined paper', () => {
    const { container } = render(<ScorePad view={view} />);
    expect(screen.getAllByRole('row').length).toBeGreaterThanOrEqual(3); // 2 head rows + hand 8 + Now
    expect(container.querySelector('[data-order-pad]')).not.toBeNull();
  });
  it('signed bits: gains green, losses red (order pad and payout)', () => {
    const { unmount } = render(<ScorePad view={view} />);
    expect(screen.getAllByText('+2')[0].className).toContain('text-deli-green');
    expect(screen.getAllByText('-2')[0].className).toContain('text-deli-red');
    unmount();
    render(<MatchSummary view={{ ...view, payout: [4, -4] }} />);
    expect(screen.getByText('+4').className).toContain('text-deli-green');
    expect(screen.getByText('-4').className).toContain('text-deli-red');
  });
});
