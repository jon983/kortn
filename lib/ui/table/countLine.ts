/** "1 card · 43 pts", "13 cards · 1 pt": a seat's hand size and score, singular when it's one. */
export function countLine(cards: number, points: number): string {
  return `${cards} ${cards === 1 ? 'card' : 'cards'} · ${points} ${points === 1 ? 'pt' : 'pts'}`;
}
