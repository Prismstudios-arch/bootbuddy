# Boot Sale Buddy

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

**Server:**

```sh
cd server
npm install
cp .env.example .env   # fill in what you have; /healthz works with none of it
npm run dev            # http://localhost:8080/healthz
npm test
npm run typecheck
```

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
- **Vision model:** `claude-haiku-4-5` ($1/M input tokens — a compressed
  1024px scan is well under a penny), configurable via `ANTHROPIC_MODEL` and
  validated against the fixture photo set before ship.

## Build order

1. ✅ **Foundation** — repo, design tokens, themed tab shell, server skeleton, CI
2. **Backend core** — Fly deploy, Postgres migrations, anonymous auth, `/v1/scan` end-to-end (curl-tested before any UI)
3. **Scan flow** — camera → compress (≤1024px, ~70% JPEG) → upload → Result Sheet with count-up reveal + all five UI states
4. **Portfolio + Profit** — finds CRUD, sold flow, stats, charts, share card
5. **Monetization** — quotas, paywall, MockPurchases/RevenueCat behind one interface, webhook
6. **Hardening** — security checklist, Sentry, accessibility, en-GB copy pass
7. **Ship prep** — EAS build, TestFlight, screenshots, privacy labels, submit

Definition of done: a stranger can download from TestFlight, scan a real
object at arm's length in daylight, get a believable price in under 5
seconds, log a buy in 2 taps, and nothing looks like a template.
