# kortn — Art Brief (background plates & card art)

The app overlays live UI (table, cards, framed panels, buttons) on **photographic background plates**. These are the images we need. All must share one look so screens feel like one room.

## Shared style (applies to every background plate)

- **Setting:** a faded 1960s Eastern-European Jewish parlour / small community card room. Real, worn, dignified — not bright, not kitsch, not glossy.
- **Palette:** aged bone-white plaster above a **sage-green painted wainscot**; walnut wood; muted blue patina; tarnished brass; soft warm daylight. Gently peeling paint, damp patches, hairline cracks.
- **Light:** soft natural daylight from arched windows with **lacy floral-green curtains**. Warm, slightly melancholic, cinematic.
- **Mood:** quiet, nostalgic, inviting — "sit, we were just about to deal."
- **Finish:** shallow depth of field, subtle film grain, muted nostalgic colour grade.
- **No people. No text/lettering. No playing cards on the table** (we render those). Nothing important in the center of backgrounds — leave it calm/empty for UI overlay.
- **Recurring motifs to include where natural:** glass chandelier, brass candelabra, blue Star of David on the wall, framed memorial texts, arched curtained windows.
- **Chairs:** exactly **one chair per side of the table** (up to 4, one on each side), evenly spaced — never a crowd of chairs bunched together.

## Plates needed

### 1. Home / living room (PRIMARY) — REQUIRED
- **Use:** the home screen backdrop; the UI table + action buttons sit centered over it.
- **Composition:** wide room view, the long/round table area **empty and centered** with generous calm space around it for overlay. Chandelier above, windows to the sides.
- **Orientation/size:** landscape, **2048×1152** (16:9). Provide a **portrait/mobile crop** too if easy (1080×1920) or a version that crops safely to portrait.
- **Format:** WebP or high-quality JPG (≤~500 KB ideal), plus PNG source if available.
- Nice-to-have: 2–3 subtle variations (day vs. dusk light) for variety.

### 2. Game table surface (PRIMARY) — REQUIRED
- **Use:** the Phase-5 play surface — the felt/lace area where cards, melds, stock and discard are rendered on top.
- **Composition:** near top-down / high-angle of a table covered in a **white lace cloth over green felt**, empty, evenly lit, minimal props at the edges only. The whole center must be clear for cards.
- **Orientation/size:** landscape **2048×1152**, and ideally a squarer **1600×1600** variant for narrow screens.
- **Format:** WebP/JPG + PNG source.

### 3. Card backs ×2 (PRIMARY) — REQUIRED
- **Use:** the two physical packs in play — pack A = **blue-backed**, pack B = **red-backed**.
- **Composition:** a single vintage/ornate playing-card **back pattern**, full-bleed, centered, symmetrical — one predominantly **deep blue**, one predominantly **faded red/maroon**, both with an aged, slightly worn feel that matches the room. Ornate but not busy; must read clearly at small size.
- **Orientation/size:** portrait card ratio ~**5:7**, e.g. **500×700** each, with slightly rounded-corner-safe margins (keep the pattern inside a safe area).
- **Format:** PNG (opaque is fine).

### 4. Waiting room / lobby (SECONDARY) — nice-to-have
- Same room as (1) but reads as "getting ready" — chairs being pulled up, table not yet set. Can reuse plate (1) if separate art isn't worth it.
- Landscape 2048×1152.

### 5. Sign-in / entry (SECONDARY) — nice-to-have
- The room seen from the **doorway** (you're arriving). Warm, welcoming, empty. Used behind the Clerk sign-in.
- Landscape 2048×1152.

### 6. End-of-match / winner (OPTIONAL, later)
- A warm celebratory corner of the room (the mantel with candles lit). Used on the results screen. Landscape.

## Delivery
- Drop files into `public/art/` with clear names, e.g.:
  - `room-home.webp` (+ `room-home@portrait.webp`)
  - `table-surface.webp` (+ `table-surface@square.webp`)
  - `card-back-blue.png`, `card-back-red.png`
  - `room-waiting.webp`, `room-signin.webp` (if made)
- Keep a same-name `.png` source alongside compressed web versions if you have them.
- Consistency > quantity: it's better to have (1), (2) and the two card backs all matching than many mismatched images.

## Notes
- The **layout is backdrop-agnostic**: we build the UI overlay regardless, and swap plates in/out via these filenames. Placeholders (the CSS mockups) stand in until real plates land.
- Fallback: if you don't source some plates, we can generate them via Vercel AI Gateway free-tier image models (`bfl/flux-2-klein-4b` and `recraft/recraft-v2` both produced excellent matches in the spike) using the prompt distilled from the "Shared style" section above.
