/** Is it this viewer's move? Only when the game and hand are live, the turn is their seat, and they're still in. */
export function isYourTurn(
  state: { finished: boolean; statuses: string[]; round: { finished: boolean; turn: number } } | null,
  mySeat: number | null,
): boolean {
  if (!state || mySeat === null) return false;
  return !state.finished && !state.round.finished && state.round.turn === mySeat && state.statuses[mySeat] === 'active';
}
