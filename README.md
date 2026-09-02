# Fitgrid

A catalogue of everything you own, and one fit a day out of it.

Fitgrid is a wardrobe app. Every garment you own is filed with what the system
can work out about it — silhouette, texture, aesthetic, palette — and the
styling deck builds a fit out of that catalogue one layer at a time. The
mechanic the whole product hangs on is **locking**: you keep the one piece
you're sure about, and reroll everything around it until the rest works.

Built from a design handoff: seven specified screens, a fixed token system, and
two product changes to build rather than restyle.

**Live:** <https://fitgrid.xyz>

## What was built, against the brief

| Area | What is here |
| :-- | :-- |
| **Components** | A token layer (`src/styles/tokens.css`) and shared primitives — buttons, chips, spec tables, cards — reused across six screens. `border-radius` and raw colours outside `tokens.css` both fail `npm run lint`, because the design has no rounded corners and one hard-coded hex is how a token system starts dying. |
| **Animations** | The deck's reshuffle, the rail's selection travel, and the ingest pipeline's per-step progress, all driven from state rather than timers where the state exists. |
| **API calls** | Live weather from Open-Meteo. Live product-page reads from whichever of five readers a given shop tolerates. |
| **Database integration** | Postgres behind two serverless functions: a listing cache, a rate-limit window rolled over in SQL, and an ingest log that the daily spend cap is counted off. Schema in `db/schema.sql`, statements in `api/_lib/sql.ts`, and both are tested against a real Postgres — PGlite compiles it to WebAssembly, so `npm test` runs the actual SQL with nothing installed. |
| **Classes and objects** | The domain layer is plain TypeScript with no framework in it — `domain/deck.ts` is an explicit `reduce(state, event, pools)` state machine, `domain/rail.ts` is a pure windowing function, and both are tested directly. |
| **Full-stack** | The React app and the `api/` functions share one parser (`src/ingest/listing/parse.ts`), imported by both and tested once. |
| **Deployment** | Vercel — static bundle plus two Node functions. |

Not attempted: user registration and login. There are no accounts in this
build, deliberately, and the reasoning is in the decisions table below.

**Mobile responsiveness** is the known gap; see *Known limits*.

## Running it

```
npm install
npm run dev        # http://localhost:5173
npm run build      # static bundle in dist/
npm run typecheck
npm run lint        # stylelint: no border-radius, no raw colours outside tokens.css
npm test
npm run check       # all three, which is what CI runs
```

**No environment variables required.** The serverless functions are an
accelerator, not a dependency: without `POSTGRES_URL` they answer 503, and 503
is a status the browser's reader chain already treats as "try the next one".
`npm run dev` therefore behaves exactly as it did before there was a server.

To run the server side too, copy `.env.example`, fill it in, and apply the
schema once:

```
psql "$POSTGRES_URL" -f db/schema.sql
```

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

`domain/rail.ts` used to hold the rule for which options a rail shows — a
five-wide window that travelled with the selection, and the place this design
has broken before, since a five-wide window over a four-item pool wraps and
shows the same jacket twice. The rail now renders its pool whole and scrolls,
which deletes the rule rather than testing it: there is no window to get wrong,
and a category of eight no longer has three garments you can only cycle past
blindly. What is left in that file is the wrapping step the arrow keys use.

## What is real

Every screen does what it says. Where a limit exists it is stated on screen
rather than papered over.

**Real.** The wardrobe, the deck, saved fits, and persistence. The weather chip
pulls live conditions from Open-Meteo. And both ingest paths that take an image
do genuine work in your browser: BRIA's RMBG-1.4 runs under transformers.js in a
Web Worker, the matte is trimmed and centred on canvas with even padding, and
the palette is extracted from the cut-out's own pixels. The model runs on your
machine; no image is uploaded anywhere.

**Paste link** is real too, and reads a product page for what the page itself
publishes: schema.org `Product` data and OpenGraph tags, which between them
carry a name, brand, style code, colourway, composition, price and the studio
photograph. That photo then goes through the same cut-out pipeline as a dropped
image, and what came back fills the form — still editable, because a shop's own
copy is often not what you would file it under.

It works on the shops it works on. Most large retailers sit behind bot
protection that refuses an automated request, and which reader a given shop
tolerates is not predictable, so five are tried in order: Fitgrid's own
endpoint, then the site itself (no third party sees the URL when a shop serves
permissive CORS headers), then `r.jina.ai`, `allorigins.win` and
`microlink.io`. Measured across a handful of shops the public ones barely
overlap — one gets Uniqlo, another Pacsun, a third Nike — and plenty are
refused by all of them. A shop can also publish a readable listing and still
refuse the pixels. Either way the run ends on the no-match card, which says
what happened and routes to the image drop.

**The server** is the first reader and exists for the two things a browser tab
cannot do. It caches what it reads in Postgres, so the second person to paste a
link pays nothing for it; and it can put a request through a rented residential
proxy, which is the only thing that gets past client fingerprinting. It is also
the endpoint that hands the browser a studio photo whose CDN would not have
allowed the canvas to read it.

Fetching a URL a stranger typed is the textbook shape of an SSRF hole, so it is
guarded in two layers: `api/_lib/guard.ts` is pure and rules on scheme,
embedded credentials, port and address — loopback, link-local (which is where
cloud metadata lives), RFC1918, CGNAT, and the IPv6 spellings, including the
hex form `URL` normalises an IPv4-mapped literal to. `api/_lib/outbound.ts`
adds what needs Node: every hostname is resolved and every address it resolves
to is re-checked, and redirects are followed by hand so no hop escapes the
rules.

**Nothing here is demonstrated.** Both ways in do the work they claim. The
handoff drew four: a care-label scan and an order-email parse alongside these
two. Both of those needed commercial product data or a per-brand parser set, so
both could only ever return one fixed example — and a tab that always answers
the same thing is a screenshot with a button on it. They were built, labelled
honestly as simulations, and then removed, which is the more useful answer to
what the handoff asked for.

## Decisions taken against the handoff

The handoff specified seven screens and a stack inherited from the previous app.
Both changed, deliberately.

| Decision | Reasoning |
| :-- | :-- |
| **No accounts, and the wardrobe lives in the browser.** | A visitor gets the seeded wardrobe and read-write persistence in their own browser. Removing auth, migrations and row-level security put the effort into the deck and the visual system instead. |
| **A server, but only for link ingestion.** | The one thing the browser genuinely could not do. The obstacle is not CORS — a proxy solves that — it is bot protection that fingerprints the client and refuses a data-centre request whatever headers it carries. Two things only a server can do earn one: a cache shared by everyone who pastes the same link, and a rented residential proxy. Both endpoints degrade to a non-200 the existing reader chain already falls through, so the server accelerates the static site rather than becoming a dependency of it. |
| **The auth screen was cut entirely.** | A live email-and-password form that authenticates nothing, on a public URL, invites strangers to type reused passwords into a fake. With no accounts in the build, removing it was more honest than marking it inert. Seven screens became six. |
| **No embeddings, vector store, or LLM.** | Nothing in these screens uses vector search — the deck reshuffles, the wardrobe sorts on stored fields. "Embedding · 384-d indexed" appeared once, as static text. Carrying a vector database for a label is infrastructure without a consumer, so that row is gone from item detail too. |
| **Vite over Next.js.** | With persistence in the browser and no API, server components and server actions would sit unused and static export disables the image optimiser — the one thing Next would still have bought. Shipping a framework whose features you don't use is a question the reviewer has to ask. |
| **CSS Modules over Tailwind.** | The design names about fifteen type roles at exact sizes (12.5px, 9.5px, 0.12em tracking). As utilities those become arbitrary-value soup; as named classes the stylesheet reads like the handoff. |
| **`outer` is nullable; the "no outer layer" option is a rendering concern.** | The prototype models it as a real item and then filters it out of the grid and every count. Making it `null` makes that exclusion structural instead of something eight call sites must remember. |
| **`addedAt` is stored as ISO, not "Mar 04".** | Pre-formatted dates sort incorrectly across a year boundary. |
| **The account chip became `reset@fitgrid`.** | `alex@fitgrid` is a fake account on a site with no accounts. The honest occupant of that slot is the one piece of state the visitor actually owns — what they have changed — so it resets the demo. |
| **The fourth ingest step was renamed.** | The prototype's note column read "Gemini → Pinecone". There is no Gemini and no Pinecone here, and the status line should not claim otherwise. |
| **"Paste link" was made real rather than simulated.** | It was drawn as a catalogue lookup, which needs product data this build does not have. But a product page already publishes most of those fields about itself in schema.org and OpenGraph markup, and the cut-out pipeline was already there to take the photo. Reading the page is a different claim from resolving a SKU, so the pipeline's four rows say what it actually does. |
| **The care-label and order-email tabs were cut.** | Neither could be made real for the same reason "paste link" could: there is no catalogue behind them. Both ran the genuine four-step shape over one hard-coded garment. Four ways in, two of which always return the same hoodie, is a worse demonstration than two that work — and the same reasoning that removed the auth screen removes these. |
| **Everything on item detail is editable in place.** | A shop's own copy is often not what you would file a garment under, and the layer is a keyword guess off the item's name. Double-click any field. Corrections are stored as patches keyed by item id rather than as edited copies, because the seed wardrobe ships inside the bundle and cannot be written to — which also keeps `reset@fitgrid` a single deletion. |

Two states the handoff explicitly left undesigned — zero saved fits, and a
category too sparse for the deck to build a fit — are implemented plainly rather
than invented, and are the first thing to design properly.

## Known limits

- **Desktop-first**, verified at 1280–1600px, as the design was drawn. The
  split-screen layouts have no stacking rule below ~900px and the deck's
  keyboard model has no touch equivalent.
- **A pasted image URL is best-effort.** An image served without permissive CORS
  headers cannot be read back off a canvas; dropping the file always works.
- **Link ingest still covers only some shops.** The server closes most of the
  gap the public readers left, but a page it cannot read is a page nobody adds
  a garment from. The four public readers remain behind it because they are
  free and they cover the local case, but they are unauthenticated, rate-limited
  and occasionally down (`allorigins.win` refused every request for part of this
  build, which is why each reader has its own timeout and the chain moves on).
- **The SSRF guard resolves before it connects**, so a DNS record that changed
  between the two would still be followed. Closing that means dialling the
  resolved address with a `Host` header through a custom agent — a fair amount
  of code for an attack that needs control of a DNS zone, against an endpoint
  that returns other people's public product pages.
- **The segmentation model is several megabytes**, fetched on first use of that
  tab only. It never touches first paint.
- **A saved fit cannot be deleted individually** — resetting the demo is the
  only way to clear one. Saving is a single keystroke, so this is a real gap;
  it needs a delete affordance designed into the fits cell rather than
  improvised, since the handoff does not draw one.
- **Cut-outs are stored in `localStorage` as WebP data URLs**, capped at 640px.
  That is durable across reloads but not unbounded — a wardrobe of many
  self-added garments would eventually hit the storage quota, at which point
  IndexedDB is the right home for them.

## Credits

Background removal uses [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by
BRIA AI, running locally via [transformers.js](https://huggingface.co/docs/transformers.js).
The model is used here under its non-commercial terms. Typeface is IBM Plex
Mono, self-hosted.
