import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Rasterises assets/icon-source.svg into every PNG the app needs.
 *
 * Keeping the icon as checked-in SVG plus a script means the mark can be
 * tweaked in one place and every size stays consistent — rather than a pile
 * of PNGs nobody can regenerate. Run: npm run icons
 */
const here = dirname(fileURLToPath(import.meta.url));
const assets = join(here, "..", "assets");
const images = join(assets, "images");
mkdirSync(images, { recursive: true });

const source = readFileSync(join(assets, "icon-source.svg"));

/** The mark alone on transparency — for splash and Android foreground. */
function markOnly(svg) {
  return Buffer.from(
    svg
      .toString("utf8")
      .replace('<rect width="1024" height="1024" fill="url(#bg)"/>', "")
      // The mask punches a hole for the lens; on transparency that hole must
      // stay dark or the tag and glass merge into one blob.
      .replace('<circle cx="606" cy="606" r="252" fill="black"/>', '<circle cx="606" cy="606" r="252" fill="black"/>'),
  );
}

/** Flat white version for Android's monochrome (themed icon) slot. */
function monochrome(svg) {
  return Buffer.from(
    svg
      .toString("utf8")
      .replace('<rect width="1024" height="1024" fill="url(#bg)"/>', "")
      .replace(/url\(#gold\)/g, "#FFFFFF")
      .replace('<circle cx="352" cy="330" r="46" fill="#121110"/>', '<circle cx="352" cy="330" r="46" fill="#000000"/>'),
  );
}

/**
 * Android adaptive icons are cropped to a circle/squircle by the launcher —
 * the mark has to sit inside the middle ~66% or corners get shaved off.
 */
async function padded(svgBuffer, size, scale) {
  const inner = Math.round(size * scale);
  const pad = Math.round((size - inner) / 2);
  const mark = await sharp(svgBuffer, { density: 600 }).resize(inner, inner).png().toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, top: pad, left: pad }])
    .png()
    .toBuffer();
}

const targets = [
  { file: "icon.png", build: () => sharp(source, { density: 600 }).resize(1024, 1024).png().toBuffer() },
  { file: "favicon.png", build: () => sharp(source, { density: 600 }).resize(48, 48).png().toBuffer() },
  // Splash sits on the themed background colour, so the mark alone.
  { file: "splash-icon.png", build: () => padded(markOnly(source), 512, 0.86) },
  { file: "android-icon-foreground.png", build: () => padded(markOnly(source), 1024, 0.66) },
  { file: "android-icon-monochrome.png", build: () => padded(monochrome(source), 1024, 0.66) },
];

for (const target of targets) {
  const png = await target.build();
  writeFileSync(join(images, target.file), png);
  console.log(`wrote ${target.file} (${(png.length / 1024).toFixed(1)}KB)`);
}
