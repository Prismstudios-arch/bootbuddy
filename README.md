# Boot Sale Buddy

> **Live API:** https://boot-sale-buddy-api.fly.dev — Fly.io (2× LHR) +
> Neon Postgres (London) + Gemini vision. The app points here by default,
> so scanning the Expo Go QR on a phone works with no configuration.

Point your camera at anything at a car boot sale — instantly see what it's
selling for online, whether it's worth buying, and track your real flip
profits like a trading portfolio.

**Target user:** UK resellers, car booters and charity-shop hunters. Outdoors,
in a hurry, in bright sun, one hand holding a Sony Walkman. Speed and
one-handed use are everything.

**Core loop:** Scan → See value → Decide → Log the buy → Log the sale →
Watch profit grow → Share the win.

## Repo layout

```
app/     Expo (React Native) client — runs in Expo Go day-to-day
server/  Node + Hono API on Fly.io — the ONLY place third-party keys live
```

The two packages are deliberately independent npm projects (no workspace
hoisting) so Metro stays simple and the server image stays small.

## Running it

**App** (needs the Expo Go app on your phone):

```sh
cd app
npm install
npm start          # scan the QR with Expo Go
npm run typecheck
npm run lint
```

The app talks to the deployed API by default. To develop against a local
server, override it — on a real device use your machine's LAN IP, because
`localhost` there means *the phone*:

```sh
EXPO_PUBLIC_API_URL=http://192.168.1.42:8080 npm start
```

**Server** (zero setup — no Docker, no local Postgres):

```sh
cd server
npm install
cp .env.example .env   # only JWT_SECRET is needed to try the API locally
npm run dev            # http://localhost:8080/healthz
npm test
npm run typecheck
```

With no `DATABASE_URL` the server runs on PGlite — real Postgres compiled to
WASM, persisted to `server/.data/` — with migrations applied automatically.
Set `DEV_FAKE_UPSTREAMS=1` to exercise the full scan flow with canned
Claude/eBay responses and zero API keys:

```sh
curl -s -X POST localhost:8080/v1/auth/anonymous          # → tokens
curl -s localhost:8080/v1/me -H "authorization: Bearer $TOKEN"
curl -s -X POST localhost:8080/v1/scan \
  -H "authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"imageBase64":"<base64 jpeg>"}'                     # → identification + prices + quota
```

**Deploying** — already set up (`boot-sale-buddy-api`, 2 machines in LHR,
Neon Postgres in London). Redeploy after a server change with:

```sh
cd server && fly deploy --remote-only
```

Migrations run automatically as the Fly `release_command` before new
machines take traffic. To rotate or add a secret:

```sh
fly secrets set EBAY_CLIENT_ID=... EBAY_CLIENT_SECRET=...   # triggers a redeploy
```

Continuous deploys: set repo variable `FLY_DEPLOY_ENABLED=true` and secret
`FLY_API_TOKEN` (from `fly tokens create deploy`) — see
`.github/workflows/deploy.yml`.

## Honest constraints (design around these, don't hide them)

1. **eBay sold prices are not freely available.** v1 uses the Browse API for
   *active* UK listings and the UI says "Asking prices on eBay right now" —
   never a fake "sold for". Marketplace Insights access is a post-traction
   roadmap item.
2. **Vinted has no public API.** No scraping; the result sheet deep-links a
   pre-filled Vinted search instead.
3. **Expo Go can't run RevenueCat native code.** All monetization sits behind
   a `PurchasesProvider` interface: `MockPurchases` in Expo Go,
   `RevenueCatPurchases` in EAS builds. The paywall UI is fully testable in
   Expo Go.
4. **Every scan costs real money** (one vision call + eBay lookup). Quotas are
   enforced server-side: free = 3 scans/day (resets midnight UK), pro =
   1,000/month fair use. The client's idea of its own quota is display-only.

## Turning on real purchases

The app ships with `MockPurchases` in Expo Go (Settings → tap the version 7
times for a dev menu that upgrades and downgrades you against the real
server). To go live with actual money:

1. RevenueCat dashboard: create the `pro` entitlement and the `$rc_monthly`
   / `$rc_annual` / `$rc_lifetime` packages.
2. Point its webhook at `POST https://boot-sale-buddy-api.fly.dev/v1/webhooks/revenuecat`
   with the Authorization header set to the `REVENUECAT_WEBHOOK_AUTH` secret
   (`fly secrets list` shows it's set; `fly ssh console` or re-set it to read it back).
3. `EXPO_PUBLIC_REVENUECAT_IOS_KEY=...` and build with EAS.

No app code changes — `getPurchases()` selects the real provider
automatically outside Expo Go. **Only the webhook can grant Pro**; the app
claiming an entitlement is never trusted.

## Decisions that differ from the original brief (and why)

- **Expo SDK 57, not 54.** The Expo Go app in the stores only runs the
  latest SDK; pinning 54 in mid-2026 would break the harder requirement
  ("must run in Expo Go").
- **Node 22 LTS, not 20.** Node 20 reached end-of-life April 2026; an EOL
  runtime fails the brief's own security checklist.
- **Space Grotesk, not Clash Display.** OFL licence — unambiguous for app
  embedding; Fontshare's licence is murkier.
- **`@sentry/react-native`, not `sentry-expo`** (deprecated) when crash
  reporting lands in the hardening phase.
- **Vision is provider-pluggable** via `VISION_PROVIDER`:
  - `gemini` (default) — Google AI Studio free tier, £0/scan. Note Google
    may train on free-tier inputs; fine for boot-sale photos, worth
    revisiting if scan privacy ever becomes a selling point.
  - `anthropic` — `claude-haiku-4-5`, ≈£0.002/scan, no training on API data.
  Both return the same zod-validated shape, so switching is an env change.

## Build order

1. ✅ **Foundation** — repo, design tokens, themed tab shell, server skeleton, CI
2. ✅ **Backend core** — auth (anonymous + refresh rotation + Apple), quota-gated `/v1/scan` with Claude vision + eBay Browse, migrations, deploy pipeline (curl-tested; `fly deploy` awaits real credentials)
3. ✅ **Scan flow** — camera → compress (≤1024px, ~70% JPEG) → upload → Result Sheet with count-up reveal, range bar, refine, and loading/error/empty/success states
4. ✅ **Portfolio + Profit** — finds CRUD, two-tap buy log, sold flow with fee estimation, stats aggregates, six-month chart, share card
5. ✅ **Monetization** — server-side quotas, paywall, MockPurchases/RevenueCat behind one interface, RevenueCat webhook
6. **Hardening** — security checklist, Sentry, accessibility, en-GB copy pass
7. **Ship prep** — EAS build, TestFlight, screenshots, privacy labels, submit

Definition of done: a stranger can download from TestFlight, scan a real
object at arm's length in daylight, get a believable price in under 5
seconds, log a buy in 2 taps, and nothing looks like a template.
