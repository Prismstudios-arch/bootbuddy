# Boot Sale Buddy — working notes for Claude

Premium iOS app for UK resellers: scan an item at a car boot sale, see live
eBay asking prices, log buys/sales, track flip profit. Two independent npm
packages: `app/` (Expo SDK 57, expo-router, TypeScript strict) and `server/`
(Node 22, Hono, Drizzle/Postgres, deployed to Fly.io).

## Hard rules

- **Money is integer pence everywhere.** Server: `Pence` branded type in
  `server/src/lib/money.ts`. Columns end `_pence`. Never floats for money.
- **Profit maths lives only in `server/src/lib/profit.ts`** and is computed
  server-side so every client agrees. Realised (sold: sale − cost − fees −
  postage) and unrealised (in stock: estimate − cost) never mix; unrealised
  is always labelled an estimate in the UI.
- **No third-party API key ever ships in the app.** Anthropic + eBay calls
  happen only on the server. App talks to our API with its own JWT.
- **Never claim "sold prices".** eBay Browse returns *active* listings; all
  UI copy says "asking prices on eBay right now".
- **Components import `useTheme()`, never the raw palette.** All text goes
  through `app/src/components/type.tsx` (`<Type>`); spacing/radius come from
  `app/src/design/tokens.ts`. Naked style numbers are a review flag.
- **Copy is en-GB, short, cheeky.** "Couldn't reach the shops. Try again?" —
  never "An error has occurred". It's "colour" and "£".
- **Every screen ships five states:** loading (skeleton shimmer, no
  spinners), empty (designed, with CTA), error (human copy + retry), offline
  (cached data + banner), success.
- **Quotas are decided server-side.** Client-side `isPro` is UX sugar only.
- **Dev-only UI is gated on `__DEV__`**, not on a comment or a promise to
  remove it later — release bundles strip it, so it cannot ship by accident.
  The `/v1/dev/*` routes are likewise never mounted when
  `NODE_ENV=production`. Test Pro against production with a promo code.
- **Sheets animate with ease-out timing, never springs.** A spring overshoots
  and reads as "bouncy", which contradicts the 200–300ms ease-out rule.
- **Never swallow an error into a silent state change.** A failed capture or
  upload must surface a message; a dead button with no explanation is
  indistinguishable from a broken app.
- **Must keep running in Expo Go.** Anything needing native modules
  (RevenueCat, Sentry native) hides behind an interface with an Expo Go mock.

## Commands

- App: `cd app && npm start | npm run typecheck | npm run lint`
- Server: `cd server && npm run dev | npm test | npm run typecheck`
- Migrations: `cd server && npm run db:generate && npm run db:migrate`

## Environment

- Server config enters only through `server/src/env.ts` (zod-validated;
  strict in production, lenient in dev). Add new vars there + `.env.example`.
- Vision is pluggable: `VISION_PROVIDER=gemini` (default, free tier) or
  `anthropic`. Providers live in `services/vision-*.ts` and must return the
  schema in `services/vision.ts` — validate with `toIdentification()`, never
  trust raw provider JSON.
- Prices come from a router (`services/pricing.ts`) in confidence order:
  Discogs completed sales, then eBay listings, then a grounded Gemini web
  search (`GEMINI_WEB_PRICES=1`). **A model-derived price is only ever kept
  when the response carries grounding citations** — no citations means it
  answered from memory, and memory invents prices. It is `basis: "asking"`
  and must never be labelled sold.
- eBay and RevenueCat keys are optional: missing eBay → `askingPrices: null`
  and the app shows "market data unavailable". Never make the server refuse
  to boot over an optional integration.
- App talks to the API through `app/src/lib/api.ts` only; hooks in
  `app/src/api/` wrap it for react-query. Auth is silent (anonymous account
  on first launch, refresh on 401) — never show a login wall.
