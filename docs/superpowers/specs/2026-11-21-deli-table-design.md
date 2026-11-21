# The game table, deli style

**Date:** 2026-11-21 · **Status:** draft for approval · **Size:** project

## Intent

The kitchen now looks like a corner deli: modern technology and UX, with kitsch, old-fashioned styling (Wes Anderson, Lox in a Box). The game table still wears the old brass-and-dark look, so stepping into a game feels like a different app. This project brings the table into the same world. The aim is that playing feels a little more delightful, while staying just as quick to play.

The user picked:
- **Surface A:** keep the felt and the lace doily, and trim around them in deli style.
- **Two packs with clearly different backs.**
- **"Restyle plus the moments":** a new look, plus motion at the moments that matter, but not on every action.

## Goals

**1. Header.** The dark top bar becomes a deli-green header.
- Kitchen, refresh, video, chat, volume and Scores become printed tags or pills in the deli style: cream on green, with condensed caps.
- Hand number and pot are printed tags.
- The centre turn indicator becomes:
  - a red **"Your move"** ribbon on your turn (replacing the pulsing brass "● Your turn" pill);
  - "Ines's move", in script on green, otherwise.

**2. Opponent name plates.** Each opponent's label becomes a cream name-plate sign with:
- their name in condensed caps;
- "13 cards · 43 pts" beneath, in small sans;
- their avatar or video as now.

The plate of the seat whose turn it is wears a small red ribbon. Plates that are out or sitting out keep today's dimmed treatment.

**3. Your spot.** Still **no name** (user): just "9 cards · 21 pts" on a small cream plate, which gains the red ribbon on your turn.

**4. Buttons.** Sort, Add space, Meld, Discard and the laying-down tray buttons become deli pills:
- green for the primary action;
- outline for secondary;
- red where an action is destructive or urgent.

Enabled and disabled rules are unchanged.

**5. Card backs.** Two deli-print backs, one per pack:
- **Pack A:** deli green;
- **Pack B:** tomato red.

Each has a cream border, a fine repeating print pattern (a deli-paper style check or diamond) and a **K monogram** medallion in the centre. They must be told apart at a glance at the small size (opponent stacks, the deal) as well as at the stock size. Card **faces don't change**.

**6. Between hands.**
- **Round summary → a printed receipt.** When a hand ends, a receipt prints out line by line: paper slides down and figures tick in. It reads:

  > KORTN · The card table · Hand No. 8
  >
  > How the hand ended: "Ines went out", "Ines got Kalooki!" or "Ines got Treasure!" (as today)
  >
  > Each player and their points this hand, from the last scorepad entry ("WON" for the winner), with a small ready ✓ or · beside each name; "out" for players who are out
  >
  > Running total for each player
  >
  > Bits this hand: the winner's gain ("Bits to Ines +2"), taken from the last scorepad entry's `handBits`
>
> Pot: N bits
  >
  > "Thank you — deal again soon!"

  - **The "Next hand" pill** appears under the receipt once printing finishes, or straight away if the player taps the receipt; tapping finishes the print instantly.
  - **After pressing it:** the pill reads "Waiting… n/N", as today.
  - **Players who are out** see the same receipt with "Waiting for the next hand… n/N ready" in place of the pill.
  - **Printing:** it plays once per hand. Re-renders during the same hand show the finished receipt.
- **Scores sheet → a deli order pad.** Same data as today's `ScorePad`: per-hand points and running totals. It's styled as a lined order pad with handwritten-style (script) figures and printed column heads.
  - It opens from the header's **Scores** tag, as today, in the same overlay position.
  - Its heading becomes **"Scores"**, replacing today's "Scorecard".
- **Buy-back prompt → a ticket.** Same choices and wording as today, styled as a tear-off ticket.
  - The choices are "Buy back in" or "Decline", and the ticket keeps the "for 4 bits" price, because it's a real decision with a cost.
  - The no-buy-in-text rule was about setting up a table in the kitchen, not this prompt.
- **Match end → a hanging winner sign** that swings in, in the style of the kitchen's shop sign: "{Name} takes the pot", with the final standings beneath.

**7. Moments (motion).**
- **The deal** (it already animates from the stock to each seat): the new backs fly. The timing stays the same.
- **Turn change:** the ribbon slides onto the new seat's plate. On your turn the header's "Your move" ribbon drops in once; there's no endless pulse.
- **Meld lands:** a short settle (a small overshoot, under 300 ms) when a meld appears on the table.
- **Receipt print, sign swing:** as above.
- **Reduced motion:** every new motion has a still fallback. The receipt appears whole, the sign hangs still, and the ribbon just appears.

## Non-goals

- Card faces.
- Game rules, server, scoring, or the table's layout and seating geometry. Seats stay where they are; only how they look changes.
- Animating every draw, discard or sort beyond what exists (user picked the middle option).
- The video-call UI internals (the tiles keep working; only their frames and buttons are restyled where they sit in the header or seats).
- The kitchen (done).

## Anti-goals

- **Anything that slows a turn.** No animation may block input or delay a player's ability to act. The deal keeps today's duration.
- **Legibility loss.** Names, counts, scores and card faces must read at least as well as today on a 390 px phone, including long names.
- **Drab or framed-in-boxes styling.** The user rejected heavy frames earlier. Use the kitchen's deli language (paper, ribbons, pills, signs), not bordered panels.

## Constraints

- **Deli tokens and classes from the kitchen restyle:**
  - colours: `deli-green`, `deli-cream`, `deli-red`, `deli-gold`;
  - fonts: `font-cond`, `font-mark`, `font-script`, `font-sans-deli`;
  - classes: `deli-pill`, `deli-ribbon`, `deli-paper`, `deli-swing`, `btn-lift`.

  Reuse `lib/ui/deli/*` components (`ShopSign`, `Ribbon`) where they fit.
- **Phones:** works at 390 px without horizontal scroll. The header already wraps on phones; keep that behaviour.
- **Existing behaviour and tests keep passing:**
  - flights, deal counts, drag-to-reorder hand, joker rules;
  - the laying-down tray, chat unread badge, volume popover, call controls;
  - the reconnect indicator.

  Tests that assert on visible text ("Your turn", "Scorecard" and so on) are updated deliberately, not deleted.
- **Header size:** the header keeps today's controls, hit targets and phone wrapping, with at most today's height on a 390 px phone. Hand and Pot become small printed tags that fit where the plain text sits now.
- **Reduced motion is respected** (`prefers-reduced-motion`).

## Approaches

1. **Restyle in place (chosen).** Change the classes and markup of the existing components (`TableView`'s header and you-seat, `OpponentSeat`, `ActionBar`, `overlays.tsx`, `CardBack`) to the deli language, add a few CSS animations for the moments, and replace the two back images with an SVG component. It keeps all the behaviour and tests, and changes the fewest things at once.
2. **New table shell component.** Rebuild the table frame as new deli components and move the behaviour across. It's cleaner on paper, but `TableView` holds a lot of carefully tuned behaviour (flights, deal, drag, joker owed). Moving it risks regressions for no user-visible gain.
3. **Theme switch.** Keep both looks behind a toggle. Nobody asked for the old look, and it doubles the styling work.

## Decisions (user)

- Surface A (felt and doily, deli trimmings).
- Two packs, two distinct backs.
- Middle motion level: restyle plus the moments.
- No name on your own spot.
- No buy-in reminder when setting up a table (lobby work). The in-game buy-back ticket still states its price.

## Builder's calls (marked as mine, correctable)

- **Back colours:** green for pack A and tomato red for pack B, both with a K monogram, as proposed in conversation. They're drawn as an inline SVG/CSS component rather than images, so they're crisp at every size and need no assets.
- **Opponent's turn text:** "Ines's move" in script, so it matches the "Your move" ribbon's wording.
- **Winner sign wording:** "{Name} takes the pot".
- **The receipt:** shows the bits won this hand and the pot. It keeps the ready marks and the "how it ended" line, and tapping it finishes the print.
- **The buy-back ticket** keeps the "4 bits" price.
- **The old back images** (`card-back-blue.png`, `card-back-red.png`) are deleted. Only `CardBack` uses them.

## Left to the builder

- Exact print pattern on the backs, and the monogram's drawing.
- Exact animation curves and durations, within "under 300 ms" for in-play motion and "a second or two" for the receipt print.
- How the order pad lays out many hands on a phone (scrolling inside the pad is fine).
- Whether the receipt and sign reuse `deli-paper` and `ShopSign` or are their own components.
