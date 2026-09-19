import { validateMeld, type Card } from '../../kalooki';
import type { ClientView } from '../../server';

export const OPEN_THRESHOLD = 40;

export function isMyTurn(view: ClientView): boolean {
  return view.currentTurn === view.seat;
}

export function evaluateMeld(cards: Card[]): { kind: 'set' | 'run'; points: number } | null {
  if (cards.length < 3) return null;
  for (const kind of ['set', 'run'] as const) {
    const r = validateMeld(cards, kind);
    if (r.valid) return { kind, points: r.points };
  }
  return null;
}

export function stagedPoints(groups: { cards: Card[] }[]): number {
  return groups.reduce((sum, g) => {
    const e = evaluateMeld(g.cards);
    return sum + (e ? e.points : 0);
  }, 0);
}

export function canOpen(view: Pick<ClientView, 'you'>, groups: { cards: Card[] }[]): boolean {
  return view.you.hasOpened || stagedPoints(groups) >= OPEN_THRESHOLD;
}
