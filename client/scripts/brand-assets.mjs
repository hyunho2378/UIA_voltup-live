// 브랜드 SVG 재도색. 원본(logo 16색 / graphic 500색 / title 1색)을 tokens.colors.brandRamp 하나로 통일한다.
// 색상은 버리고 명도만 남긴다. 위계를 색이 아니라 명도로 만든다는 DESIGN 규칙과 같은 근거다.
// 원본 파일은 프로젝트 루트에 두고, 산출물만 public/images/brand/ 에 쓴다. 산출물은 커밋한다.
//   실행: npm run brand

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { colors } from '../src/tokens.js';

const SRC = resolve(process.cwd(), '../brand-src');
const OUT = resolve(process.cwd(), 'public/images/brand');

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const rgbToHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// sRGB 상대 휘도. 사람 눈 기준이라 단순 평균보다 원본의 명암 구조를 잘 보존한다.
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// 램프는 어두운 쪽부터 밝은 쪽 순. 휘도를 그대로 램프 위치로 쓴다.
const ramp = colors.brandRamp.map(hexToRgb);
const mapColor = (hex) => {
  const t = Math.min(1, Math.max(0, luminance(hex))) * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(t));
  const f = t - i;
  return rgbToHex(ramp[i].map((c, k) => c + (ramp[i + 1][k] - c) * f));
};

// 원본 SVG 의 모든 색 표기를 바꾼다. style 블록의 `fill: #xxx` 과 속성 `fill="#xxx"` 둘 다 쓰인다.
const recolor = (svg, fn) => svg.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => fn(hex.toLowerCase()));

await mkdir(OUT, { recursive: true });

// 로고: 그림자 필터를 뺀다. 이 제품의 그림자는 글래스 재질만 낸다(DESIGN boxShadow none).
const logo = recolor(await readFile(`${SRC}/logo.svg`, 'utf8'), mapColor)
  .replace(/<filter id="drop-shadow-1"[\s\S]*?<\/filter>/, '')
  .replace(/\.cls-1\s*\{\s*filter:\s*url\(#drop-shadow-1\);\s*\}/, '');
await writeFile(`${OUT}/logo.svg`, logo);

// 타이틀: 아웃라인 단색이라 ink 하나로 바꾼다. 제품 텍스트와 같은 색이어야 한 화면에서 따로 놀지 않는다.
const title = recolor(await readFile(`${SRC}/title.svg`, 'utf8'), () => colors.ink);
await writeFile(`${OUT}/title.svg`, title);

// 그래픽: 요소 7,956개 / 색 500개. SVG 로 넣으면 파싱 비용이 크고 /screen 은 WebGL 글래스와 같이 돈다.
// 재도색한 SVG 를 소스로 남기고 화면에는 WebP 를 쓴다. 배경 생성(make-bg.mjs)과 같은 방식이다.
// 재도색한 SVG 는 파일로 남기지 않는다. public 에 두면 555KB 가 배포본에 그대로 실린다.
const graphicSvg = recolor(await readFile(`${SRC}/graphic.svg`, 'utf8'), mapColor);
await sharp(Buffer.from(graphicSvg), { density: 400 })
  .resize({ width: 1100 })
  .webp({ quality: 92 })
  .toFile(`${OUT}/graphic.webp`);

const size = async (f) => Math.round((await readFile(`${OUT}/${f}`)).length / 1024);
console.log('logo.svg', await size('logo.svg'), 'KB');
console.log('title.svg', await size('title.svg'), 'KB');
console.log('graphic.webp', await size('graphic.webp'), 'KB');
