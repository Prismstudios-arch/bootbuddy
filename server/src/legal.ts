/**
 * Privacy policy and terms — the single source of truth for both surfaces.
 *
 * The content is structured data, not HTML. The web pages (required: Apple
 * needs a publicly reachable privacy policy URL for the App Store listing)
 * are rendered from it, and the app fetches the same structure from
 * GET /v1/legal and renders it natively. One edit updates both, so the
 * page a reviewer reads and the page a user reads can never drift apart.
 *
 * These describe what the code actually does — photos really are discarded
 * after processing, we really don't store thumbnails server-side, and
 * deletion really deletes. If any of that changes, this file changes in the
 * same commit. A policy that drifts from the implementation is worse than
 * none, because it's a promise you're quietly breaking.
 */
export type LegalSection = {
  heading?: string;
  /** Renders with emphasis — used for the "read this bit" callouts. */
  callout?: string;
  paragraphs?: string[];
  bullets?: { lead?: string; text: string }[];
  tone?: "warning";
};

export type LegalDoc = {
  id: "privacy" | "terms" | "support";
  title: string;
  updated: string;
  sections: LegalSection[];
};

const UPDATED = "28 July 2026";
const CONTACT = "bootsalebuddy@outlook.com";

export const privacyDoc: LegalDoc = {
  id: "privacy",
  title: "Privacy Policy",
  updated: UPDATED,
  sections: [
    {
      callout:
        "The short version: we don't keep your photos, we don't sell your data, and you can delete everything from inside the app in two taps.",
    },
    {
      heading: "What we collect",
      bullets: [
        {
          lead: "An anonymous account.",
          text: "On first launch we create a random identifier for your device. No name, email or phone number is required to use the app.",
        },
        {
          lead: "Sign in with Apple (optional).",
          text: "If you choose to sign in, Apple gives us an identifier for your account. If you use Hide My Email, we never see your real address.",
        },
        {
          lead: "Your scans.",
          text: "What an item was identified as, the search term used, and the price range found — so your history and profit figures work.",
        },
        {
          lead: "Your finds.",
          text: "What you paid, what you sold for, fees, postage and any notes you add.",
        },
        {
          lead: "Usage counts.",
          text: "How many scans you've made, to enforce the free tier fairly.",
        },
        {
          lead: "Purchases.",
          text: "Handled by Apple and RevenueCat. We receive whether your subscription is active — never your card details.",
        },
      ],
    },
    {
      heading: "What happens to your photos",
      paragraphs: [
        "When you scan an item, the photo is resized on your phone, sent to our server, passed to an AI model for identification, and then discarded. We do not store it, and no photo is attached to anything in your history. Thumbnails you see in the app stay on your device.",
      ],
    },
    {
      heading: "Who we share it with",
      bullets: [
        {
          lead: "Google (Gemini)",
          text: "receives the scan photo to identify the item. Under Google's free tier, submitted content may be used to improve their models.",
        },
        {
          lead: "Discogs",
          text: "receives the search term — not your photo, not your identity — to look up prices for records and CDs.",
        },
        { lead: "Apple and RevenueCat", text: "handle payments and subscription status." },
        {
          lead: "Sentry",
          text: "receives crash reports with personal details and images stripped out.",
        },
      ],
      paragraphs: [
        "We do not sell your data, and we do not use it for advertising or tracking across other apps.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "Your scans and finds stay until you delete them or delete your account. You can delete everything at any time in Settings → Delete account & data. That removes your account and all associated records from our servers, immediately and permanently.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        "Boot Sale Buddy isn't directed at children under 13, and we don't knowingly collect their data.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        `Under UK GDPR you can request access to, correction of, or deletion of your data. Deletion is built into the app; for anything else, email ${CONTACT}.`,
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "If we change this policy we'll update the date above and, for anything significant, tell you in the app.",
      ],
    },
  ],
};

export const termsDoc: LegalDoc = {
  id: "terms",
  title: "Terms of Use",
  updated: UPDATED,
  sections: [
    {
      heading: "What Boot Sale Buddy does",
      paragraphs: [
        "Boot Sale Buddy identifies second-hand items from a photo and helps you work out what they're worth, so you can decide whether something's worth buying. For records and CDs it shows prices from completed sales on Discogs. For everything else it takes you straight to the live sold listings on eBay, with the search already worked out.",
      ],
    },
    {
      heading: "Prices are estimates, not valuations",
      tone: "warning",
      callout:
        "Prices are a guide, not an appraisal, and never a guarantee that you can sell an item for any particular amount. The app always states which source a figure came from and whether it reflects completed sales or what sellers are currently asking. Item identification is done by an AI model and can be wrong.",
      paragraphs: [
        "Every buying decision is yours. Boot Sale Buddy is a research tool, not financial advice, and we're not liable for money lost on a purchase or a sale. Check anything valuable properly before parting with real money.",
      ],
    },
    {
      heading: "Your account",
      paragraphs: [
        "You're responsible for what you do with the app. Don't use it to break the law, don't try to overwhelm or reverse-engineer the service, and don't resell access to it.",
      ],
    },
    {
      heading: "Free tier and subscriptions",
      bullets: [
        {
          text: "The free tier includes a limited number of scans per day, which reset at midnight UK time.",
        },
        {
          lead: "Buddy Pro",
          text: "is available monthly or yearly. Subscriptions renew automatically until cancelled, and are billed to your Apple ID. Cancel any time in your Apple ID settings — at least 24 hours before the period ends to avoid the next charge.",
        },
        {
          text: "Any free trial converts to a paid subscription unless cancelled at least 24 hours before it ends.",
        },
        {
          text: "Pro includes a generous fair-use cap on scans to keep the service sustainable for everyone.",
        },
        { text: "Refunds are handled by Apple under their standard policy." },
      ],
    },
    {
      heading: "Availability",
      paragraphs: [
        "We aim to keep the service running, but it depends on third parties (AI providers, price sources, hosting) and may occasionally be unavailable. When price data can't be fetched, the app tells you and offers to search for you rather than inventing a number.",
      ],
    },
    {
      heading: "Marketplaces",
      paragraphs: [
        "Price information for records and CDs comes from the Discogs API. Links to other marketplaces open their own search pages in your browser. Discogs, eBay, Vinted and Google are trademarks of their respective owners, and Boot Sale Buddy is not affiliated with, endorsed by, or sponsored by any of them.",
      ],
    },
    {
      heading: "Ending it",
      paragraphs: [
        "You can stop using the app and delete your data at any time from Settings. We may suspend accounts that abuse the service.",
      ],
    },
    {
      heading: "Law",
      paragraphs: ["These terms are governed by the laws of the United Kingdom."],
    },
  ],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Renders a doc to a standalone page for the public URL. */
export function renderLegalHtml(doc: LegalDoc): string {
  const body = doc.sections
    .map((section) => {
      const parts: string[] = [];
      if (section.heading) {
        const colour = section.tone === "warning" ? ' style="color:#FF5D5D"' : "";
        parts.push(`<h2${colour}>${escapeHtml(section.heading)}</h2>`);
      }
      if (section.callout) {
        parts.push(`<p class="note">${escapeHtml(section.callout)}</p>`);
      }
      if (section.bullets?.length) {
        const items = section.bullets
          .map(
            (bullet) =>
              `<li>${bullet.lead ? `<strong>${escapeHtml(bullet.lead)}</strong> ` : ""}${escapeHtml(bullet.text)}</li>`,
          )
          .join("");
        parts.push(`<ul>${items}</ul>`);
      }
      for (const paragraph of section.paragraphs ?? []) {
        parts.push(`<p>${escapeHtml(paragraph)}</p>`);
      }
      return parts.join("\n");
    })
    .join("\n");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.title)} — Boot Sale Buddy</title>
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
<h1>${escapeHtml(doc.title)}</h1>
<p class="updated">Boot Sale Buddy · Last updated ${escapeHtml(doc.updated)}</p>
${body}
<footer>Questions? <a href="mailto:${CONTACT}">${CONTACT}</a></footer>
</body>
</html>`;
}

export const supportDoc: LegalDoc = {
  id: "support",
  title: "Support",
  updated: UPDATED,
  sections: [
    {
      callout: `Something not working, or an idea for the app? Email ${CONTACT} and a real person will read it — there is only one of us.`,
    },
    {
      heading: "Common questions",
      bullets: [
        {
          lead: "Why does it say 'market data unavailable'?",
          text: "We show live prices for records and CDs. For anything else, tap one of the buttons on the result to see what it's sold for on eBay — the search is already filled in for you.",
        },
        {
          lead: "Are these sold prices?",
          text: "For records and CDs on Discogs, yes — those are completed sales. Everywhere else the app says exactly what it's showing you, and never claims a valuation.",
        },
        {
          lead: "I've lost my finds.",
          text: "Your account lives on your device unless you sign in with Apple. If you've moved to a new phone without signing in, email us — if you still have the old device we may be able to help.",
        },
        {
          lead: "How do I cancel?",
          text: "Settings app → your name → Subscriptions → Boot Sale Buddy. Cancelling there stops the renewal; you keep Pro until the period ends.",
        },
        {
          lead: "How do I delete my data?",
          text: "Settings → Delete account & data, inside the app. It removes everything from our servers immediately and permanently.",
        },
      ],
    },
    {
      heading: "Still stuck?",
      paragraphs: [
        `Email ${CONTACT} with your device model and iOS version, and roughly what you were doing when it went wrong. Screenshots help enormously.`,
      ],
    },
  ],
};

export const privacyPage = renderLegalHtml(privacyDoc);
export const termsPage = renderLegalHtml(termsDoc);
export const supportPage = renderLegalHtml(supportDoc);
