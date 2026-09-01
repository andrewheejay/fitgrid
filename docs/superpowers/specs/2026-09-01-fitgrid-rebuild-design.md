# Fitgrid — rebuild design spec

**Date:** 2026-09-01
**Status:** approved for planning
**Source of truth for design:** `Fitgrid.dc.html` + `README.md` in `design_handoff_fitgrid`
(the local `.dc.html` is the same file as the shared Claude Design canvas)

---

## 1. What this is

Fitgrid is a wardrobe app: a catalogue of everything you own, and one outfit a day
generated out of it. This is a ground-up rebuild. Lime (`Next.js / Supabase /
Pinecone / Gemini`) is a conceptual precursor only — none of its patterns, schema,
or infrastructure carry over.

**Purpose of this build.** A portfolio piece submitted with a coding club
application, hosted publicly and posted on X. Two consequences shape every
decision below:

- **The code is the deliverable.** Humans will read it. Architecture that
  explains itself beats architecture that impresses.
- **Every dependency must earn its place.** A framework whose features go
  unused is a question the reviewer has to ask; the code should answer it first.

**Success criteria.**

1. A stranger opens the link and understands what Fitgrid is within one screen.
2. The styling deck's keyboard model works exactly as specified and feels fast.
3. A reviewer can find the deck's entire behaviour in one file and read it in
   one sitting.
4. Visual output matches the handoff at the pixel level.

---

## 2. Scope

**In:**

- Six screens: Wardrobe, Item detail, Styling deck, Saved fits, Add item, Empty wardrobe.
- The keyboard styling deck with per-layer locking, in both Auto and Layer-by-layer modes.
- A real browser-side background-removal ingest path.
- Andrew's actual wardrobe as seed content, with real garment imagery.
- Browser-local persistence of everything the visitor adds, saves, or removes.

**Out, deliberately:**

- **Auth (handoff screen 7).** Cut entirely. See §11 D-01.
- **All server infrastructure.** No database, no API, no accounts, no RLS, no migrations.
- **Vector search, embeddings, Pinecone, Gemini, MiniLM.** See §11 D-02.
- **Camera capture.** Out of scope in the handoff, and stays out.
- **Real catalogue lookup** for the label / link / order-email paths. Simulated, marked as such. See §11 D-05.
- **Mobile layouts.** Desktop-first, ≥1280px, as designed. See §12 R-04.

---

## 3. Stack

| Layer | Choice | Why |
| :-- | :-- | :-- |
| Build | Vite 7 | No server exists, so no server framework ships. |
| UI | React 19 + TypeScript (strict) | The deck is a rich client interaction; React is the honest fit. |
| Routing | TanStack Router | Typed routes and params; no server tier implied. |
| Styling | CSS Modules over a CSS-custom-property token layer | The design is a named system, not a set of utilities. See §5. |
| State | Zustand over a repository interface | Small, explicit, and swappable for tests. |
| Persistence | `localStorage` overlay on immutable seed data | See §4.4. |
| Cut-out | BRIA RMBG via ONNX Runtime Web, in a Web Worker | Real work, no backend. See §7. |
| Unit tests | Vitest | Domain core is pure; tests are cheap and fast. |
| E2E | Playwright | jsdom's keyboard semantics can't validate the one interaction that is the product. |
| Hosting | Cloudflare Pages (static) | Unmetered bandwidth matters with a multi-megabyte model. |
| CI | GitHub Actions | Typecheck, lint, unit, E2E on every push. |
| Fonts | IBM Plex Mono self-hosted via Fontsource (400, 500) | No third-party request from a public page. |

**Rejected:** Next.js (static export disables `next/image`, and RSC plus server
actions would sit unused); Astro (added items and saved fits live in browser
state, so the wardrobe and fits grids cannot be static HTML — the islands
advantage evaporates); Tailwind (off-scale values like `12.5px` and `0.12em`
would become arbitrary-value soup that obscures the system); vanilla-extract
(strongest correctness story, but a less familiar authoring model for a codebase
whose job is to be read).

---

## 4. Architecture

### 4.1 Layout

```
src/
  domain/         pure TypeScript — no React, no DOM, no imports from outside domain/
    layers.ts     LAYERS order, display names, Layer type
    items.ts      Item, Category, ItemId
    deck.ts       DeckState, DeckEvent, DeckEffect, reduce()
    rail.ts       railWindow()
    wardrobe.ts   filtering, the three sorts, derived counts
    outfits.ts    Outfit, construction, layer iteration
    flash.ts      Flash values and their exact display strings
  data/
    seed/         committed fixture wardrobe + fits
    repository.ts       WardrobeRepository interface
    localRepository.ts  localStorage adapter
    memoryRepository.ts in-memory adapter (tests)
    overlay.ts          seed + overlay merge, tombstones
  store/
    wardrobeStore.ts
  ingest/
    pipeline.ts   the four-step run, source-agnostic
    worker/       RMBG segmentation, off the main thread
    trim.ts       alpha bounding box, centring, padding
    palette.ts    dominant-colour extraction
  screens/        one directory per screen, colocated .module.css
  components/     shared primitives (Button, Chip, GarmentImage, SpecTable, KeyCap, Header)
  styles/         tokens.css, base.css
```

The one rule that keeps this honest: **`domain/` imports nothing from anywhere
else.** If a domain module needs randomness, time, or storage, it is passed in.

### 4.2 Domain types

```ts
export const LAYERS = ['top', 'outer', 'bottom', 'shoes'] as const;
export type Layer = (typeof LAYERS)[number];
export type Category = Layer;

export interface Item {
  id: ItemId;
  category: Category;
  name: string;            // human-named → sans, sentence case
  silhouette: string;
  texture: string;
  aesthetic: Aesthetic;    // 'workwear'|'quiet'|'casual'|'utility'|'sport'
  tone: string;
  palette: [string, string, string];
  addedAt: string;         // ISO 8601; formatted for display, never stored pre-formatted
  wornCount: number;
  image: ImageRef;
  brand?: string; styleCode?: string; colourway?: string;
  composition?: string; retail?: string;
  source: 'label' | 'link' | 'receipt' | 'image';
}

export interface Outfit {
  id: OutfitId;
  name: string;
  date: string;            // ISO 8601
  top: ItemId;
  outer: ItemId | null;    // null === no outer layer
  bottom: ItemId;
  shoes: ItemId;
}
```

Two deliberate changes from the prototype's shape:

- **`addedAt` is ISO, not `"Mar 04"`.** Display formatting is a view concern.
  Storing it pre-formatted makes sorting by date a string comparison that
  silently breaks across a year boundary.
- **The outer sentinel is gone from the data model.** The prototype models "no
  outer layer" as a real item (`id: 'o0'`) and then filters it out of the grid
  and every count. Here, `outer` is `ItemId | null`, and the "No outer layer"
  option is synthesised *only* inside the deck rail, as rendering. This makes
  correct behaviour structural rather than something eight call sites must
  remember. All user-facing strings are unchanged, including **"Skipped for
  today"**.

### 4.3 The deck

The centrepiece, and the reason the domain core exists.

```ts
export interface DeckState {
  mode: 'auto' | 'manual';
  activeLayer: number;                 // index into LAYERS
  selection: Record<Layer, number>;    // pool index per layer
  locked: Record<Layer, boolean>;
  step: number;                        // manual progress, 0..3
  flash: Flash | null;
  flashId: number;                     // increments on every flash; resets the view timer
}

export type DeckEvent =
  | { type: 'cycle'; direction: -1 | 1 }
  | { type: 'moveLayer'; direction: -1 | 1 }
  | { type: 'toggleLock' }
  | { type: 'reshuffle'; random: () => number }
  | { type: 'confirm' }
  | { type: 'save' }
  | { type: 'select'; layer: Layer; index: number }
  | { type: 'setMode'; mode: DeckMode }
  | { type: 'clearFlash' };

export type DeckEffect = { type: 'saveFit'; selection: Record<Layer, number> };

export function reduce(
  state: DeckState,
  event: DeckEvent,
  pools: Record<Layer, readonly ItemId[]>,
): [DeckState, DeckEffect[]];
```

Three things this buys:

- **Randomness is injected.** `reshuffle` takes a `random` function, so every
  shuffle is deterministic under test.
- **Saving is an effect, not a side effect.** `reduce` stays pure; the hook that
  dispatches executes returned effects. Enter-saves-in-auto-mode and
  Enter-confirms-then-saves-on-the-last-layer-in-manual-mode both become
  assertions about a returned value.
- **Flash is structured, not a string.** The reducer emits `{ kind: 'lockedAlready',
  layer: 'top' }`; `flash.ts` renders the exact specified copy (`TOP is locked —
  space to unlock`). Copy lives in one file and is tested against the handoff
  verbatim.

Behaviour follows the handoff's keyboard table exactly, including: `↑`/`↓`
disabled in manual mode; cycling a locked layer changes nothing and flashes;
`R` reshuffles only unlocked layers; mode switch resets `activeLayer` and `step`
to 0 and clears all locks; the six bound keys `preventDefault()`.

The flash auto-clear (2200ms, reset by any new message) is a view effect keyed
on `flashId`.

**Rail windowing** — `railWindow(poolSize, selected): number[]`. Pool of 5 or
fewer renders whole, in fixed order, with the selected one outlined. Only a pool
larger than 5 becomes a window running from `selected - 1` to `selected + 3`.
The handoff records that getting this wrong previously showed the same jacket
twice in a four-item category; as a pure function with boundary tests at 4, 5, 6
and 18 it cannot regress.

**Outer rail composition:** the synthesized "No outer layer" option sits
**first**, matching the prototype (`o0` precedes `o1`–`o4`). With four real
outerwear pieces the rail pool is exactly 5, so it renders whole. Starting
selection is `[0, 1, 1, 2]` as in the prototype — outer on the chore jacket.

**One hook touches the keyboard.** `useDeckKeyboard` binds `window` `keydown`
while the deck is mounted, ignores events targeting `input` or `textarea`,
translates keys to `DeckEvent`s, and executes returned effects. It contains no
product logic.

### 4.4 State and persistence

Seed data is immutable and committed. The browser holds an **overlay**:

```ts
interface Overlay {
  addedItems: Item[];
  removedItemIds: ItemId[];   // tombstones — you cannot delete out of a fixture
  savedOutfits: Outfit[];
  removedOutfitIds: OutfitId[];
}
```

`overlay.ts` merges seed and overlay into the effective wardrobe. Access goes
through a `WardrobeRepository` interface with two implementations: `localStorage`
in the app, in-memory in tests, so no test touches a browser API.

Deck state is session-only — a half-built fit should not survive a refresh.
Saved fits persist.

**First load is not the empty state.** A new visitor has empty storage but a
full wardrobe, because the seed is in the bundle. The empty check runs against
the *merged* wardrobe, never against overlay presence. Screen 6 is reachable two
ways, both real: removing every item, or resetting the demo.

**Reset.** The header's account chip becomes the reset control. It keeps the
chip's exact styling (mono 10px, `1px solid #E4E4E4`, `padding: 5px 10px`,
hover border and text to `ink`) and reads **`reset@fitgrid`** — the email shape
is retained deliberately, occupying the slot the design drew for an account.
Because the visible text is not a verb, its accessible name must *contain* the
visible string (e.g. `"reset@fitgrid — reset demo"`) so speech-input users can
activate what they see. Reset clears the overlay including tombstones, and
confirms first — it is destructive, and a visitor may have spent ten minutes
building fits. The confirmation is styled on the no-match card's red hairline
treatment, giving that pattern a second use rather than inventing a new one.

---

## 5. The visual system in code

`styles/tokens.css` holds every value from the handoff's token tables as custom
properties — the colour scale, the type roles, the spacing steps. Nothing else
in the codebase contains a raw hex or a raw type size.

The handoff names roughly fifteen type roles (wordmark, page title, detail
title, metadata line, field label, lock pill, rail item name…). Each becomes a
real named class in a colocated `.module.css`, so the stylesheet reads like the
handoff document and "is this the specified value?" is a diff, not an
investigation.

**The core identity rule is preserved and enforced by naming:** anything the
system knows is mono and uppercase; anything a human named is sans and sentence
case. Component and class names reflect that split.

Two CI checks make the system's absolutes non-negotiable:

- stylelint fails on any `border-radius` or `box-shadow` — the handoff's "radius
  is 0 everywhere, no shadows" stops being a note and becomes enforced.
- a test fails on any raw hex outside `tokens.css`.

Motion: none, per the handoff. Any hover transition stays under 150ms and
applies to colour only. Focus: the prototype lacks focus rings and we add
visible `:focus-visible` treatment throughout — it is the one place we
deliberately exceed the reference.

---

## 6. Screens

All six follow the handoff's specified values exactly; only decisions that
change or resolve something are recorded here.

1. **Wardrobe** — `/wardrobe`. Grid `auto-fill minmax(196px, 1fr)`. Filter and
   sort chip counts are **derived at render time**, never stored. The flex-column
   cell with `justify-content: flex-start` is load-bearing and is called out in a
   code comment with the reason (shorter metadata lines otherwise misalign images
   by ~6px across a row). The prototype-states footer row is not built.
2. **Item detail** — `/wardrobe/$itemId`. "Lock into a fit" navigates to the deck
   with this item pre-locked into its layer; deck state accepts an initial
   selection and lock. "Remove" gets a real confirm step and writes a tombstone.
3. **Styling deck** — `/deck`. Per §4.3.
4. **Saved fits** — `/fits`. Cells open the fit by loading it back into the deck
   with all four layers locked, which is the natural meaning of "wear this again".
5. **Add item** — `/add`. Per §7. Both columns need `min-width: 0` or the source
   tabs overflow and the page scrolls sideways.
6. **Empty wardrobe** — `/wardrobe` empty state. Per §4.4, reachable but never
   the default.

Empty states the handoff explicitly leaves undesigned — zero saved fits, and a
category with too few items for the deck to build a fit — are **not invented
here**. They are flagged in §12 and get designed before they are built.

---

## 7. The ingest pipeline

Four steps, and on the image-drop path **none of them is faked**:

1. **Fetch image** — real for file drop and paste. A pasted cross-origin URL is
   best-effort: images without permissive CORS headers cannot be read back off a
   canvas, so that failure gets a real, specific error state rather than a
   generic one.
2. **Background removal** — BRIA RMBG running under ONNX Runtime Web in a Web
   Worker, lazy-loaded only when the visitor selects this tab, cached thereafter.
   Genuine load and inference progress is reported into the pipeline's mono note
   column, replacing the word `running` with a real percentage.
3. **Trim + centre** — alpha bounding box, trim, re-centre with even padding.
   The success card already claims "Centred, 12% padding"; this makes the number
   true.
4. **Palette + tagging** — dominant-colour extraction from the cut-out, feeding
   the three 22×22 swatches on item detail and the hex tags on the result card.
   Human-named fields (name, silhouette, texture, aesthetic) come from a small
   form, because a human naming things in sans is the design's own rule.

Step 4 is **renamed** from the prototype's "Vision tagging + index — Gemini →
Pinecone". There is no Gemini and no Pinecone in this build and the note column
must not claim otherwise; the handoff explicitly permits swapping the model
names while keeping the four-step shape.

The three catalogue paths (care label, product link, order email) remain
simulations against fixtures, with one quiet mono line marking them as a demo.
Their four-step pipeline copy is unchanged.

Model licensing is an open item, not an assumption — see §12 R-01.

---

## 8. Seed content and imagery

Seed data is Andrew's real wardrobe, structured as the prototype's fixtures
(18 pieces: 5 tops, 4 outerwear, 5 bottoms, 4 shoes; 4 saved fits). The
prototype's `ITEMS` and `OUTFITS` are used verbatim as the initial fixture so
the build is reviewable immediately, then replaced piece by piece with real
content.

Imagery is a mix: brand studio photographs for current retail pieces,
self-photographed cut-outs run through the app's own removal path for vintage
and thrifted ones — which is exactly the fallback the two ingest paths describe.
Images are preprocessed at build time into sized AVIF/WebP variants for the five
known display sizes (148, 420, 74, 60, 26px). The striped placeholder is kept as
the loading and missing-image state, not deleted — it is already the right
visual answer for "no image yet".

Every garment image keeps `object-fit: contain` on white inside its 1px
`#ECECEC` frame.

---

## 9. Testing

**Sequencing (user decision):** build first, run locally, then write tests. The
plan follows that order.

Recorded tradeoff: the deck reducer is the one place where the test table is
cheaper written first, because the handoff enumerates the cases already — its
keyboard table is a finished test matrix. Building it first means transcribing
that table twice. This is a deliberate, accepted cost, not an oversight.

**Coverage, once the build runs:**

- *Domain (Vitest, the bulk).* Deck reducer: one named case per cell of the
  handoff's keyboard table, in both modes, plus mode-switch reset and the
  locked-layer rejection. `railWindow` boundaries at 4, 5, 6, 18. Sorts, derived
  counts, overlay merge, tombstones, outer nullability, flash copy verbatim
  against the handoff.
- *Components (React Testing Library).* Rendering and interaction behaviour;
  chips deriving counts from data.
- *End-to-end (Playwright).* The deck driven by real key events — the one
  interaction that is the product. Plus an axe accessibility pass per screen,
  since we are adding the focus treatment the prototype lacks.

---

## 10. Delivery

Static build deployed to Cloudflare Pages. GitHub Actions runs typecheck, lint,
unit tests and Playwright on every push.

The repository README carries a decisions log — what was cut from the handoff
and why. For this audience that document is read before the code.

---

## 11. Decisions log

| # | Decision | Reasoning |
| :-- | :-- | :-- |
| D-01 | **Auth (screen 7) cut entirely.** | A live email-and-password form that authenticates nothing, on a public URL shared to X, invites strangers to type reused passwords into a fake. With no accounts in the build, the honest move is to remove it rather than mark it inert. Seven screens becomes six. |
| D-02 | **No embeddings, vector store, or LLM.** | Nothing in the six screens uses vector search: the deck reshuffles randomly and the wardrobe sorts on stored fields. "Embedding · 384-d indexed" appears once, as static text on item detail. Carrying Pinecone for a label is infrastructure without a consumer. |
| D-03 | **No server, no database, no accounts.** | A visitor gets Andrew's wardrobe and read-write persistence in their own browser. This removes auth, migrations and RLS, and redirects the effort into the deck and the visual system. |
| D-04 | **The account chip becomes `reset@fitgrid`.** | `alex@fitgrid` is a fake account on a site with no accounts. The handoff already says that chip should become a real menu; the honest occupant of the slot is the one piece of state the visitor owns. |
| D-05 | **One real ingest path, three simulated.** | Browser-side background removal is genuinely achievable and is the impressive path — a reviewer can add their own jacket from the live site. Catalogue lookup needs commercial product data or per-brand scrapers, which the handoff itself lists as unproven. |
| D-06 | **`outer` is nullable; the sentinel is a rendering concern.** | The handoff states this preference directly. It makes exclusion from grids and counts structural instead of a filter every call site must remember. |
| D-07 | **`addedAt` stored as ISO.** | The prototype's `"Mar 04"` strings sort incorrectly across a year boundary. Formatting is a view concern. |
| D-08 | **Saved fits reopen in the deck, fully locked.** | The handoff leaves this open ("reload it into the deck, or a detail view"). Reloading locked reuses the whole deck screen and matches what wearing a saved fit again means. |
| D-09 | **Build, run, then test.** | User decision. Tradeoff recorded in §9. |
| D-10 | **The weather chip shows real weather for one fixed city, fetched client-side.** | Open-Meteo needs no API key and sends permissive CORS headers, so the chip can be genuinely live with no backend. Location is a fixed city rather than the browser's geolocation: a permission prompt on first load of a portfolio link is hostile, and the design draws a specific city into the layout. Falls back to the seeded value if the request fails. |

---

## 12. Risks and open questions

| # | Item | Handling |
| :-- | :-- | :-- |
| R-01 | **RMBG licensing.** BRIA's RMBG weights ship under terms that restrict commercial use; the exact obligations must be read, not assumed. | Verify the licence text before the ingest path is built, record it in the repo, and attribute. A non-commercial portfolio site is likely within terms; if it is not, the fallback is a permissively-licensed model under the same ONNX Runtime Web architecture. Flag to Andrew either way — do not silently substitute. |
| R-02 | **Model download weight.** Segmentation weights are multiple megabytes per visitor who tries the cut-out. | Lazy-load on tab selection only, cache, and show real progress. It never touches the first paint. |
| R-03 | **Cross-origin image URLs.** Most images found on the web cannot be read back off a canvas. | File drop is the primary path; URL is best-effort with a specific error state. Set expectations in the hint copy. |
| R-04 | **No responsive design exists.** The split-screen layouts have no stacking rule below ~900px and the deck's keyboard model has no touch equivalent. | Ship desktop-first as designed. Below the breakpoint, show an honest note rather than a broken layout. Designing mobile is a separate piece of work. |
| Q-01 | **Two empty states are undesigned:** zero saved fits, and a category too sparse for the deck to build a fit. | The handoff says to ask rather than invent. Design them before building them. |
| Q-02 | **Should wearing a fit increment `wornCount`?** The handoff raises this and leaves it open. | Out of scope for v1; `wornCount` comes from seed data. Revisit after the deck ships. |

---

## 13. Build order

1. Project skeleton, token layer, shared primitives, the global header.
2. Wardrobe grid and item detail — the visual system, established once and reused.
3. The domain core and the styling deck, including the keyboard layer. The
   largest piece and the most valuable to get right.
4. Saved fits.
5. Add item: the real cut-out path first, then the three simulated catalogue paths.
6. Empty wardrobe, reset flow, error states.
7. Real imagery and seed content.
8. Test suite per §9, then CI and deploy.
