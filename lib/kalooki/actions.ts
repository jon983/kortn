import { MatchState, RoundState } from './state';
import type { MeldKind } from './melds';
import { shuffle } from './rng';

export type Action =
  | { type: 'draw'; source: 'stock' | 'discard' }
  | { type: 'drawJokerDecline' }
  | { type: 'meld'; groups: { kind: MeldKind; cardIds: string[] }[] }
  | { type: 'layoff'; cardId: string; meldId: string }
  | { type: 'replaceJoker'; meldId: string; jokerId: string; naturalCardId: string; newMeld: { kind: MeldKind; cardIds: string[] } }
  | { type: 'discard'; cardId: string };

export interface Ok { ok: true; match: MatchState }
export interface Err { ok: false; reason: string }
export type ActionResult = Ok | Err;

// Shallow-clone helpers keep inputs immutable.
const cloneRound = (r: RoundState): RoundState => ({
  ...r,
  players: r.players.map((p) => ({ ...p, hand: p.hand.slice() })),
  melds: r.melds.map((m) => ({ ...m, cards: m.cards.slice() })),
  stock: r.stock.slice(),
  discard: r.discard.slice(),
});
const withRound = (m: MatchState, round: RoundState): MatchState => ({ ...m, round });

function ensureStock(round: RoundState, rng: () => number): void {
  if (round.stock.length === 0 && round.discard.length > 1) {
    const top = round.discard.pop()!;
    round.stock = shuffle(round.discard, rng);
    round.discard = [top];
  }
}

export function applyAction(match: MatchState, seat: number, action: Action, rng: () => number): ActionResult {
  const round = match.round;
  if (round.finished) return { ok: false, reason: 'Round is over.' };
  if (seat !== round.turn) return { ok: false, reason: 'Not your turn.' };

  switch (action.type) {
    case 'draw': {
      if (round.phase !== 'awaitingDraw') return { ok: false, reason: 'You have already drawn.' };
      const next = cloneRound(round);
      if (action.source === 'stock') {
        ensureStock(next, rng);
        if (next.stock.length === 0) return { ok: false, reason: 'Stock is empty.' };
        next.players[seat].hand.push(next.stock.shift()!);
        next.phase = 'awaitingDiscard';
        return { ok: true, match: withRound(match, next) };
      } else {
        if (next.discard.length === 0) return { ok: false, reason: 'Discard pile is empty.' };
        const card = next.discard.pop()!;
        next.players[seat].hand.push(card);
        next.drawObligation = card;
        next.phase = 'awaitingDiscard';
        return { ok: true, match: withRound(match, next) };
      }
    }
    case 'drawJokerDecline': {
      if (round.phase !== 'awaitingDraw') return { ok: false, reason: 'You have already drawn.' };
      const top = round.discard[round.discard.length - 1];
      if (!top || top.kind !== 'joker') return { ok: false, reason: 'Top of discard is not a joker.' };
      const next = cloneRound(round);
      next.discard.pop();
      const pos = Math.floor(rng() * (next.stock.length + 1));
      next.stock.splice(pos, 0, top);
      next.players[seat].hand.push(next.stock.shift()!);
      next.phase = 'awaitingDiscard';
      return { ok: true, match: withRound(match, next) };
    }
    default:
      return { ok: false, reason: 'Action not handled yet.' };
  }
}
