import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

// Los SVG traen width="100%" height="100%"; se fija un tamaño base para que el rasterizado sea fiable
const targets = [
  { src: 'public/icon.svg',          out: 'public/icon-192.png',          size: 192 },
  { src: 'public/icon.svg',          out: 'public/icon-512.png',          size: 512 },
  { src: 'public/icon-maskable.svg', out: 'public/icon-maskable-192.png', size: 192 },
  { src: 'public/icon-maskable.svg', out: 'public/icon-maskable-512.png', size: 512 },
  { src: 'public/icon-maskable.svg', out: 'public/apple-touch-icon.png',  size: 180 }
];

for (const { src, out, size } of targets) {
  const svg = (await readFile(src, 'utf8')).replace('width="100%" height="100%"', 'width="512" height="512"');
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${out} (${size}x${size})`);
}
