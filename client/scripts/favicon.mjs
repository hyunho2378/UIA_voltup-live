// 파비콘 생성. brand-assets.mjs 가 만든 재도색 로고(public/images/brand/logo.svg)를 원본으로 쓴다.
// 로고 원본 viewBox 가 142.55x74.13(가로로 넓은 워드마크)이라 정사각형 탭 아이콘에 그대로 쓰면
// 위아래가 잘리거나 눌린다. sharp 의 fit:'contain' 으로 정사각 캔버스에 레터박싱해 비율을 지킨다.
//   실행: npm run favicon (brand-assets.mjs 이후에 실행해야 로고가 이미 재도색돼 있다)

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const SRC = resolve(process.cwd(), 'public/images/brand/logo.svg');
const OUT = resolve(process.cwd(), 'public');

const logoSvg = await readFile(SRC, 'utf8');
const logoBuf = Buffer.from(logoSvg);

// 정사각 PNG. 투명 배경 위에 로고를 가운데 정렬(레터박스)한다.
const square = (size) =>
  sharp(logoBuf, { density: 600 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png();

await square(32).toFile(`${OUT}/favicon-32.png`);
await square(192).toFile(`${OUT}/favicon-192.png`);
await square(512).toFile(`${OUT}/favicon-512.png`);
// 애플 터치 아이콘은 투명 배경이면 iOS 가 검은 배경을 깔아버린다. ambient 배경과 같은 톤의
// 불투명 바탕(흰색)을 깔아 홈 화면에서 어색하지 않게 한다.
await sharp(logoBuf, { density: 600 })
  .resize(140, 140, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .extend({ top: 20, bottom: 20, left: 20, right: 20, background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(`${OUT}/apple-touch-icon.png`);

// SVG 파비콘(모던 브라우저용, 정사각 뷰박스로 감싸 원본을 가운데 배치).
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><image href="/images/brand/logo.svg" x="0" y="0" width="160" height="160" preserveAspectRatio="xMidYMid meet"/></svg>`;
await writeFile(`${OUT}/favicon.svg`, faviconSvg);

const size = async (f) => Math.round((await readFile(`${OUT}/${f}`)).length / 1024);
console.log('favicon.svg', await size('favicon.svg'), 'KB');
console.log('favicon-32.png', await size('favicon-32.png'), 'KB');
console.log('favicon-192.png', await size('favicon-192.png'), 'KB');
console.log('favicon-512.png', await size('favicon-512.png'), 'KB');
console.log('apple-touch-icon.png', await size('apple-touch-icon.png'), 'KB');
