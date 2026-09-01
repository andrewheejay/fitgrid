# Fitgrid

A catalogue of everything you own, and one fit a day out of it.

Fitgrid is a wardrobe app. Every garment you own is filed with what the system
can work out about it — silhouette, texture, aesthetic, palette — and the
styling deck builds a fit out of that catalogue one layer at a time. The
mechanic the whole product hangs on is **locking**: you keep the one piece
you're sure about, and reroll everything around it until the rest works.

Built from a design handoff: seven specified screens, a fixed token system, and
two product changes to build rather than restyle.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in dist/
npm run typecheck
```

No environment variables, no services to provision, no database. It is a static
site.

## How it is put together

The interesting decision is that **all the product logic lives in `src/domain`
as plain TypeScript** — no React, no DOM, no imports from anywhere else in the
app. React is a thin rendering layer over it.

```
src/
  domain/      product logic, pure and framework-free
  data/        seed wardrobe, overlay merge, repositories
  store/       zustand binding over the repository
  ingest/      the background-removal pipeline
  screens/     one directory per screen
  components/  shared primitives
  styles/      the token layer
```

The styling deck is the clearest example. `domain/deck.ts` is an explicit state
machine — `reduce(state, event, pools)` returns the next state and any effects.
Randomness is passed in rather than reached for, and saving is *returned as an
effect* rather than performed, so the deck's entire behaviour is a pure function
you can assert against. `hooks/useDeckKeyboard.ts` translates key presses into
domain events and does nothing else; there is no product logic anywhere near the
DOM.

`domain/rail.ts` is small but earns its own file: the rule for which options a
rail shows is where this design has broken before (a five-wide window applied to
a four-item pool renders the same jacket twice). As a pure function it has
boundary tests instead of a bug.

## What is real and what is demonstrated

The site is honest about this distinction, and so is the UI.

**Real.** The wardrobe, the deck, saved fits, and persistence. The weather chip
pulls live conditions from Open-Meteo. And the image-drop ingest path does
genuine work in your browser: BRIA's RMBG-1.4 runs under transformers.js in a
Web Worker, the matte is trimmed and centred on canvas with even padding, and
the palette is extracted from the cut-out's own pixels. Nothing is uploaded
anywhere — the model runs on your machine.

**Demonstrated.** The three catalogue paths (care label, product link, order
email) run the real four-step pipeline shape against a fixed example, and say so
on screen. Resolving a brand and style code needs commercial product data or a
per-brand scraper set; the handoff lists that as unproven, and inventing a fake
one would have been the least interesting thing in the build.

## Decisions taken against the handoff

The handoff specified seven screens and a stack inherited from the previous app.
Both changed, deliberately.

| Decision | Reasoning |
| :-- | :-- |
| **No server, database, or accounts.** | A visitor gets the seeded wardrobe and read-write persistence in their own browser. Removing auth, migrations and row-level security put the effort into the deck and the visual system instead. |
| **The auth screen was cut entirely.** | A live email-and-password form that authenticates nothing, on a public URL, invites strangers to type reused passwords into a fake. With no accounts in the build, removing it was more honest than marking it inert. Seven screens became six. |
| **No embeddings, vector store, or LLM.** | Nothing in these screens uses vector search — the deck reshuffles, the wardrobe sorts on stored fields. "Embedding · 384-d indexed" appeared once, as static text. Carrying a vector database for a label is infrastructure without a consumer, so that row is gone from item detail too. |
| **Vite over Next.js.** | With persistence in the browser and no API, server components and server actions would sit unused and static export disables the image optimiser — the one thing Next would still have bought. Shipping a framework whose features you don't use is a question the reviewer has to ask. |
| **CSS Modules over Tailwind.** | The design names about fifteen type roles at exact sizes (12.5px, 9.5px, 0.12em tracking). As utilities those become arbitrary-value soup; as named classes the stylesheet reads like the handoff. |
| **`outer` is nullable; the "no outer layer" option is a rendering concern.** | The prototype models it as a real item and then filters it out of the grid and every count. Making it `null` makes that exclusion structural instead of something eight call sites must remember. |
| **`addedAt` is stored as ISO, not "Mar 04".** | Pre-formatted dates sort incorrectly across a year boundary. |
| **The account chip became `reset@fitgrid`.** | `alex@fitgrid` is a fake account on a site with no accounts. The honest occupant of that slot is the one piece of state the visitor actually owns — what they have changed — so it resets the demo. |
| **The fourth ingest step was renamed.** | The prototype's note column read "Gemini → Pinecone". There is no Gemini and no Pinecone here, and the status line should not claim otherwise. |

Two states the handoff explicitly left undesigned — zero saved fits, and a
category too sparse for the deck to build a fit — are implemented plainly rather
than invented, and are the first thing to design properly.

## Known limits

- **Desktop-first**, verified at 1280–1600px, as the design was drawn. The
  split-screen layouts have no stacking rule below ~900px and the deck's
  keyboard model has no touch equivalent.
- **A pasted image URL is best-effort.** An image served without permissive CORS
  headers cannot be read back off a canvas; dropping the file always works.
- **The segmentation model is several megabytes**, fetched on first use of that
  tab only. It never touches first paint.

## Credits

Background removal uses [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by
BRIA AI, running locally via [transformers.js](https://huggingface.co/docs/transformers.js).
The model is used here under its non-commercial terms. Typeface is IBM Plex
Mono, self-hosted.
