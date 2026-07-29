import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * App Store screenshots — 9 captioned marketing images at 1290×2796
 * (iPhone 6.7", the size Apple requires; it downscales for other sizes).
 *
 * These are RENDERED from the same design tokens as the app rather than
 * captured from a device, which is how most App Store listings are made —
 * real captures can't carry a caption or a device frame. Every screen here
 * is a faithful reconstruction of what the app actually shows, because
 * Apple requires screenshots to represent the real thing and because
 * misleading someone into a download is a rotten way to start.
 *
 * If you'd rather use genuine captures: take them on-device, drop them in
 * assets/screenshots/raw/, and the frame + caption treatment here can wrap
 * them instead.
 *
 * Run: npm run screenshots
 */
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "assets", "screenshots");
mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// Design tokens, mirrored from src/design/tokens.ts
// ---------------------------------------------------------------------------
const C = {
  bg: "#121110",
  surface: "#1C1A18",
  raised: "#26231F",
  border: "#2E2A26",
  text: "#F5F2ED",
  muted: "#9C968E",
  faint: "#6E675E",
  profit: "#3DDC84",
  profitBg: "#0E2A1B",
  loss: "#FF5D5D",
  gold: "#E8B14E",
  goldBg: "#33270F",
};

const W = 1290;
const H = 2796;
// Phone mock geometry.
const SW = 900; // screen width
const SH = 1951; // screen height
const SX = (W - SW) / 2;
const SY = 620;

const SANS = "Segoe UI, Helvetica Neue, Arial, sans-serif";

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function text(x, y, content, o = {}) {
  const {
    size = 30,
    weight = 400,
    fill = C.text,
    anchor = "start",
    family = SANS,
    opacity = 1,
    spacing = 0,
  } = o;
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}"${spacing ? ` letter-spacing="${spacing}"` : ""}>${esc(content)}</text>`;
}


// ---------------------------------------------------------------------------
// Item artwork
//
// Drawn rather than photographed, deliberately. A real photo would look
// better, but stock images of branded products are a licensing minefield
// for App Store marketing — most Wikimedia photos are CC-BY-SA, which needs
// visible attribution, and a photo of someone's Walkman isn't ours to use.
//
// To use your own photo instead: drop a square JPEG or PNG at
// assets/screenshots/raw/item.jpg and it's embedded automatically
// everywhere this illustration appears. Your own photo of your own item is
// the safest and most authentic option by a mile.
// ---------------------------------------------------------------------------
let ITEM_PHOTO = null;
try {
  const raw = join(here, "..", "assets", "screenshots", "raw");
  for (const name of ["item.jpg", "item.jpeg", "item.png"]) {
    const file = join(raw, name);
    if (existsSync(file)) {
      const mime = name.endsWith("png") ? "image/png" : "image/jpeg";
      ITEM_PHOTO = `data:${mime};base64,${readFileSync(file).toString("base64")}`;
      console.log(`using your photo: assets/screenshots/raw/${name}`);
      break;
    }
  }
} catch {
  // No photo supplied — the illustration below is used.
}

/**
 * A personal cassette player, drawn to be recognisable at thumbnail size:
 * body, window with two spools, transport buttons, headphone lead.
 */
function walkman(x, y, w, opts = {}) {
  // Portrait by default with a real photo: boxed items are taller than
  // they are wide, and slicing one to landscape crops off the label,
  // which is the part that makes it recognisable.
  const h = opts.h ?? (ITEM_PHOTO ? w * 1.24 : w * 0.72);
  const k = w / 300; // everything scales off a 300-wide reference
  if (ITEM_PHOTO) {
    return `<image href="${ITEM_PHOTO}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" clip-path="inset(0 round ${16 * k})"/>`;
  }
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    // Body with a soft top highlight, so it reads as a moulded object.
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${18 * k}" fill="#6B6259"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.42}" rx="${18 * k}" fill="#7C736A"/>` +
    // Cassette window.
    `<rect x="${x + 30 * k}" y="${y + 26 * k}" width="${w - 60 * k}" height="${h * 0.5}" rx="${10 * k}" fill="#241F1B"/>` +
    `<rect x="${x + 40 * k}" y="${y + 34 * k}" width="${w - 80 * k}" height="${h * 0.5 - 16 * k}" rx="${6 * k}" fill="#3A332C"/>` +
    // Two spools.
    `<circle cx="${cx - 44 * k}" cy="${y + h * 0.3}" r="${30 * k}" fill="#1C1815"/>` +
    `<circle cx="${cx - 44 * k}" cy="${y + h * 0.3}" r="${13 * k}" fill="#8A7F72"/>` +
    `<circle cx="${cx + 44 * k}" cy="${y + h * 0.3}" r="${30 * k}" fill="#1C1815"/>` +
    `<circle cx="${cx + 44 * k}" cy="${y + h * 0.3}" r="${13 * k}" fill="#8A7F72"/>` +
    // Transport buttons.
    `<rect x="${x + 34 * k}" y="${y + h * 0.68}" width="${w - 68 * k}" height="${h * 0.2}" rx="${8 * k}" fill="#514940"/>` +
    [0, 1, 2, 3].
      map(
        (i) =>
          `<rect x="${x + 46 * k + i * 58 * k}" y="${y + h * 0.72}" width="${40 * k}" height="${h * 0.12}" rx="${5 * k}" fill="#9A9086"/>`,
      )
      .join("") +
    // Headphone lead trailing off the corner.
    `<path d="M ${x + w - 10 * k} ${cy} q ${40 * k} ${30 * k} ${16 * k} ${70 * k}" stroke="#2A2521" stroke-width="${7 * k}" fill="none" stroke-linecap="round"/>`
  );
}

/** Thumbnail-sized item artwork with a soft backing. */
const photo = (x, y, size, r = 18) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="#2A2520"/>` +
  walkman(x + size * 0.08, y + size * 0.22, size * 0.84, { h: size * 0.6 });

const rect = (x, y, w, h, o = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 0}" fill="${o.fill ?? C.surface}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 2}"` : ""}${o.opacity ? ` opacity="${o.opacity}"` : ""}/>`;

/** Uppercase micro-label, as used above every number in the app. */
const label = (x, y, s, fill = C.muted) =>
  text(x, y, s.toUpperCase(), { size: 22, weight: 600, fill, spacing: 2.4 });

function pill(x, y, s, o = {}) {
  const padX = 26;
  const w = o.w ?? s.length * 15 + padX * 2;
  const h = 54;
  return (
    rect(x, y, w, h, { r: 27, fill: o.bg ?? C.raised }) +
    text(x + w / 2, y + 36, s, { size: 24, weight: 600, fill: o.fg ?? C.muted, anchor: "middle" })
  );
}

function button(x, y, w, s, o = {}) {
  const h = o.h ?? 96;
  return (
    rect(x, y, w, h, { r: h / 2, fill: o.fill ?? C.text, ...(o.stroke ? { stroke: o.stroke } : {}) }) +
    text(x + w / 2, y + h / 2 + 12, s, {
      size: 32,
      weight: 700,
      fill: o.fg ?? C.bg,
      anchor: "middle",
    })
  );
}

/** The four-tab bar every screen sits above. */
function tabBar(active) {
  const tabs = ["Scan", "My Finds", "Profit", "Settings"];
  const y = SH - 130;
  let out = rect(0, y, SW, 130, { fill: C.bg }) + rect(0, y, SW, 2, { fill: C.border });
  tabs.forEach((t, i) => {
    const cx = (SW / 4) * i + SW / 8;
    const on = t === active;
    out +=
      rect(cx - 21, y + 32, 42, 38, { r: 11, fill: "none", stroke: on ? C.text : C.faint, sw: 4 }) +
      text(cx, y + 104, t, {
        size: 22,
        weight: 600,
        fill: on ? C.text : C.faint,
        anchor: "middle",
      });
  });
  return out;
}

const statusBar = () =>
  text(56, 74, "9:41", { size: 28, weight: 700 }) +
  rect(SW - 150, 52, 84, 34, { r: 10, fill: C.text, opacity: 0.9 });

// ---------------------------------------------------------------------------
// Screen mocks — each returns SVG in a 900×1951 coordinate space
// ---------------------------------------------------------------------------

/** 1. Camera with framing guide. */
function screenScan() {
  const g = 400;
  const gx = (SW - g) / 2;
  const gy = 570;
  const corner = 86;
  const bracket = (px, py, sx, sy) =>
    `<path d="M ${px + sx * corner} ${py} L ${px} ${py} L ${px} ${py + sy * corner}" stroke="${C.text}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.9"/>`;
  return (
    rect(0, 0, SW, SH, { fill: "#0B0A09" }) +
    // A trestle table with a cassette player framed on it — vague blobs
    // read as a rendering artefact, a recognisable object reads as a scan.
    walkman(SW / 2 - 170, 600, 340) +
    statusBar() +
    bracket(gx, gy, 1, 1) +
    bracket(gx + g, gy, -1, 1) +
    bracket(gx, gy + g * 1.22, 1, -1) +
    bracket(gx + g, gy + g * 1.22, -1, -1) +
    rect(gx - 40, gy + g * 1.22 + 60, g + 80, 64, { r: 32, fill: "rgba(18,17,16,0.75)" }) +
    text(SW / 2, gy + g * 1.22 + 102, "One item, fill the frame — labels help", {
      size: 24,
      fill: C.text,
      anchor: "middle",
    }) +
    // Recent scans strip.
    pill(56, SH - 400, "Corsair RGB Pro · £38", { bg: "rgba(18,17,16,0.72)", fg: C.text }) +
    pill(430, SH - 400, "Pyrex bowl · £14", { bg: "rgba(18,17,16,0.72)", fg: C.text }) +
    // Torch + shutter.
    `<circle cx="150" cy="${SH - 250}" r="52" fill="rgba(18,17,16,0.55)"/>` +
    text(150, SH - 236, "☀", { size: 40, fill: C.text, anchor: "middle" }) +
    `<circle cx="${SW / 2}" cy="${SH - 250}" r="86" fill="none" stroke="${C.text}" stroke-width="10"/>` +
    `<circle cx="${SW / 2}" cy="${SH - 250}" r="66" fill="${C.text}"/>` +
    tabBar("Scan")
  );
}

/** Shared: result sheet over a dimmed frozen frame. */
function resultSheet({ highlightMaxBuy = false } = {}) {
  const top = highlightMaxBuy ? 700 : 820;
  let s =
    rect(0, 0, SW, SH, { fill: "#0B0A09" }) +
    walkman(SW / 2 - 175, 170, 350) +
    // Lighter than the app's scrim so the frozen frame still reads at
    // thumbnail size; the sheet is still clearly the focus.
    rect(0, 0, SW, SH, { fill: "rgba(18,17,16,0.55)" }) +
    statusBar() +
    rect(0, top, SW, SH - top, { r: 48, fill: C.bg }) +
    rect(SW / 2 - 36, top + 26, 72, 8, { r: 4, fill: C.border });

  let y = top + 110;
  s += text(56, y, "Corsair Vengeance RGB Pro", { size: 42, weight: 700 });
  y += 44;
  s += text(56, y, "Certain", { size: 26, fill: C.muted });
  y += 120;
  s += text(56, y, "£38.50", { size: 118, weight: 700, fill: C.text });
  y += 48;
  s += text(56, y, "Asking prices on eBay UK right now · 23 listings", {
    size: 24,
    fill: C.muted,
  });

  // Low–high range bar with the median marker.
  y += 60;
  s +=
    rect(56, y, SW - 112, 14, { r: 7, fill: C.raised }) +
    rect(56 + (SW - 112) * 0.46, y - 8, 8, 30, { r: 4, fill: C.profit }) +
    text(56, y + 60, "£24.99", { size: 24, fill: C.faint }) +
    text(SW - 56, y + 60, "£59.00", { size: 24, fill: C.faint, anchor: "end" });

  y += 110;
  const boxFill = highlightMaxBuy ? C.profitBg : C.surface;
  s +=
    rect(56, y, SW - 112, 210, { r: 24, fill: boxFill }) +
    label(96, y + 56, "Your max buy price") +
    text(96, y + 140, "£15.40", { size: 76, weight: 700, fill: C.profit }) +
    text(96, y + 182, "40% of median — room for fees, postage and profit", {
      size: 22,
      fill: C.faint,
    });

  y += 270;
  s += button(56, y, SW - 112, "I bought it");
  y += 116;
  s +=
    button(56, y, (SW - 136) / 2, "Skip", { fill: "none", stroke: C.border, fg: C.text }) +
    button(SW / 2 + 12, y, (SW - 136) / 2, "Vinted", {
      fill: "none",
      stroke: C.border,
      fg: C.text,
    });
  return s;
}

/** 4. Two-tap buy log. */
function screenBuyLog() {
  const top = 900;
  let s =
    rect(0, 0, SW, SH, { fill: "#0B0A09" }) +
    walkman(SW / 2 - 165, 180, 330) +
    rect(0, 0, SW, SH, { fill: "rgba(18,17,16,0.55)" }) +
    statusBar() +
    rect(0, top, SW, SH - top, { r: 48, fill: C.bg }) +
    rect(SW / 2 - 36, top + 26, 72, 8, { r: 4, fill: C.border });

  let y = top + 110;
  s += text(56, y, "Corsair Vengeance RGB Pro", { size: 40, weight: 700 });
  y += 44;
  s += text(56, y, "What did you pay?", { size: 26, fill: C.muted });
  y += 80;
  s += label(56, y, "Paid");
  y += 30;
  s +=
    rect(56, y, SW - 112, 120, { r: 24, fill: C.raised }) +
    text(96, y + 82, "£", { size: 46, fill: C.muted }) +
    text(140, y + 82, "0.50", { size: 52, weight: 600, fill: C.text });

  y += 156;
  const amounts = ["50p", "£1", "£2", "£5", "£10"];
  let x = 56;
  amounts.forEach((a, i) => {
    const w = 130;
    s += rect(x, y, w, 74, { r: 37, fill: i === 0 ? C.text : C.surface });
    s += text(x + w / 2, y + 50, a, {
      size: 30,
      weight: 700,
      fill: i === 0 ? C.bg : C.text,
      anchor: "middle",
    });
    x += w + 16;
  });

  y += 130;
  s += text(56, y, "That's about £33.50 of headroom at the median.", {
    size: 28,
    fill: C.profit,
  });
  y += 70;
  s += button(56, y, SW - 112, "Log it");
  return s;
}

/** 5. Portfolio list. */
function screenFinds() {
  let s = rect(0, 0, SW, SH, { fill: C.bg }) + statusBar();
  let y = 190;
  s += text(56, y, "My Finds", { size: 72, weight: 700 });
  y += 80;
  ["In stock", "Sold", "All"].forEach((f, i) => {
    const w = f.length * 17 + 60;
    const x = 56 + (i === 0 ? 0 : i === 1 ? 230 : 380);
    const on = i === 2; // the list below is mixed, which is what "All" shows
    s += rect(x, y, w, 76, { r: 38, fill: on ? C.text : C.surface });
    s += text(x + w / 2, y + 50, f, {
      size: 28,
      weight: 600,
      fill: on ? C.bg : C.muted,
      anchor: "middle",
    });
  });

  y += 120;
  const rows = [
    ["Corsair Vengeance RGB Pro", "Paid £5.00 · sold £42.00", "+£28.05", true],
    ["Technics SL-1200 platter", "Paid £5.00 · worth ~£68.00", "+£63.00", false],
    ["Pyrex bowl, blue", "Paid £1.00 · sold £12.00", "+£9.44", true],
    ["Denby stoneware set", "Paid £4.00 · worth ~£35.00", "+£31.00", false],
    ["Game Boy, boxed", "Paid £2.00 · sold £45.00", "+£38.15", true],
  ];
  rows.forEach(([name, sub, profit, sold]) => {
    s +=
      rect(56, y, SW - 112, 150, { r: 24, fill: C.surface }) +
      photo(88, y + 30, 90) +
      (sold
        ? `<circle cx="${88 + 76}" cy="${y + 42}" r="18" fill="${C.profitBg}"/>` +
          text(88 + 76, y + 50, "✓", { size: 22, fill: C.profit, anchor: "middle" })
        : "") +
      text(206, y + 66, name, { size: 30, weight: 600 }) +
      text(206, y + 110, sub, { size: 24, fill: C.muted }) +
      pill(SW - 250, y + 48, profit, { bg: C.profitBg, fg: C.profit, w: 194 });
    y += 168;
  });
  return s + tabBar("My Finds");
}

/** 6. Find detail with the profit breakdown. */
function screenDetail() {
  let s = rect(0, 0, SW, SH, { fill: C.bg });
  // Photo hero.
  s +=
    rect(0, 0, SW, 620, { fill: "#2A2420" }) +
    walkman(SW / 2 - 210, 220, 420) +
    statusBar() +
    `<circle cx="90" cy="120" r="46" fill="rgba(18,17,16,0.6)"/>` +
    text(90, 136, "‹", { size: 56, fill: C.text, anchor: "middle" });

  let y = 700;
  s += pill(56, y, "Sold", { bg: C.profitBg, fg: C.profit });
  y += 100;
  s += text(56, y, "Sony Walkman", { size: 62, weight: 700 });
  y += 74;
  s += text(56, y, "WM-EX194", { size: 62, weight: 700 });

  y += 70;
  s += rect(56, y, SW - 112, 480, { r: 24, fill: C.surface });
  const lines = [
    ["Sold for", "£42.00", C.text],
    ["You paid", "−£5.00", C.loss],
    ["Selling fees", "−£5.46", C.loss],
    ["Postage", "−£3.49", C.loss],
  ];
  let ly = y + 76;
  lines.forEach(([k, v, col]) => {
    s +=
      text(96, ly, k, { size: 30, fill: C.muted }) +
      text(SW - 96, ly, v, { size: 30, fill: col, anchor: "end" });
    ly += 62;
  });
  s +=
    rect(96, ly - 22, SW - 192, 2, { fill: C.border }) +
    text(96, ly + 60, "Profit", { size: 34, weight: 700 }) +
    text(SW - 96, ly + 66, "+£32.55", {
      size: 52,
      weight: 700,
      fill: C.profit,
      anchor: "end",
    });

  y += 540;
  s += button(56, y, SW - 112, "Share this win");
  return s + tabBar("My Finds");
}

/** 7. Profit dashboard. */
function screenProfit() {
  let s = rect(0, 0, SW, SH, { fill: C.bg }) + statusBar();
  let y = 190;
  s += text(56, y, "Profit", { size: 72, weight: 700 });
  y += 90;
  s += label(56, y, "Realised profit");
  y += 110;
  s += text(56, y, "£1,284.60", { size: 124, weight: 700, fill: C.profit });
  y += 56;
  s += text(56, y, "38 flips · 71% average margin", { size: 28, fill: C.muted });

  y += 70;
  const cards = [
    ["This month", "£318.40"],
    ["Last month", "£204.10"],
    ["In stock", "17"],
    ["Spent", "£142.00"],
  ];
  cards.forEach(([k, v], i) => {
    const cx = 56 + (i % 2) * ((SW - 112) / 2 + 20);
    const cy = y + Math.floor(i / 2) * 190;
    const cw = (SW - 132) / 2;
    s +=
      rect(cx, cy, cw, 168, { r: 24, fill: C.surface }) +
      label(cx + 32, cy + 56, k) +
      text(cx + 32, cy + 120, v, { size: 44, weight: 700 });
  });

  y += 410;
  s += rect(56, y, SW - 112, 330, { r: 24, fill: C.surface }) + label(96, y + 56, "Last 6 months");
  const bars = [0.18, 0.32, 0.26, 0.55, 0.72, 1];
  const months = ["F", "M", "A", "M", "J", "J"];
  bars.forEach((b, i) => {
    const bw = 96;
    const bx = 96 + i * 120;
    const maxH = 150;
    const bh = Math.max(8, b * maxH);
    s += rect(bx, y + 240 - bh, bw, bh, { r: 10, fill: C.profit });
    s += text(bx + bw / 2, y + 296, months[i], { size: 24, fill: C.faint, anchor: "middle" });
  });

  y += 380;
  s +=
    rect(56, y, SW - 112, 250, { r: 24, fill: C.surface }) +
    label(96, y + 56, "Best flip ever") +
    photo(96, y + 84, 100) +
    text(224, y + 128, "Corsair Vengeance RGB", { size: 30, weight: 600 }) +
    text(224, y + 172, "£5.00 → £42.00", { size: 26, fill: C.muted }) +
    text(SW - 96, y + 158, "£28.05", { size: 52, weight: 700, fill: C.gold, anchor: "end" });

  return s + tabBar("Profit");
}

/** 8. The share card, as generated by the app. */
function screenShare() {
  let s = rect(0, 0, SW, SH, { fill: C.bg }) + statusBar();
  const cx = 70;
  const cy = 380;
  const cw = SW - 140;
  const ch = 1180;
  s += rect(cx, cy, cw, ch, { r: 32, fill: "#0E0D0C" });
  s += label(cx + 60, cy + 100, "That's a find", C.gold);
  s += rect(cx + 60, cy + 140, cw - 120, 420, { r: 20, fill: "#2A2420" });
  s += walkman(cx + cw / 2 - 170, cy + 200, 340);
  s += text(cx + 60, cy + 640, "Corsair Vengeance RGB Pro", { size: 38, weight: 700 });
  s += text(cx + 60, cy + 720, "Found for £5.00  →  Sold for £42.00", {
    size: 28,
    fill: C.muted,
  });
  s += rect(cx + 60, cy + 770, cw - 120, 250, { r: 24, fill: C.surface });
  s += label(cx + 100, cy + 830, "Profit");
  s += text(cx + 100, cy + 950, "£28.05", { size: 104, weight: 700, fill: C.profit });
  s += `<circle cx="${cx + 78}" cy="${cy + 1090}" r="26" fill="${C.gold}"/>`;
  s += text(cx + 120, cy + 1102, "Boot Sale Buddy", { size: 28, fill: C.muted });

  s += text(SW / 2, cy + ch + 130, "Share to Instagram, WhatsApp, anywhere", {
    size: 28,
    fill: C.muted,
    anchor: "middle",
  });
  return s + tabBar("Profit");
}

/** 9. Paywall. */
function screenPaywall() {
  const top = 380;
  let s =
    rect(0, 0, SW, SH, { fill: "#0B0A09" }) +
    rect(0, 0, SW, SH, { fill: "rgba(18,17,16,0.72)" }) +
    statusBar() +
    rect(0, top, SW, SH - top, { r: 48, fill: C.bg }) +
    rect(SW / 2 - 36, top + 26, 72, 8, { r: 4, fill: C.border });

  let y = top + 100;
  s += pill(56, y, "Buddy Pro", { bg: C.goldBg, fg: C.gold });
  y += 110;
  s += text(56, y, "Scan without counting", { size: 52, weight: 700 });
  y += 52;
  s += text(56, y, "One good flip pays for the year.", { size: 28, fill: C.muted });

  y += 70;
  const feats = [
    "Unlimited scans — no counting",
    "CSV export for your tax return",
    "Custom fee presets per platform",
    "Price-drop watchlist (coming soon)",
    "App icon pack",
  ];
  feats.forEach((f) => {
    s +=
      text(66, y + 32, "✓", { size: 32, fill: C.profit }) +
      text(126, y + 32, f, { size: 30, fill: C.text });
    y += 62;
  });

  y += 30;
  const plans = [
    ["Yearly", "About £1.08 a month", "£12.99", "per year", true],
    ["Monthly", "", "£1.99", "per month", false],
    ["Lifetime", "Pay once, keep it forever", "£29.99", "one-off", false],
  ];
  plans.forEach(([name, sub, price, period, sel]) => {
    const h = sub ? 160 : 130;
    s += rect(56, y, SW - 112, h, {
      r: 24,
      fill: sel ? C.profitBg : C.surface,
      stroke: sel ? C.profit : C.border,
      sw: 3,
    });
    s += `<circle cx="112" cy="${y + h / 2}" r="20" fill="none" stroke="${sel ? C.profit : C.faint}" stroke-width="4"/>`;
    if (sel) s += `<circle cx="112" cy="${y + h / 2}" r="10" fill="${C.profit}"/>`;
    s += text(160, y + (sub ? 62 : 78), name, { size: 34, weight: 700 });
    if (sel) {
      s += rect(300, y + 30, 190, 48, { r: 24, fill: C.goldBg });
      s += text(395, y + 63, "7-day trial", {
        size: 22,
        weight: 600,
        fill: C.gold,
        anchor: "middle",
      });
    }
    if (sub) s += text(160, y + 112, sub, { size: 24, fill: C.muted });
    s += text(SW - 76, y + (sub ? 70 : 72), price, {
      size: 40,
      weight: 700,
      anchor: "end",
    });
    s += text(SW - 76, y + (sub ? 112 : 110), period, { size: 24, fill: C.faint, anchor: "end" });
    y += h + 20;
  });

  y += 20;
  s += button(56, y, SW - 112, "Start 7-day free trial");
  return s;
}


// ---------------------------------------------------------------------------
// Feature cards (shots 3 and 6)
//
// Cropping into a full screen mock dragged in chrome that made no sense out
// of context — the dimmed camera frame behind the result sheet read as a
// grey smear, and the tab bar got sliced. These two shots are the moments
// worth enlarging, so they get purpose-built cards at full size instead:
// same content, same tokens, composed to fill the frame.
// ---------------------------------------------------------------------------
const CARD_X = 70;
const CARD_Y = 880;
const CARD_W = W - 140;
const PAD = 84;

function heroShell(inner) {
  return (
    `<rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="2100" rx="64" fill="${C.bg}"/>` +
    `<rect x="${CARD_X}" y="${CARD_Y}" width="${CARD_W}" height="2100" rx="64" fill="none" stroke="#3A3530" stroke-width="4"/>` +
    inner
  );
}

/** Shot 3 — the walk-away number. */
function heroMaxBuy() {
  const x = CARD_X + PAD;
  const w = CARD_W - PAD * 2;
  let y = CARD_Y + 150;
  let s = label(x, y, "The item");
  y += 92;
  s += text(x, y, "Corsair Vengeance", { size: 70, weight: 700 });
  y += 84;
  s += text(x, y, "RGB Pro 16GB", { size: 70, weight: 700 });

  y += 130;
  s += rect(x, y, w, 2, { fill: C.border });

  y += 140;
  s += label(x, y, "Median asking price");
  y += 124;
  s += text(x, y, "£38.50", { size: 128, weight: 800 });
  y += 58;
  s += text(x, y, "Asking prices on eBay UK right now · 23 listings", {
    size: 30,
    fill: C.muted,
  });

  y += 110;
  s +=
    rect(x, y, w, 16, { r: 8, fill: C.raised }) +
    rect(x + w * 0.46, y - 10, 10, 36, { r: 5, fill: C.profit }) +
    text(x, y + 82, "£24.99", { size: 28, fill: C.faint }) +
    text(x + w, y + 82, "£59.00", { size: 28, fill: C.faint, anchor: "end" });

  y += 200;
  s += rect(x, y, w, 420, { r: 36, fill: C.profitBg, stroke: C.profit, sw: 3 });
  s += label(x + 56, y + 92, "Your max buy price", C.profit);
  s += text(x + 56, y + 260, "£15.40", { size: 186, weight: 800, fill: C.profit });
  s += text(x + 56, y + 330, "40% of the median — leaves room for eBay fees,", {
    size: 30,
    fill: C.muted,
  });
  s += text(x + 56, y + 376, "postage and a worthwhile margin.", { size: 30, fill: C.muted });

  y += 500;
  s += text(x, y, "Ask more than that and it's not worth it.", {
    size: 34,
    weight: 600,
    fill: C.text,
  });
  y += 52;
  s += text(x, y, "Walk away with a clear conscience.", { size: 34, fill: C.muted });
  return heroShell(s);
}

/** Shot 6 — where the money actually went. */
function heroBreakdown() {
  const x = CARD_X + PAD;
  const w = CARD_W - PAD * 2;
  let y = CARD_Y + 140;
  let s = photo(x, y, 150, 30);
  s += pill(x + 196, y + 10, "Sold", { bg: C.profitBg, fg: C.profit });
  s += text(x + 196, y + 136, "Corsair Vengeance RGB", { size: 46, weight: 700 });

  y += 250;
  s += rect(x, y, w, 2, { fill: C.border });

  y += 120;
  const rows = [
    ["Sold for", "£42.00", C.text],
    ["You paid", "−£5.00", C.loss],
    ["Selling fees (13%)", "−£5.46", C.loss],
    ["Postage", "−£3.49", C.loss],
  ];
  rows.forEach(([k, v, col]) => {
    s +=
      text(x, y, k, { size: 40, fill: C.muted }) +
      text(x + w, y, v, { size: 40, weight: 600, fill: col, anchor: "end" });
    y += 108;
  });

  y += 30;
  s += rect(x, y, w, 2, { fill: C.border });
  y += 140;
  s += text(x, y, "Profit", { size: 52, weight: 700 });
  s += text(x + w, y + 20, "+£28.05", { size: 128, weight: 800, fill: C.profit, anchor: "end" });

  y += 170;
  s += rect(x, y, w, 240, { r: 36, fill: C.surface });
  s += label(x + 56, y + 76, "Margin");
  s += text(x + 56, y + 176, "66.8%", { size: 92, weight: 800, fill: C.gold });
  s += text(x + w - 56, y + 150, "Bought in Lisburn", {
    size: 30,
    fill: C.muted,
    anchor: "end",
  });
  s += text(x + w - 56, y + 194, "for a fiver", { size: 30, fill: C.muted, anchor: "end" });
  return heroShell(s);
}

// ---------------------------------------------------------------------------
// Composition
//
// Three layouts, deliberately mixed. Nine identical centred-device shots
// read as a template no matter how good the app is; varying the rhythm is
// what makes a listing look considered. The device bleeds off the bottom
// so the screen is big enough to actually read at thumbnail size, and two
// shots crop hard into a single number instead — those are the moments
// worth enlarging.
// ---------------------------------------------------------------------------
const DEV_W = 1010;
const DEV_SCALE = DEV_W / SW;
const DEV_H = SH * DEV_SCALE;
const DEV_X = (W - DEV_W) / 2;
const DEV_Y = 900;

function background(accent, tint) {
  return `
  <defs>
    <linearGradient id="bg" x1="0.1" y1="0" x2="0.7" y2="1">
      <stop offset="0%" stop-color="${tint}"/>
      <stop offset="45%" stop-color="${C.bg}"/>
      <stop offset="100%" stop-color="#080706"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.30"/>
      <stop offset="45%" stop-color="${accent}" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="screenClip">
      <rect x="${DEV_X}" y="${DEV_Y}" width="${DEV_W}" height="${DEV_H}" rx="72"/>
    </clipPath>
    <clipPath id="zoomClip">
      <rect x="70" y="880" width="${W - 140}" height="2100" rx="64"/>
    </clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="${W * 0.5}" cy="620" rx="900" ry="760" fill="url(#glow)"/>`;
}

/** Caption block: big, tight, left-aligned with an accent rule above it. */
function caption(lines, sub, accent) {
  let out = rect(96, 210, 150, 10, { r: 5, fill: "url(#rule)" });
  let y = 360;
  for (const line of lines) {
    out += text(96, y, line, { size: 104, weight: 800, fill: C.text, spacing: -2 });
    y += 118;
  }
  if (sub) {
    out += text(96, y + 6, sub, { size: 38, weight: 500, fill: accent });
  }
  return out;
}

/** Layout A — phone bleeding off the bottom edge. */
function deviceShot({ screen, float = "" }) {
  return `
  <rect x="${DEV_X - 22}" y="${DEV_Y - 22}" width="${DEV_W + 44}" height="${DEV_H + 44}" rx="94" fill="#000000"/>
  <rect x="${DEV_X - 22}" y="${DEV_Y - 22}" width="${DEV_W + 44}" height="${DEV_H + 44}" rx="94" fill="none" stroke="#403A34" stroke-width="5"/>
  <g clip-path="url(#screenClip)">
    <g transform="translate(${DEV_X}, ${DEV_Y}) scale(${DEV_SCALE})">${screen}</g>
  </g>
  ${float}`;
}

/**
 * Layout B — crop hard into one region of the same screen mock. Reusing the
 * mock rather than drawing a bespoke card keeps the crop honest: it is
 * literally the same pixels, just nearer.
 */
function zoomShot({ screen, focusX, focusY, scale }) {
  const boxX = 70;
  const boxY = 880;
  const boxW = W - 140;
  // Runs off the bottom of the canvas, matching the device shots.
  const boxH = 2100;
  const tx = boxX + boxW / 2 - focusX * scale;
  const ty = boxY + boxH / 2 - focusY * scale;
  return `
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="64" fill="${C.bg}"/>
  <g clip-path="url(#zoomClip)">
    <g transform="translate(${tx}, ${ty}) scale(${scale})">${screen}</g>
  </g>
  <rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="64" fill="none" stroke="#3A3530" stroke-width="4"/>`;
}

/** Layout C — the share card, tilted, as an object in its own right. */
function cardShot({ screen }) {
  return `
  <g transform="translate(${W / 2}, 1720) rotate(-5) translate(${-SW * 0.55}, ${-1951 * 0.42})">
    <g transform="scale(1.1)">
      <rect x="-20" y="-20" width="${SW + 40}" height="${1951 * 0.86}" rx="56" fill="#000000" opacity="0.55"/>
      <g clip-path="url(#screenClip)"></g>
      ${screen}
    </g>
  </g>`;
}

/** A floating stat chip that sits outside the phone for emphasis. */
function floatChip(x, y, big, small, accent) {
  const w = 470;
  const h = 190;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="36" fill="${C.surface}" stroke="${accent}" stroke-width="4"/>` +
    label(x + 40, y + 62, small, accent) +
    text(x + 40, y + 146, big, { size: 76, weight: 800, fill: accent })
  );
}

function compose(shot) {
  const accent = shot.accent ?? C.gold;
  const tint = shot.tint ?? "#1A160E";
  const lines = shot.caption.split("|");
  let body;
  if (shot.layout === "hero") {
    body = shot.hero;
  } else if (shot.layout === "zoom") {
    body = zoomShot(shot);
  } else if (shot.layout === "card") {
    body = cardShot(shot);
  } else {
    body = deviceShot(shot);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${background(accent, tint)}
${caption(lines, shot.sub, accent)}
${body}
</svg>`;
}

const SHOTS = [
  {
    file: "01-scan.png",
    caption: "Know what|it's worth",
    sub: "Before you hand over the 50p",
    screen: screenScan(),
  },
  {
    file: "02-result.png",
    caption: "A price in|seconds",
    sub: "Not a guess, not a gut feeling",
    screen: resultSheet(),
    float: floatChip(760, 700, "£38.50", "Median", C.gold),
  },
  {
    file: "03-maxbuy.png",
    caption: "Know when|to walk away",
    sub: "Fees and postage already taken off",
    accent: C.profit,
    tint: "#0C1C13",
    layout: "hero",
    hero: heroMaxBuy(),
  },
  {
    file: "04-buylog.png",
    caption: "Logged in|two taps",
    sub: "Built for cold hands and bad signal",
    screen: screenBuyLog(),
  },
  {
    file: "05-finds.png",
    caption: "Your whole|haul",
    sub: "In stock, sold, and what you're up",
    accent: C.profit,
    tint: "#0C1C13",
    screen: screenFinds(),
  },
  {
    file: "06-detail.png",
    caption: "Every penny|accounted for",
    sub: "See exactly what the fees took",
    layout: "hero",
    hero: heroBreakdown(),
  },
  {
    file: "07-profit.png",
    caption: "Watch it|stack up",
    sub: "Your finds, tracked like a portfolio",
    accent: C.profit,
    tint: "#0C1C13",
    screen: screenProfit(),
    float: floatChip(740, 660, "+£318", "This month", C.profit),
  },
  {
    file: "08-share.png",
    caption: "Share|the wins",
    sub: "A fiver to £42 deserves an audience",
    accent: C.profit,
    tint: "#0C1C13",
    screen: screenProfit(),
    float: floatChip(700, 640, "£28.05", "Best flip", C.gold),
  },
  {
    file: "09-paywall.png",
    caption: "Less than one|good flip",
    sub: "£12.99 a year · 7-day free trial",
    screen: screenPaywall(),
  },
];

/**
 * App Store Connect has a separate upload slot per device size and rejects
 * anything that isn't an exact match, so we emit every accepted size rather
 * than making someone resize by hand. Everything is composed once at
 * 1290×2796 and resized; the aspect ratios differ by about 0.2%, which is
 * invisible, and re-laying out per size would risk the sizes disagreeing.
 */
const SIZES = [
  { dir: "iphone-6.7", w: 1290, h: 2796, note: "6.7in and 6.9in slots" },
  { dir: "iphone-6.5", w: 1284, h: 2778, note: "6.5in slot" },
];

for (const size of SIZES) {
  mkdirSync(join(outDir, size.dir), { recursive: true });
}

for (const shot of SHOTS) {
  const svg = compose(shot);
  // Rendered at 2x then downsampled: sharp's density is DPI, so 144 on a
  // 1290-wide viewBox produces 2580px. That has to be resized to the exact
  // target — App Store Connect rejects anything off by a single pixel, and
  // an oversized file looks correct until you check its metadata.
  const master = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  for (const size of SIZES) {
    const png = await sharp(master)
      .resize(size.w, size.h, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    writeFileSync(join(outDir, size.dir, shot.file), png);
  }
  console.log(`wrote ${shot.file}`);
}

for (const size of SIZES) {
  console.log(`
${size.w}x${size.h}  ->  assets/screenshots/${size.dir}/   (${size.note})`);
}

