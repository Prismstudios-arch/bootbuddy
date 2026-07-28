import { mkdirSync, writeFileSync } from "node:fs";
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

/** A small stand-in "photo" so thumbnails aren't empty grey voids. */
const photo = (x, y, size, r = 18) =>
  `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${r}" fill="#3A322B"/>` +
  `<rect x="${x + size * 0.18}" y="${y + size * 0.3}" width="${size * 0.64}" height="${size * 0.34}" rx="${size * 0.06}" fill="#544A3F"/>` +
  `<circle cx="${x + size * 0.34}" cy="${y + size * 0.47}" r="${size * 0.08}" fill="#3A322B"/>` +
  `<circle cx="${x + size * 0.66}" cy="${y + size * 0.47}" r="${size * 0.08}" fill="#3A322B"/>`;

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
  const g = 420;
  const gx = (SW - g) / 2;
  const gy = 620;
  const corner = 86;
  const bracket = (px, py, sx, sy) =>
    `<path d="M ${px + sx * corner} ${py} L ${px} ${py} L ${px} ${py + sy * corner}" stroke="${C.text}" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.9"/>`;
  return (
    rect(0, 0, SW, SH, { fill: "#0B0A09" }) +
    // A trestle table with a cassette player framed on it — vague blobs
    // read as a rendering artefact, a recognisable object reads as a scan.
    rect(0, 980, SW, 420, { fill: "#241F1A" }) +
    rect(0, 980, SW, 6, { fill: "#332C25" }) +
    rect(150, 1080, 180, 120, { r: 12, fill: "#1C1815" }) +
    rect(600, 1050, 160, 150, { r: 70, fill: "#1C1815" }) +
    rect(SW / 2 - 150, 700, 300, 210, { r: 20, fill: "#4A423A" }) +
    rect(SW / 2 - 120, 736, 240, 120, { r: 10, fill: "#2A2520" }) +
    `<circle cx="${SW / 2 - 56}" cy="796" r="40" fill="#3A342D"/>` +
    `<circle cx="${SW / 2 + 56}" cy="796" r="40" fill="#3A342D"/>` +
    rect(SW / 2 - 150, 880, 300, 30, { r: 8, fill: "#3A332C" }) +
    statusBar() +
    bracket(gx, gy, 1, 1) +
    bracket(gx + g, gy, -1, 1) +
    bracket(gx, gy + g, 1, -1) +
    bracket(gx + g, gy + g, -1, -1) +
    rect(gx - 40, gy + g + 70, g + 80, 64, { r: 32, fill: "rgba(18,17,16,0.75)" }) +
    text(SW / 2, gy + g + 112, "One item, fill the frame — labels help", {
      size: 24,
      fill: C.text,
      anchor: "middle",
    }) +
    // Recent scans strip.
    pill(56, SH - 400, "Sony Walkman · £28", { bg: "rgba(18,17,16,0.72)", fg: C.text }) +
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
    rect(120, 180, 660, 460, { r: 24, fill: "#221E1A" }) +
    rect(0, 0, SW, SH, { fill: "rgba(18,17,16,0.72)" }) +
    statusBar() +
    rect(0, top, SW, SH - top, { r: 48, fill: C.bg }) +
    rect(SW / 2 - 36, top + 26, 72, 8, { r: 4, fill: C.border });

  let y = top + 110;
  s += text(56, y, "Sony Walkman WM-EX194", { size: 46, weight: 700 });
  y += 44;
  s += text(56, y, "Certain", { size: 26, fill: C.muted });
  y += 120;
  s += text(56, y, "£28.50", { size: 118, weight: 700, fill: C.text });
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
    text(56, y + 60, "£8.99", { size: 24, fill: C.faint }) +
    text(SW - 56, y + 60, "£45.00", { size: 24, fill: C.faint, anchor: "end" });

  y += 110;
  const boxFill = highlightMaxBuy ? C.profitBg : C.surface;
  s +=
    rect(56, y, SW - 112, 210, { r: 24, fill: boxFill }) +
    label(96, y + 56, "Your max buy price") +
    text(96, y + 140, "£11.40", { size: 76, weight: 700, fill: C.profit }) +
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
    rect(120, 180, 660, 500, { r: 24, fill: "#221E1A" }) +
    rect(0, 0, SW, SH, { fill: "rgba(18,17,16,0.72)" }) +
    statusBar() +
    rect(0, top, SW, SH - top, { r: 48, fill: C.bg }) +
    rect(SW / 2 - 36, top + 26, 72, 8, { r: 4, fill: C.border });

  let y = top + 110;
  s += text(56, y, "Sony Walkman WM-EX194", { size: 44, weight: 700 });
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
  s += text(56, y, "That's about £28.00 of headroom at the median.", {
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
    ["Sony Walkman WM-EX194", "Paid £0.50 · sold £42.00", "+£32.55", true],
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
    `<circle cx="${SW / 2}" cy="330" r="150" fill="#3A322B"/>` +
    rect(SW / 2 - 60, 250, 120, 170, { r: 14, fill: "#4A3F35" }) +
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
    ["You paid", "−£0.50", C.loss],
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
    text(224, y + 128, "Sony Walkman", { size: 34, weight: 600 }) +
    text(224, y + 172, "£0.50 → £42.00", { size: 26, fill: C.muted }) +
    text(SW - 96, y + 158, "£32.55", { size: 52, weight: 700, fill: C.gold, anchor: "end" });

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
  s += `<circle cx="${cx + cw / 2}" cy="${cy + 350}" r="120" fill="#3A322B"/>`;
  s += text(cx + 60, cy + 640, "Sony Walkman WM-EX194", { size: 44, weight: 700 });
  s += text(cx + 60, cy + 720, "Found for £0.50  →  Sold for £42.00", {
    size: 28,
    fill: C.muted,
  });
  s += rect(cx + 60, cy + 770, cw - 120, 250, { r: 24, fill: C.surface });
  s += label(cx + 100, cy + 830, "Profit");
  s += text(cx + 100, cy + 950, "£32.55", { size: 104, weight: 700, fill: C.profit });
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
// Frame: caption + device
// ---------------------------------------------------------------------------
function compose({ caption, sub, screen, accent = C.gold, tint = "#17150F" }) {
  const captionLines = caption.split("\n");
  let head = "";
  captionLines.forEach((line, i) => {
    head += text(W / 2, 250 + i * 92, line, {
      size: 76,
      weight: 700,
      anchor: "middle",
      fill: C.text,
    });
  });
  if (sub) {
    head += text(W / 2, 250 + captionLines.length * 92 + 24, sub, {
      size: 34,
      anchor: "middle",
      fill: accent,
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0%" stop-color="${tint}"/>
      <stop offset="60%" stop-color="${C.bg}"/>
      <stop offset="100%" stop-color="#0A0908"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.20"/>
      <stop offset="55%" stop-color="${accent}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="screenClip">
      <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="64"/>
    </clipPath>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <ellipse cx="${W / 2}" cy="200" rx="760" ry="620" fill="url(#glow)"/>
  ${head}
  <rect x="${SX - 26}" y="${SY - 26}" width="${SW + 52}" height="${SH + 52}" rx="90" fill="#000000" opacity="0.9"/>
  <rect x="${SX - 26}" y="${SY - 26}" width="${SW + 52}" height="${SH + 52}" rx="90" fill="none" stroke="#3A3530" stroke-width="4"/>
  <g clip-path="url(#screenClip)"><g transform="translate(${SX}, ${SY})">${screen}</g></g>
</svg>`;
}

const SHOTS = [
  {
    file: "01-scan.png",
    caption: "Know what it's worth\nbefore you buy",
    sub: "Point your camera at anything on the table",
    screen: screenScan(),
  },
  {
    file: "02-result.png",
    caption: "A price in seconds,\nnot a guess",
    sub: "Live asking prices, honestly labelled",
    screen: resultSheet(),
  },
  {
    file: "03-maxbuy.png",
    caption: "Know your\nwalk-away price",
    sub: "Fees and postage already accounted for",
    accent: C.profit,
    tint: "#0E1A13",
    screen: resultSheet({ highlightMaxBuy: true }),
  },
  {
    file: "04-buylog.png",
    caption: "Log the buy\nin two taps",
    sub: "Built for cold hands and bad signal",
    screen: screenBuyLog(),
  },
  {
    file: "05-finds.png",
    caption: "Your whole haul,\nin one place",
    sub: "In stock, sold, and what you're up",
    accent: C.profit,
    tint: "#0E1A13",
    screen: screenFinds(),
  },
  {
    file: "06-detail.png",
    caption: "Every penny\naccounted for",
    sub: "See exactly what the fees took",
    screen: screenDetail(),
  },
  {
    file: "07-profit.png",
    caption: "Watch the profit\nstack up",
    sub: "Your finds, tracked like a portfolio",
    accent: C.profit,
    tint: "#0E1A13",
    screen: screenProfit(),
  },
  {
    file: "08-share.png",
    caption: "Share the wins",
    sub: "50p to £42 deserves an audience",
    screen: screenShare(),
  },
  {
    file: "09-paywall.png",
    caption: "Less than one\ngood flip a year",
    sub: "£12.99 a year · 7-day free trial",
    screen: screenPaywall(),
  },
];

for (const shot of SHOTS) {
  const svg = compose(shot);
  const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  writeFileSync(join(outDir, shot.file), png);
  console.log(`wrote ${shot.file} (${(png.length / 1024).toFixed(0)}KB)`);
}
console.log(`\n9 screenshots at ${W}×${H} in assets/screenshots/`);
