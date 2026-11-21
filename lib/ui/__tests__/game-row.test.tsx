// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
vi.mock('../../../app/EndGameButton', () => ({ EndGameButton: () => <button>Abandon</button> }));
vi.mock('../../../app/DeleteGameButton', () => ({ DeleteGameButton: () => <button>Delete</button> }));
import { GameRow } from '../../../app/GameRow';

describe('GameRow', () => {
  it('greys out players who are out and shows "out" instead of their points', () => {
    render(
      <GameRow id="g" status="active" number={27} seats={3} lastActiveAt={new Date()} isHost={false}
        players={[{ name: 'You', score: 91 }, { name: 'Rosemary', score: 147 }, { name: 'Ines', score: 248, out: true }]} />,
    );
    const ines = screen.getByText('Ines').closest('[data-player]')!;
    expect(ines).toHaveTextContent('out');
    expect(ines).not.toHaveTextContent('248');
    expect(ines.className).toMatch(/opacity|text-ink\/4/);
    expect(screen.getByText('Rosemary').closest('[data-player]')).toHaveTextContent('147');
  });

  it('marks a game where it is your move, quietly', () => {
    render(<GameRow id="g" status="active" number={31} seats={2} lastActiveAt={new Date()} isHost={false} yourTurn
      players={[{ name: 'You', score: 16 }, { name: 'Rosemary', score: 137 }]} />);
    expect(screen.getByRole('link', { name: 'Your move' })).toBeInTheDocument();
    expect(screen.getByText('your turn')).toBeInTheDocument();
  });

  it('otherwise offers Play with when it was last played', () => {
    render(<GameRow id="g" status="active" number={27} seats={2} lastActiveAt={new Date(Date.now() - 3 * 3600_000)} isHost={false}
      players={[{ name: 'You', score: 81 }, { name: 'Rocco', score: 21 }]} />);
    expect(screen.getByRole('link', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText(/played 3 hours ago/i)).toBeInTheDocument();
    expect(screen.queryByText('your turn')).toBeNull();
  });
});
