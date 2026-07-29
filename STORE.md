# App Store listing — Boot Sale Buddy

Everything needed for App Store Connect, in the order the forms ask for it.
Keep this in sync with the app: if a feature or a data practice changes,
this file changes in the same commit.

## Identity

| Field | Value |
|---|---|
| App name | `Boot Sale Buddy: Flip Scanner` (30 char limit — this is 29) |
| Subtitle | `Scan it. Price it. Flip it.` (28 chars) |
| Bundle ID | `com.bootsalebuddy.app` |
| SKU | `bootsalebuddy-ios` |
| Primary category | Shopping |
| Secondary category | Business |
| Age rating | 4+ |
| Price | Free (with in-app purchases) |

## Keywords (100 char limit)

```
reseller,flipping,car boot,charity shop,thrift,ebay,vinted,depop,resale,price,scanner,profit
```

That's 92 characters. Don't repeat words already in the app name or
subtitle — Apple indexes those separately, so repeating them wastes space.

## Description

```
Point your camera at anything at a car boot sale and find out what it's
worth — before you hand over the 50p.

Boot Sale Buddy identifies the item from a photo, then helps you work out
what it's actually worth and the most you should sensibly pay once selling
fees and postage are taken off. No more standing in a field squinting at a
half-rubbed-off model number.

Then it keeps score. Log what you paid, log what it sold for, and watch
your profit stack up like a trading portfolio.

WHAT YOU GET
• Instant recognition — brand and model, not just "a cassette player"
• Records and CDs priced from real completed sales on Discogs
• One tap to eBay sold prices for anything else, search already filled in
• A suggested maximum buy price, so you know when to walk away
• Log buys in two taps — built for cold hands and bad signal
• Automatic profit maths after selling fees and postage
• Your whole haul in one place: in stock, sold, and what you're up
• Share a card of your best flips

HONEST ABOUT PRICES
For records and CDs we show what copies actually sold for. For everything
else we take you straight to eBay's sold listings with the search already
worked out — because inventing a number would be worse than useless when
you're about to spend your own money. Treat it as research, not a
valuation.

BUDDY PRO
Free includes 3 scans a day, which is plenty to get a feel for it. Buddy
Pro gives you unlimited scans, CSV export for your tax return and your
whole haul backed up, from £1.99/month or £12.99/year — less than one good
flip.

Made in Northern Ireland for anyone who's ever paid 50p for something
worth £40.
```

## Promotional text (170 chars, changeable without review)

```
Records and CDs now priced from real completed sales. Point, scan, and know
what it's worth before you buy.
```

## URLs

| Field | Value |
|---|---|
| Support URL | `https://boot-sale-buddy-api.fly.dev/support` |
| Marketing URL | leave blank (optional) |
| Privacy Policy URL | `https://boot-sale-buddy-api.fly.dev/privacy` |
| Copyright | `2026 Jonathan Wilson` |

## App Privacy — "nutrition label" answers

Answer these exactly. Getting them wrong is a common rejection cause, and
over-declaring is as bad as under-declaring.

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Purchases | **Yes** | Yes | No | App Functionality |
| Identifiers (User ID) | **Yes** | Yes | No | App Functionality |
| Usage Data (product interaction) | **Yes** | Yes | No | App Functionality, Analytics |
| Diagnostics (crash data) | **Yes** | **No** | No | App Functionality |
| User Content (photos) | **No** | — | — | See note below |
| Contact Info | No | — | — | — |
| Location | No | — | — | — |
| Search History | No | — | — | — |
| Browsing History | No | — | — | — |

**Tracking: answer "No" to the tracking question.** We do not track users
across apps or websites owned by other companies, so no App Tracking
Transparency prompt is required.

**On photos:** scan photos are transmitted for processing and then
discarded — never stored, never linked to an account. Apple's guidance is
that data processed transiently and not retained does not need declaring
as collected. If a reviewer queries it, the honest answer is: "Photos are
sent to an AI vision provider for identification and immediately
discarded. No photo is stored on our servers or associated with a user."

## Review notes (paste into App Review Information)

**Uncheck "Sign-in required"** — the app needs no login at all.

```
Boot Sale Buddy identifies second-hand items from a photo and helps
resellers work out what they're worth.

NO LOGIN IS REQUIRED. The app creates an anonymous account automatically on
first launch — just open it and scan. (Sign in with Apple is offered in
Settings purely so people can back up their data to a new phone; it is
never required.)

TO TEST BUDDY PRO WITHOUT PAYING:
Settings -> Redeem a code -> enter: <PROMO CODE from the PROMO_CODES Fly
secret>
That unlocks all Pro features permanently on that install.

TESTING THE SCANNER: point the camera at any everyday object (a games
console, a kettle, a book) and press the shutter. Identification takes 2-4
seconds.

ABOUT THE PRICES: for records and CDs the app shows prices derived from
completed sales on Discogs, and labels them as such. For every other
category no live price source is available to us, so the app says so
plainly and offers one-tap links to eBay sold listings, Vinted and Google
Shopping with the search term pre-filled. We deliberately never invent or
estimate a price.

Account deletion is in Settings -> Delete account & data, and removes all
server-side data immediately.
```

## Screenshots

Generated by `npm run screenshots` into two folders, one per App Store
Connect upload slot. The slots reject anything that isn't an exact pixel
match, so upload from the matching folder:

| Slot in App Store Connect | Folder | Size |
|---|---|---|
| 6.9" / 6.7" Display | `app/assets/screenshots/iphone-6.7/` | 1290x2796 |
| 6.5" Display | `app/assets/screenshots/iphone-6.5/` | 1284x2778 |

Only the first 3 are shown on the install sheet, so keep 01, 02 and 03 in
that order — they carry the pitch on their own.

### Original shot list

Shoot on a device with a decent haul logged, in this order — the sequence
tells the story rather than just showing screens:

1. **Scan in action** — camera on a recognisable item, framing guide visible.
   Caption: *"Point it at anything"*
2. **Result sheet with a good find** — clear price range and max buy price.
   Caption: *"Know what it's worth in seconds"*
3. **Profit dashboard** — with real numbers, not zeroes.
   Caption: *"Watch the profit stack up"*
4. **My Finds** — a mix of in-stock and sold rows with green chips.
   Caption: *"Your whole haul in one place"*
5. **Share card** — the 50p → £42 card.
   Caption: *"Share the wins"*
6. **Paywall** — the value list.
   Caption: *"Less than one good flip a year"*

Do not use the empty states in screenshots. An empty app looks like a
broken app.

## Pre-submission checklist

- [ ] Privacy Policy URL: `https://boot-sale-buddy-api.fly.dev/privacy`
- [ ] Terms of Use URL: `https://boot-sale-buddy-api.fly.dev/terms`
- [ ] Support URL and contact email working
- [ ] In-app purchases created in App Store Connect and **submitted with the
      build** (a paywall referencing products that don't exist is an
      automatic rejection)
- [ ] Restore Purchases works on a fresh install — App Review always checks
- [ ] Account deletion works and actually deletes (5.1.1(v))
- [ ] Subscription terms visible beside the buy button (they are, in the
      paywall footer)
- [ ] Promo code in the review notes actually redeems
- [ ] Tested on the smallest supported device — nothing clipped
- [ ] Tested with Dynamic Type at maximum
