// Gera os ícones PNG do PWA a partir dos SVGs em public/.
// Uso: node scripts/gen-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const icon = readFileSync(join(pub, "icon.svg"));            // rounded (purpose: any)
const maskable = readFileSync(join(pub, "icon-maskable.svg")); // full-bleed (maskable / apple)

const render = (svg, size, out) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(pub, out));

await Promise.all([
  render(icon, 192, "icon-192.png"),
  render(icon, 512, "icon-512.png"),
  render(maskable, 512, "icon-maskable-512.png"),
  render(maskable, 180, "apple-touch-icon.png"),
]);

console.log("Ícones PNG gerados em public/.");
