import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

/**
 * Resizes real device screenshots to the sizes App Store Connect accepts.
 *
 * Drop captures into assets/screenshots/captures/ and run:
 *   npm run resize-shots
 *
 * App Store Connect has a separate upload slot per device size and rejects
 * anything that isn't an exact pixel match — a screenshot straight off an
 * iPhone 15/16 Pro is 1179×2556, which fits none of the slots. Every phone
 * in this range has nearly the same aspect ratio (they differ by ~0.2%), so
 * a straight resize is imperceptible and far simpler than cropping.
 */
const here = dirname(fileURLToPath(import.meta.url));
const inDir = join(here, "..", "assets", "screenshots", "captures");
const outRoot = join(here, "..", "assets", "screenshots");

const SIZES = [
  { dir: "iphone-6.7", w: 1290, h: 2796, note: "6.7in and 6.9in slots" },
  { dir: "iphone-6.5", w: 1284, h: 2778, note: "6.5in slot" },
];

mkdirSync(inDir, { recursive: true });

const files = readdirSync(inDir).filter((f) =>
  [".png", ".jpg", ".jpeg"].includes(extname(f).toLowerCase()),
);

if (files.length === 0) {
  console.log(`No captures found.\n\nDrop your screenshots into:\n  ${inDir}\n\nThen run this again.`);
  process.exit(0);
}

for (const size of SIZES) {
  mkdirSync(join(outRoot, size.dir), { recursive: true });
}

for (const file of files) {
  const source = join(inDir, file);
  const meta = await sharp(source).metadata();
  const base = file.replace(extname(file), "");

  for (const size of SIZES) {
    const png = await sharp(source)
      .resize(size.w, size.h, { fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer();
    writeFileSync(join(outRoot, size.dir, `${base}.png`), png);
  }
  console.log(`${file}  ${meta.width}x${meta.height}  ->  1290x2796 + 1284x2778`);
}

console.log(`\nWrote ${files.length} capture(s) to:`);
for (const size of SIZES) {
  console.log(`  assets/screenshots/${size.dir}/   (${size.note})`);
}
if (existsSync(inDir)) {
  console.log(
    "\nNote: these overwrite any generated screenshot with the same name.\n" +
      "Name captures distinctly (e.g. 10-real-paywall.png) to keep both.",
  );
}
