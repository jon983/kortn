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
});
