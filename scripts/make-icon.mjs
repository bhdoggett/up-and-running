/**
 * Draws the app mark — markdown's "##" — as geometry and writes a 1024px PNG
 * for `npm run tauri icon` to generate the platform icon sets from.
 *
 * The hashes are built from bars rather than set as text so the result doesn't
 * depend on a font being installed wherever this runs.
 *
 *   node scripts/make-icon.mjs
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const SIZE = 1024;
const CASE = "#17140F"; // warm road-case dark, the app ground
const AMBER = "#F0A73C"; // the app's accent

// One hash, drawn in its own 300×300 box: two horizontal bars and two verticals
// slanted the way a monospace "#" leans.
function hash(x, y) {
  const t = 50; // bar thickness
  const bar = (bx, by, w, h) =>
    `<rect x="${x + bx}" y="${y + by}" width="${w}" height="${h}" rx="7" />`;
  // Verticals span 94–144 and 182–232, so their group centres on 163. The
  // horizontals are centred on the same axis rather than the box, otherwise
  // they overhang to one side and the two hashes run together.
  return `
    <g>
      ${bar(43, 100, 240, t)}
      ${bar(43, 192, 240, t)}
      <g transform="translate(${x + 163} ${y + 150}) skewX(-11) translate(${-(x + 163)} ${-(y + 150)})">
        ${bar(94, 18, t, 264)}
        ${bar(182, 18, t, 264)}
      </g>
    </g>`;
}

// Two hashes, centred as a pair, with enough air to read as two.
const GAP = 64;
const pairWidth = 300 * 2 + GAP;
const left = (SIZE - pairWidth) / 2;
const top = (SIZE - 300) / 2;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <rect width="${SIZE}" height="${SIZE}" rx="190" fill="${CASE}" />
  <g fill="${AMBER}">
    ${hash(left, top)}
    ${hash(left + 300 + GAP, top)}
  </g>
</svg>`;

writeFileSync("icon-source.svg", svg);
await sharp(Buffer.from(svg)).png().toFile("icon-source.png");
console.log("wrote icon-source.svg and icon-source.png (1024×1024)");
