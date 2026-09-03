// ambient 배경 생성기. `npm run bg` 로 실행한다.
// 값은 전부 src/tokens.js 의 ambient 에서 읽는다. 이 파일에 색·수치를 적지 마라.
// 산출물(svg, webp)은 커밋한다. 빌드 때 다시 만들지 않는다.

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { colors, ambient as A } from '../src/tokens.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images', 'bg');

function svgFor(name) {
  const s = A.surfaces[name];
  const { width: w, height: h } = A;
  const fill = { blue0: colors.blue, blue1: colors.blue, warm: A.warm, cool: A.cool };
  const alpha = { blue0: s.blue[0], blue1: s.blue[1], warm: s.warm, cool: s.cool };

  const blobs = A.blobs
    .map(
      (b) =>
        `    <ellipse cx="${(b.cx * w).toFixed(0)}" cy="${(b.cy * h).toFixed(0)}" rx="${(b.rx * w).toFixed(0)}" ry="${(b.ry * h).toFixed(0)}" fill="${fill[b.key]}" fill-opacity="${alpha[b.key]}"/>`,
    )
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <filter id="soft" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="${s.blur}"/>
    </filter>
    <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="${A.noise.baseFrequency}" numOctaves="2" stitchTiles="stitch"/>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="${s.base}"/>
  <g filter="url(#soft)">
${blobs}
  </g>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="${A.noise.opacity}"/>
</svg>
`;
}

await mkdir(OUT, { recursive: true });

for (const name of Object.keys(A.surfaces)) {
  const svg = svgFor(name);
  await writeFile(join(OUT, `ambient-${name}.svg`), svg);
  await sharp(Buffer.from(svg))
    .resize(A.width, A.height)
    .webp({ quality: 88 })
    .toFile(join(OUT, `ambient-${name}.webp`));
  console.log(`ambient-${name}.svg + .webp`);
}
