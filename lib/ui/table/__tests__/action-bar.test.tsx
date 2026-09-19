// lib/ui/table/__tests__/action-bar.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBar } from '../ActionBar';
import type { Card } from '../../../kalooki';

const nat = (rank: number, suit: string): Card =>
  ({ id: `A-${suit}-${rank}`, kind: 'natural', rank: rank as any, suit: suit as any, pack: 'A' });
const view = (over: any = {}) => ({ seat: 0, currentTurn: 0, phase: 'awaitingDiscard', you: { hasOpened: false }, discard: [nat(9, 'diamonds')], ...over });

describe('ActionBar', () => {
  it('enables Meld only for a valid selection', () => {
    const onStage = vi.fn();
    render(<ActionBar view={view() as any} selectedCards={[nat(7, 'clubs'), nat(7, 'hearts'), nat(7, 'spades')]}
      stagedGroups={[]} layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={onStage} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByRole('button', { name: /^meld/i })).toBeEnabled();
  });
  it('disables Meld for an invalid selection and shows points-to-open', () => {
    render(<ActionBar view={view() as any} selectedCards={[nat(3, 'clubs'), nat(3, 'hearts')]}
      stagedGroups={[{ cards: [nat(3, 'clubs'), nat(3, 'hearts'), nat(3, 'spades')] }]} layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={() => {}} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByRole('button', { name: /^meld/i })).toBeDisabled();
    expect(screen.getByText(/to open/i)).toBeInTheDocument(); // 9 staged, 31 to open
  });
  it('draw phase shows draw buttons', () => {
    render(<ActionBar view={view({ phase: 'awaitingDraw' }) as any} selectedCards={[]} stagedGroups={[]}
      layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={() => {}} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByRole('button', { name: /draw stock/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /take discard/i })).toBeInTheDocument();
  });
  it('shows waiting message when not your turn', () => {
    render(<ActionBar view={view({ currentTurn: 1 }) as any} selectedCards={[]} stagedGroups={[]}
      layDownEnabled={false} discardEnabled={false}
      onDrawStock={() => {}} onTakeDiscard={() => {}} onStageMeld={() => {}} onLayDown={() => {}} onDiscard={() => {}} onClearTray={() => {}} />);
    expect(screen.getByText(/waiting/i)).toBeInTheDocument();
  });
});
