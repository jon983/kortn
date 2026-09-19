import { MatchState, RoundState } from './state';
import type { GoOutType } from './state';
import type { MeldKind } from './melds';
import { validateMeld } from './melds';
import { shuffle } from './rng';
import type { Card } from './cards';

export type Action =
  | { type: 'draw'; source: 'stock' | 'discard' }
  | { type: 'returnDiscard' }
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
      next.turnStartHandSize = round.players[seat].hand.length;
      next.openedAtTurnStart = round.players[seat].hasOpened;
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
    case 'returnDiscard': {
      // A player who took the discard but can't (or won't) use it may put it
      // back and re-enter the draw phase to take from stock instead. Legal only
      // while the taken card is still uncommitted (no meld has consumed it — any
      // successful meld this turn would have cleared the obligation).
      if (round.phase !== 'awaitingDiscard' || !round.drawObligation) {
        return { ok: false, reason: 'Nothing to return.' };
      }
      const next = cloneRound(round);
      const obligationId = round.drawObligation.id;
      const hand = next.players[seat].hand;
      const idx = hand.findIndex((c) => c.id === obligationId);
      if (idx === -1) return { ok: false, reason: 'The taken card is no longer in your hand.' };
      const [card] = hand.splice(idx, 1);
      next.discard.push(card);
      next.drawObligation = null;
      next.phase = 'awaitingDraw';
      return { ok: true, match: withRound(match, next) };
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
      next.turnStartHandSize = round.players[seat].hand.length;
      next.openedAtTurnStart = round.players[seat].hasOpened;
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
    case 'layoff': {
      if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'Draw before laying off.' };
      const player = round.players[seat];
      if (!player.hasOpened) return { ok: false, reason: 'You must open before laying off.' };
      if (round.drawObligation && round.drawObligation.id === action.cardId)
        return { ok: false, reason: 'A card taken from the discard must go into a new meld.' };
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return { ok: false, reason: 'Card not in hand.' };
      const meld = round.melds.find((m) => m.id === action.meldId);
      if (!meld) return { ok: false, reason: 'Meld not found.' };
      if (meld.kind === 'set' && meld.cards.length >= 4) return { ok: false, reason: 'That set is closed.' };

      const next = cloneRound(round);
      const nMeld = next.melds.find((m) => m.id === action.meldId)!;
      const candidate = [...nMeld.cards, card];
      const v = validateMeld(candidate, nMeld.kind);
      if (!v.valid) {
        // try prepending for runs
        const v2 = validateMeld([card, ...nMeld.cards], nMeld.kind);
        if (!v2.valid) return { ok: false, reason: v.reason };
        nMeld.cards = [card, ...nMeld.cards];
      } else {
        nMeld.cards = candidate;
      }
      next.players[seat].hand = next.players[seat].hand.filter((c) => c.id !== action.cardId);
      if (nMeld.ownerSeat !== seat) next.addedToOpponentThisTurn = true;
      return { ok: true, match: withRound(match, next) };
    }
    case 'replaceJoker': {
      if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'Draw before replacing a joker.' };
      const player = round.players[seat];
      if (!player.hasOpened) return { ok: false, reason: 'You must open before replacing jokers.' };
      const meld = round.melds.find((m) => m.id === action.meldId);
      if (!meld) return { ok: false, reason: 'Meld not found.' };
      if (meld.kind === 'set' && meld.cards.length >= 4) return { ok: false, reason: 'That set is closed.' };
      const jokerCard = meld.cards.find((c) => c.id === action.jokerId && c.kind === 'joker');
      if (!jokerCard) return { ok: false, reason: 'Joker not in that meld.' };
      const natural = player.hand.find((c) => c.id === action.naturalCardId);
      if (!natural || natural.kind !== 'natural') return { ok: false, reason: 'Natural card not in hand.' };

      // Build the meld with the natural swapped for the joker; must stay valid.
      const swapped = meld.cards.map((c) => (c.id === action.jokerId ? natural : c));
      const v = validateMeld(swapped, meld.kind);
      if (!v.valid) return { ok: false, reason: 'That card cannot replace the joker here.' };

      // The freed joker must be immediately melded via newMeld (which must include it).
      if (!action.newMeld.cardIds.includes(action.jokerId))
        return { ok: false, reason: 'The freed joker must be used immediately in a new meld.' };

      const next = cloneRound(round);
      const nMeld = next.melds.find((m) => m.id === action.meldId)!;
      nMeld.cards = nMeld.cards.map((c) => (c.id === action.jokerId ? natural : c));
      // remove natural from hand, add joker to a temporary pool for the new meld
      next.players[seat].hand = next.players[seat].hand.filter((c) => c.id !== action.naturalCardId);
      const pool = new Map<string, Card>([[jokerCard.id, jokerCard], ...next.players[seat].hand.map((c) => [c.id, c] as const)]);
      const newCards: Card[] = [];
      const used = new Set<string>();
      for (const id of action.newMeld.cardIds) {
        const c = pool.get(id);
        if (!c || used.has(id)) return { ok: false, reason: 'Invalid card in new meld.' };
        used.add(id); newCards.push(c);
      }
      const nv = validateMeld(newCards, action.newMeld.kind);
      if (!nv.valid) return { ok: false, reason: nv.reason };
      next.players[seat].hand = next.players[seat].hand.filter((c) => !used.has(c.id));
      next.melds.push({ id: `m${match.roundNumber}-${next.melds.length}`, kind: action.newMeld.kind, ownerSeat: seat, cards: newCards });
      return { ok: true, match: withRound(match, next) };
    }
    case 'discard': {
      if (round.phase !== 'awaitingDiscard') return { ok: false, reason: 'You must draw first.' };
      if (round.drawObligation) return { ok: false, reason: 'The card taken from the discard must be melded this turn.' };
      const player = round.players[seat];
      const card = player.hand.find((c) => c.id === action.cardId);
      if (!card) return { ok: false, reason: 'Card not in hand.' };

      const next = cloneRound(round);
      next.players[seat].hand = next.players[seat].hand.filter((c) => c.id !== action.cardId);
      next.discard.push(card);

      if (next.players[seat].hand.length === 0) {
        next.finished = true;
        next.winnerSeat = seat;
        const kalooki = round.turnStartHandSize === 13 && round.openedAtTurnStart === false;
        let type: GoOutType = 'normal';
        let treasureUsed = match.treasureUsed;
        if (kalooki) {
          if (!match.treasureUsed && !next.addedToOpponentThisTurn) {
            type = 'treasure';
            treasureUsed = true;
          } else {
            type = 'kalooki';
          }
        }
        next.goOutType = type;
        return { ok: true, match: { ...match, treasureUsed, round: next } };
      }

      // advance to next active seat
      let t = (seat + 1) % match.seats;
      while (match.statuses[t] !== 'active') t = (t + 1) % match.seats;
      next.turn = t;
      next.phase = 'awaitingDraw';
      next.drawObligation = null;
      next.addedToOpponentThisTurn = false;
      return { ok: true, match: withRound(match, next) };
    }
  }
}
