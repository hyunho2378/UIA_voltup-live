import { colors, typography, spacing, radius, layout, motion, zIndex } from './src/tokens.js';

// 토큰 밖 값은 클래스 자체가 생기지 않도록 override 한다(AGENTS.md 1절).
// 새 값이 필요하면 tokens.js에 추가하고 DESIGN.md를 같은 커밋에서 갱신한다.
const { fontFamily, ...typeScale } = typography;

const fontSize = Object.fromEntries(
  Object.entries(typeScale).map(([name, t]) => [
    name,
    [t.size, { lineHeight: String(t.leading), letterSpacing: t.tracking, fontWeight: String(t.weight) }],
  ]),
);

const screens = Object.fromEntries(
  Object.entries(layout.breakpoints).map(([name, px]) => [name, `${px}px`]),
);

export default {
  // vendor 는 서드파티 번들, dev 는 DEV 전용 도구라 둘 다 스캔하지 않는다.
  // dev 패널은 tailwind 클래스를 쓰지 않으므로(토큰 인라인) 제외해도 개발 화면에 영향이 없다.
  content: [
    './index.html',
    './src/*.{js,jsx}',
    './src/{components,routes,lib}/**/*.{js,jsx}',
    '!./src/components/dev/**',
    '!./src/routes/Preview.jsx',
  ],
  theme: {
    screens,
    colors,
    spacing: { 0: '0px', px: '1px', ...spacing },
    fontSize,
    borderRadius: { none: '0px', ...radius },
    zIndex: { auto: 'auto', ...zIndex },
    boxShadow: { none: 'none' }, // 그림자는 글래스 재질이 낸다
    fontFamily: { sans: fontFamily },
    extend: {
      maxWidth: {
        vote: layout.voteMaxWidth,
        admin: layout.adminBase,
        screen: layout.screenBase,
      },
      minHeight: {
        touch: layout.touchMin,
        option: layout.optionMinHeight,
        btn: layout.buttonMinHeight,
      },
      minWidth: { touch: layout.touchMin },
      scale: { press: String(motion.pressScale), optionPress: String(motion.optionPressScale) },
      transitionDuration: {
        DEFAULT: motion.durEnter,
        fast: motion.durFast,
        out: motion.durOut,
        enter: motion.durEnter,
        base: motion.durBase,
        slow: motion.durSlow,
      },
      transitionDelay: { qr: motion.qrDelay },
      brightness: { lead: String(motion.leadBrightness) },
      transitionTimingFunction: {
        DEFAULT: motion.easeOut,
        standard: motion.easeStandard,
        out: motion.easeOut,
      },
    },
  },
  plugins: [],
};
