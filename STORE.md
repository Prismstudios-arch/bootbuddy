# App Store listing — Boot Sale Buddy

Everything needed for App Store Connect, in the order the forms ask for it.
Keep this in sync with the app: if a feature or a data practice changes,
this file changes in the same commit.

## Identity

| Field | Value |
|---|---|
| App name | `Boot Sale Buddy: Flip Scanner` (30 char limit — this is 29) |
| Home screen label | `BootBuddy` (`CFBundleDisplayName`) — iOS truncates a home screen label at about 12 characters, so "BootSaleBuddy" showed as "BootSaleB…". The App Store name above is unaffected; the two are allowed to differ and usually should. |
| Subtitle | `Scan it. Price it. Flip it.` (28 chars) |
| Bundle ID | `com.bootsalebuddy.app` |
| SKU | `bootsalebuddy-ios` |
| Primary category | Shopping |
| Secondary category | Business |
| Age rating | 4+ |
| Price | Free (with in-app purchases) |

## Keywords (100 char limit)

```
reseller,flipping,carboot,charity,thrift,ebay,vinted,depop,resale,profit,vintage,secondhand,antique
```

99 characters. No spaces after commas — they count against the limit and
buy nothing.

Deliberately excludes `scanner`, `price`, `scan`, `flip` and `boot`: Apple
indexes the app name and subtitle separately, so repeating those words
wastes characters. `car boot` is one word here because "boot" already
appears in the name and Apple combines terms, while `carboot` also catches
people who type it that way. Singular forms match plurals automatically.

> **This description assumes `GEMINI_WEB_PRICES` is on.** With it off, the
> app can only price records, CDs and tapes, and the "any category" claims
> below become false — rewrite the WHAT YOU GET bullets, the HONEST ABOUT
> PRICES paragraph and the ABOUT THE PRICES review note, and put a record
> back in screenshots 02–04. A listing must never describe a screen the
> build can't render.

## Description

```
Point your camera at anything at a car boot sale and find out what it's
worth — before you hand over the 50p.

Boot Sale Buddy identifies the item from a photo, checks what ones like it
are going for right now, and tells you the most you should sensibly pay
once selling fees and postage come off. No more standing in a field
squinting at a half-rubbed-off model number.

Then it keeps score. Log what you paid, log what it sold for, and watch
your profit stack up like a trading portfolio.

WHAT YOU GET
• Instant recognition — brand and model, not just "a cassette player"
• Live prices for pretty much anything: tech, china, toys, tools, games
• Records and CDs priced from what copies actually sold for
• A suggested maximum buy price, so you know when to walk away
• Log buys in two taps — built for cold hands and bad signal
• Or add anything by hand: job lots, boxes of bits, stuff you bought years ago
• Price up a photo you already took, without being stood in front of it
• Automatic profit maths after selling fees and postage
• Your whole haul in one place: in stock, sold, and what you're up
• Search your finds, and see how long each one's been sitting
• One tap through to eBay, Vinted or Amazon to check for yourself
• Share a card of your best flips

HONEST ABOUT PRICES
Most prices are what similar items are listed at right now, not what they
finally sold for — we say which you're looking at, every time. For records
and CDs we can show real completed sales, so we do. Nothing is ever
invented: if we can't find enough genuine listings, we say so and hand you
the search instead of a made-up number. Treat it as research, not a
valuation.

BUDDY PRO
Free includes 3 scans a day, which is plenty to get a feel for it. Buddy
Pro gives you unlimited scans, CSV export for your tax return and your
whole haul backed up, from £1.99/month or £12.99/year — less than one good
flip.

Built by one person, for anyone who's ever paid 50p for something worth
£40.
```

## Promotional text (170 chars, changeable without review)

```
Now prices almost anything, not just records. Point, scan, and know what
it's worth before you hand the money over.
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

This holds whether the photo came from the camera or the photo library —
the library is read only when the user picks a specific photo, and the
picked photo goes down the identical path. `NSPhotoLibraryUsageDescription`
is declared for that; the app never enumerates the library and never asks
for write access.

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
seconds. If the simulator has no camera, tap the photo icon to the right of
the shutter and pick any photo of an object from the library instead — it
goes through exactly the same flow.

ABOUT THE PRICES: for records and CDs the app shows prices derived from
completed sales on Discogs and labels them as such. For other categories it
runs a live web search and reports what similar items are currently LISTED
at, labelled as asking prices, never as sold. Prices the search cannot back
with real sources are discarded rather than shown, and the app then says it
has no price and offers one-tap links to eBay, Vinted and Google Shopping
with the search term pre-filled. We deliberately never invent or estimate a
price.

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

### What's in the nine

| # | Screen | Caption |
|---|---|---|
| 01 | Camera, item framed | Know what it's worth |
| 02 | Result sheet with a price | A price in seconds |
| 03 | Max buy price, enlarged | Know when to walk away |
| 04 | Buy log, 50p selected | Logged in two taps |
| 05 | My Finds with haul value | Your whole haul |
| 06 | Profit breakdown, enlarged | Every penny accounted for |
| 07 | Profit dashboard | Watch it stack up |
| 08 | Share card | Share the wins |
| 09 | Paywall | Less than one good flip |

**Shots 02, 03 and 04 show a live price, a range and a max-buy figure, so
they depend on `GEMINI_WEB_PRICES` being on.** With it off the app can only
price records, CDs and tapes, and a priced-up RAM kit would be advertising a
screen the build cannot render — a 2.3.3 rejection risk and a lie to whoever
installs on the strength of it. Put a record back in these three if the flag
ever comes off.

**Every figure in the set is researched, not invented.** The Corsair kit on
02–04 is at £45 because that is what a used one sold for on eBay UK, inside
a £34–£62 spread from live listings; the max buy is 40% of the median,
which is the arithmetic in `server/src/lib/money.ts`. The portfolio rows and
the Profit tab reconcile with each other — the haul value is the two
in-stock rows added up, and "best flip ever" really is the largest. If you
re-shoot, keep them reconciling: one number that doesn't add up makes a
viewer distrust all the others.

Drop your own photo at `raw/item.jpg` (jpg, jpeg or png) and it's used for
the scanned item on 01 and its thumbnail on 05–08; without one you get a
drawn cassette player. A **phone screenshot** works — the script trims the
status bar, shutter and tab bar off anything taller than 2:1. An ordinary
photo passes through untouched.

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
