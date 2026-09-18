import { MatchState, RoundState } from './state';
import type { MeldKind } from './melds';
import { validateMeld } from './melds';
import { shuffle } from './rng';
import type { Card } from './cards';

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
      const pristine =
        round.discard.length === 1 &&
        round.melds.length === 0 &&
        round.players.every((p) => p.hand.length === 13);
      if (!pristine) return { ok: false, reason: 'You can only decline the joker on the opening flip.' };
      const next = cloneRound(round);
      next.discard.pop();
      // Draw the top of stock FIRST so the player can never immediately
      // re-draw the joker they just declined.
      if (next.stock.length === 0) return { ok: false, reason: 'Stock is empty.' };
      next.players[seat].hand.push(next.stock.shift()!);
      const pos = Math.floor(rng() * (next.stock.length + 1));
      next.stock.splice(pos, 0, top);
      next.phase = 'awaitingDiscard';
      return { ok: true, match: withRound(match, next) };
    }
    case 'meld': {
      if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'Draw before melding.' };
      const next = cloneRound(round);
      const player = next.players[seat];
      const handById = new Map(player.hand.map((c) => [c.id, c] as const));
      const usedIds = new Set<string>();
      const built: { kind: MeldKind; cards: Card[]; points: number }[] = [];
      for (const g of action.groups) {
        const cards: Card[] = [];
        for (const id of g.cardIds) {
          if (usedIds.has(id)) return { ok: false, reason: 'A card was used in two melds.' };
          const c = handById.get(id);
          if (!c) return { ok: false, reason: 'Card not in hand.' };
          usedIds.add(id);
          cards.push(c);
        }
        const v = validateMeld(cards, g.kind);
        if (!v.valid) return { ok: false, reason: v.reason };
        built.push({ kind: g.kind, cards, points: v.points });
      }
      const total = built.reduce((s, b) => s + b.points, 0);
      if (!player.hasOpened && total < 40) return { ok: false, reason: 'Opening meld must be at least 40 points.' };

      if (next.drawObligation) {
        if (!usedIds.has(next.drawObligation.id)) return { ok: false, reason: 'The card taken from the discard must be used in a new meld this turn.' };
        next.drawObligation = null;
      }

      player.hand = player.hand.filter((c) => !usedIds.has(c.id));
      let seq = next.melds.length;
      for (const b of built) {
        next.melds.push({ id: `m${match.roundNumber}-${seq++}`, kind: b.kind, ownerSeat: seat, cards: b.cards });
      }
      if (!player.hasOpened) player.hasOpened = true;
      return { ok: true, match: withRound(match, next) };
    }
    default:
      return { ok: false, reason: 'Action not handled yet.' };
  }
}
