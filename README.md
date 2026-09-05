# fitgrid

a wardrobe app: every garment you own filed with what can be worked out about it — silhouette, texture, aesthetic, palette — and a styling deck that builds one fit a day out of the catalogue. the mechanic it hangs on is locking: keep the piece you're sure about, reroll everything around it until the rest works.

built from a design handoff (seven screens, a fixed token system) as a single-page app with two serverless functions behind it (vite, react, typescript, postgres, vercel).

## live

- **site** — <https://fitgrid.xyz>
- **demo** — <https://youtu.be/Sv56PIY_hIQ> (25s, no audio)

## features

- **components.** a token layer and shared primitives — buttons, chips, spec tables, cards — reused across all five screens. `border-radius` and raw hex outside `tokens.css` both fail `npm run lint`, because the design has no rounded corners and one hard-coded colour is how a token system starts dying.
- **animations.** the deck's reshuffle, the rail's selection travel, and per-step ingest progress, driven from state rather than timers.
- **api calls.** live weather from open-meteo. product pages read through a chain of four readers, first one that answers wins, each with its own timeout.
- **database.** postgres behind two functions — a listing cache, a rate-limit window rolled over in SQL, an ingest log the daily spend cap counts off. both are tested against real postgres: pglite compiles it to WASM, so `npm test` runs the actual SQL with nothing installed.
- **classes and objects.** the domain layer is plain typescript with no framework in it. `domain/deck.ts` is an explicit `reduce(state, event, pools)` machine, `domain/rail.ts` a pure windowing function, both tested directly.
- **full-stack.** the app and the api share one parser (`ingest/listing/parse.ts`), imported by both and tested once.
- **deployment.** vercel, static bundle plus two node functions.

not attempted: registration and login. no accounts in this build, deliberately — dropping auth, migrations and row-level security put the time into the deck and the visual system instead. the auth screen was cut with it rather than left as a live password form that authenticates nothing.

## real, with limits

both image paths do genuine work in the browser: RMBG-1.4 runs under transformers.js in a worker, the matte is trimmed and centred on canvas, and the palette comes off the cut-out's own pixels. nothing is uploaded anywhere.

paste link is real too, and reads what a page publishes about itself — schema.org `Product` and opengraph — which between them carry name, brand, style code, colourway, composition, price and the studio photo. that photo goes through the same cut-out pipeline.

it works on the shops it works on. most large retailers sit behind bot protection that refuses an automated request, and which reader a given shop tolerates is not predictable, so four are tried in order and plenty of pages are refused by all of them. either way the run ends on a card that says what happened and routes to the image drop.

fetching a URL a stranger typed is the textbook shape of an SSRF hole, so it is guarded in two layers: a pure check on scheme, credentials, port and address (loopback, link-local, RFC1918, CGNAT, the IPv6 spellings), then every resolved address re-checked and redirects followed by hand. a record that changes between resolve and connect would still be followed — closing that needs a custom agent, which is a lot of code for an attack that requires control of a DNS zone.

layout is drawn for desktop (verified 1280–1600px) and redrawn under one 720px breakpoint (verified 360/390/430). touch is inferred from `(pointer: coarse)`, so the tap gestures follow the input device rather than the window.

## time

18.5 hours.

## credits

background removal uses [RMBG-1.4](https://huggingface.co/briaai/RMBG-1.4) by BRIA AI under its non-commercial terms, running locally via [transformers.js](https://huggingface.co/docs/transformers.js). typeface is IBM Plex Mono, self-hosted.
