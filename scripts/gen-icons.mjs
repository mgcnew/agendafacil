// Gera todos os ícones a partir de public/icon-zulan.webp (1254x1254).
// Uso: node scripts/gen-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
const app = join(root, "src", "app");
const src = readFileSync(join(pub, "icon-zulan.webp"));

const BG = "#000000"; // fundo do ícone de origem (preto)

// Full-bleed (purpose "any" / apple / favicon)
const full = (size, out, dir = pub) =>
  sharp(src).resize(size, size).png().toFile(join(dir, out));

// Maskable: ícone a 80% sobre fundo, respeitando a "safe zone" do Android
const maskable = async (size, out) => {
  const inner = Math.round(size * 0.8);
  const resized = await sharp(src).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toFile(join(pub, out));
};

await Promise.all([
  // PWA (referenciados no manifest.webmanifest)
  full(192, "icon-192.png"),
  full(512, "icon-512.png"),
  maskable(512, "icon-maskable-512.png"),
  // Apple touch (fallback no caminho conhecido)
  full(180, "apple-touch-icon.png"),
  // Convenção do Next (favicon/aba + apple)
  full(512, "icon.png", app),
  full(180, "apple-icon.png", app),
]);

console.log("Ícones gerados a partir de icon-zulan.webp.");
