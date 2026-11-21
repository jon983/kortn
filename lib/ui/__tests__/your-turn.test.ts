import { describe, it, expect } from 'vitest';
import { isYourTurn } from '../deli/yourTurn';

const st = (o: Partial<{ finished: boolean; statuses: string[]; round: { finished: boolean; turn: number } }> = {}) => ({
  finished: false, statuses: ['active', 'active', 'active'], round: { finished: false, turn: 1 }, ...o,
});

describe('isYourTurn', () => {
  it('is your turn when the game and hand are live, the turn is your seat, and you are still in', () => {
    expect(isYourTurn(st(), 1)).toBe(true);
  });
  it('is not your turn otherwise', () => {
    expect(isYourTurn(st(), 0)).toBe(false);                                   // someone else's turn
    expect(isYourTurn(st({ finished: true }), 1)).toBe(false);                 // match over
    expect(isYourTurn(st({ round: { finished: true, turn: 1 } }), 1)).toBe(false); // between hands
    expect(isYourTurn(st({ statuses: ['active', 'busted', 'active'] }), 1)).toBe(false); // you're out
    expect(isYourTurn(null, 1)).toBe(false);                                   // no game state (lobby)
    expect(isYourTurn(st(), null)).toBe(false);                                // not seated
  });
});
