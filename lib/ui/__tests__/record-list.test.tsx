// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordList } from '../deli/RecordList';

const empty = { gamesPlayed: 0, gamesWon: 0, winRate: 0, roundsWon: 0, parWins: 0, vsPar: null, avgPointsPerRound: null, netBits: 0, kalookis: 0, treasures: 0, potWinnings: 0 };
const some = { ...empty, gamesPlayed: 16, gamesWon: 12, winRate: 0.75, roundsWon: 112, parWins: 82.4, vsPar: 1.36, avgPointsPerRound: 11.3, netBits: 64, kalookis: 8 };

describe('RecordList', () => {
  it('shows the empty state for a brand-new player', () => {
    render(<RecordList stats={empty} />);
    expect(screen.getByText(/No games played yet/)).toBeInTheDocument();
    expect(screen.queryByText('Win rate')).toBeNull();
  });
  it('lists the record as menu lines, with extras behind "More…"', () => {
    render(<RecordList stats={some} />);
    expect(screen.getByText('Win rate')).toBeInTheDocument();
    expect(screen.getByText('Net bits')).toBeInTheDocument();
    expect(screen.queryByText('Kalookis')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /more/i }));
    expect(screen.getByText('Kalookis')).toBeInTheDocument();
  });
  it('shows a plain dash for a stat with no data', () => {
    render(<RecordList stats={{ ...some, vsPar: null }} />);
    const line = screen.getByText('Hands vs par').closest('.deli-leader')!;
    expect(line).toHaveTextContent('—');
  });
  it('net bits: up is green, down is red', () => {
    const valueOf = () => screen.getByText('Net bits').closest('.deli-leader')!.lastElementChild!;
    const { unmount } = render(<RecordList stats={{ ...some, netBits: 150 }} />);
    expect(valueOf().className).toContain('text-deli-green');
    unmount();
    render(<RecordList stats={{ ...some, netBits: -40 }} />);
    expect(valueOf().className).toContain('text-deli-red');
  });
});
