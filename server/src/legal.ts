/**
 * Privacy policy and terms, served from the API so the App Store listing
 * has stable public URLs.
 *
 * These describe what the code actually does — photos really are discarded
 * after processing, we really don't store thumbnails server-side, and the
 * scan quota really is enforced server-side. If any of that changes, this
 * file changes in the same commit. A privacy policy that drifts from the
 * implementation is worse than none, because it's a promise you're
 * quietly breaking.
 */
const UPDATED = "28 July 2026";
const CONTACT = "support@bootsalebuddy.app";

function page(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Boot Sale Buddy</title>
<style>
  :root { color-scheme: dark light; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    max-width: 44rem; margin: 0 auto; padding: 3rem 1.5rem 6rem;
    background: #121110; color: #F5F2ED; line-height: 1.65; font-size: 17px;
  }
  h1 { font-size: 1.75rem; letter-spacing: -0.02em; margin-bottom: 0.25rem; }
  h2 { font-size: 1.1rem; margin-top: 2.5rem; color: #E8B14E; }
  .updated { color: #9C968E; font-size: 0.9rem; margin-top: 0; }
  a { color: #3DDC84; }
  ul { padding-left: 1.2rem; }
  li { margin-bottom: 0.4rem; }
  strong { color: #FFFFFF; }
  .note { border-left: 3px solid #E8B14E; padding-left: 1rem; color: #CFC9C0; }
  footer { margin-top: 4rem; color: #6E675E; font-size: 0.85rem; }
</style>
</head>
<body>
<h1>${title}</h1>
<p class="updated">Boot Sale Buddy · Last updated ${UPDATED}</p>
${bodyHtml}
<footer>Questions? <a href="mailto:${CONTACT}">${CONTACT}</a></footer>
</body>
</html>`;
}

export const privacyPage = page(
  "Privacy Policy",
  `
<p class="note">The short version: we don't keep your photos, we don't sell
your data, and you can delete everything from inside the app in two taps.</p>

<h2>What we collect</h2>
<ul>
  <li><strong>An anonymous account.</strong> On first launch we create a random
      identifier for your device. No name, email or phone number is required
      to use the app.</li>
  <li><strong>Sign in with Apple (optional).</strong> If you choose to sign in,
      Apple gives us an identifier for your account. If you use Apple's
      Hide My Email, we never see your real address.</li>
  <li><strong>Your scans.</strong> We store what an item was identified as, the
      search term used, and the price range found — so your history and
      profit figures work.</li>
  <li><strong>Your finds.</strong> What you paid, what you sold for, fees,
      postage and any notes you add.</li>
  <li><strong>Usage counts.</strong> How many scans you've made, to enforce the
      free tier fairly.</li>
  <li><strong>Purchases.</strong> Handled by Apple and RevenueCat. We receive
      whether your subscription is active — never your card details.</li>
</ul>

<h2>What happens to your photos</h2>
<p>When you scan an item, the photo is resized on your phone, sent to our
server, passed to an AI model for identification, and then
<strong>discarded</strong>. We do not store it, and there is no photo
attached to anything in your history. Thumbnails you see in the app stay on
your device.</p>

<h2>Who we share it with</h2>
<ul>
  <li><strong>Google (Gemini)</strong> — receives the scan photo to identify the
      item. Note that under Google's free tier, submitted content may be used
      to improve their models.</li>
  <li><strong>eBay</strong> — receives the search term (not your photo, not your
      identity) to look up current asking prices.</li>
  <li><strong>Apple and RevenueCat</strong> — handle payments and subscription
      status.</li>
  <li><strong>Sentry</strong> — receives crash reports with personal details and
      images stripped out.</li>
</ul>
<p>We do not sell your data, and we do not use it for advertising or
tracking across other apps.</p>

<h2>How long we keep it</h2>
<p>Your scans and finds stay until you delete them or delete your account.
Delete everything at any time in <strong>Settings → Delete account &amp;
data</strong> — that removes your account and all associated records from
our servers, immediately and permanently.</p>

<h2>Children</h2>
<p>Boot Sale Buddy isn't directed at children under 13, and we don't
knowingly collect their data.</p>

<h2>Your rights</h2>
<p>Under UK GDPR you can request access to, correction of, or deletion of
your data. Deletion is built into the app; for anything else, email us at
<a href="mailto:${CONTACT}">${CONTACT}</a>.</p>

<h2>Changes</h2>
<p>If we change this policy we'll update the date above and, for anything
significant, tell you in the app.</p>
`,
);

export const termsPage = page(
  "Terms of Use",
  `
<h2>What Boot Sale Buddy does</h2>
<p>Boot Sale Buddy identifies second-hand items from a photo and shows you
what similar items are <strong>currently being asked for</strong> on eBay UK,
so you can decide whether something's worth buying.</p>

<h2 style="color:#FF5D5D">Prices are estimates, not valuations</h2>
<p class="note">The prices we show are <strong>asking prices on active eBay
listings</strong> — what sellers are hoping to get. They are <strong>not sold
prices</strong>, not an appraisal, and not a guarantee that you can sell an
item for any particular amount. Item identification is done by an AI model
and can be wrong.</p>
<p>Every buying decision is yours. Boot Sale Buddy is a research tool, not
financial advice, and we're not liable for money lost on a purchase or a
sale. Check anything valuable properly before parting with real money.</p>

<h2>Your account</h2>
<p>You're responsible for what you do with the app. Don't use it to break
the law, don't try to overwhelm or reverse-engineer the service, and don't
resell access to it.</p>

<h2>Free tier and subscriptions</h2>
<ul>
  <li>The free tier includes a limited number of scans per day, which reset at
      midnight UK time.</li>
  <li><strong>Buddy Pro</strong> is available monthly or yearly. Subscriptions
      renew automatically until cancelled, and are billed to your Apple ID.
      Cancel any time in your Apple ID settings — at least 24 hours before
      the period ends to avoid the next charge.</li>
  <li>Any free trial converts to a paid subscription unless cancelled at least
      24 hours before it ends.</li>
  <li>Pro includes a generous fair-use cap on scans to keep the service
      sustainable for everyone.</li>
  <li>Refunds are handled by Apple under their standard policy.</li>
</ul>

<h2>Availability</h2>
<p>We aim to keep the service running, but it depends on third parties
(eBay, AI providers, hosting) and may occasionally be unavailable. When
price data can't be fetched, the app will tell you rather than guess.</p>

<h2>eBay</h2>
<p>Price information is retrieved via the eBay API. eBay is a trademark of
eBay Inc. Boot Sale Buddy is not affiliated with, endorsed by, or sponsored
by eBay, Vinted or any other marketplace.</p>

<h2>Ending it</h2>
<p>You can stop using the app and delete your data at any time from
Settings. We may suspend accounts that abuse the service.</p>

<h2>Law</h2>
<p>These terms are governed by the law of Northern Ireland.</p>
`,
);
