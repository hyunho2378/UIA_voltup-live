// tokens.js
// 모든 색, 타이포, 간격, 모션, 글래스 재질의 단일 출처. 하드코딩 금지, 반드시 이 파일 경유.

export const colors = {
  transparent: 'transparent',
  current: 'currentColor',

  ink: '#0A0A0A',      // 제품 텍스트는 이 색 하나만 쓴다. 위계는 크기와 굵기로 만든다.
  ink2: '#757575',     // 텍스트 금지. 보더 전용
  line: '#E5E5E5',     // 텍스트 금지. 보더, disabled 바탕 전용
  blue: '#1F6FFF',
  green: '#16A34A',
  white: '#FFFFFF',
  // 비1등 막대. 트랙과 명도가 확실히 갈려야 길이를 읽을 수 있다.
  inkSoft: '#39404A',

  // 글래스 위에 얹는 반투명 표면. 재질 값이라 alpha 를 포함한다.
  optionFill: 'rgba(255, 255, 255, 0.35)',
  optionBorder: 'rgba(255, 255, 255, 0.5)',
  barTrack: 'rgba(0, 0, 0, 0.08)', // 막대 트랙. fill 보다 확실히 연해야 한다
  rowLine: 'rgba(0, 0, 0, 0.08)',
};

// 제목 700, 본문 400~500. 폰과 20m 프로젝터 양쪽에서 읽혀야 한다.
export const typography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Apple SD Gothic Neo", "Pretendard Variable", Pretendard, "Segoe UI", sans-serif',

  // 폰(청중)
  // 한글 볼드 2줄은 1.31 이면 답답하다. 1.4 로 연다.
  question: { size: '26px', weight: 700, leading: '36px', tracking: '-0.01em' },
  option: { size: '16px', weight: 500, leading: '24px', tracking: '-0.01em' },
  button: { size: '17px', weight: 600, leading: '24px', tracking: '-0.01em' },
  caption: { size: '13px', weight: 500, leading: '20px', tracking: '0' },

  // 어드민
  title: { size: '20px', weight: 700, leading: '28px', tracking: '-0.02em' },
  body: { size: '15px', weight: 500, leading: '22px', tracking: '-0.01em' },

  // 대형화면
  // 한글 볼드 디스플레이는 1.2 미만으로 내리지 않는다.
  screenQuestion: { size: 'clamp(28px, 3.8vw, 56px)', weight: 700, leading: 1.22, tracking: '-0.02em' },
  screenKey: { size: 'clamp(20px, 1.5vw, 27px)', weight: 500, leading: 1.2, tracking: '0' },
  screenLabel: { size: 'clamp(20px, 1.9vw, 34px)', weight: 600, leading: 1.25, tracking: '-0.01em' },
  screenPct: { size: 'clamp(26px, 2.6vw, 48px)', weight: 700, leading: 1.1, tracking: '-0.02em' },
  screenVotes: { size: 'clamp(15px, 1.43vw, 27px)', weight: 500, leading: 1.3, tracking: '0' }, // screenPct 의 0.55배
  // 프로젝터에서 읽혀야 한다. 20px 미만으로 내리지 않는다.
  screenMeta: { size: 'clamp(20px, 1.6vw, 30px)', weight: 500, leading: 1.4, tracking: '0' },
  screenUrl: { size: 'clamp(20px, 2.4vw, 40px)', weight: 500, leading: 1.3, tracking: '-0.01em' },
};

// 8pt 기반
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
  '4xl': '48px',
  '5xl': '64px',

  // 역할 이름. 값이 같아도 의미가 다르면 이름으로 쓴다.
  panel: '20px',    // 1차 글래스 패널 안쪽 패딩
  optionX: '18px',  // 옵션 버튼 좌우 안쪽
  radio: '14px',    // 라디오 원과 라벨 사이
  sub: '10px',      // 제목과 부제 사이
};

// 역할 기반 단일 스케일. 새 값을 추가하기 전에 이 목록에 맞는 역할이 없는지 먼저 본다.
// 중첩할 때는 concentric 을 지킨다: 바깥 radius = 안쪽 radius + 그 사이 padding.
export const radius = {
  bar: '6px',      // 결과 막대. 20m 거리에서 2px 은 각져 보인다
  sm: '12px',      // 개발 도구 전용(앱 표면 미사용)
  md: '16px',      // 옵션 버튼, 주관식 인풋, 어드민 질문 버튼
  lg: '24px',      // QR 플레이트
  pill: '27px',    // 캡슐 버튼. 높이 54 의 정확히 절반
  xl: '36px',      // 1차 글래스 패널. = md(16) + spacing.panel(20) 이라 concentric 성립
  screen: '32px',  // 대형화면 결과 패널
  full: '9999px',  // 원형 도형(라디오, 실시간 점, 완료 점)
};

export const layout = {
  voteMaxWidth: '430px',
  adminBase: '1280px',
  screenBase: '1920px',
  touchMin: '44px',
  optionMinHeight: '56px',
  buttonMinHeight: '54px',
  // 대형화면 차트 (1920 기준, 4K 까지 유동)
  // 차트: 라벨 열은 max-content. auto 로 두면 1fr 막대에 밀려 min-content 로 눌리고
  // 한글이 한 글자씩 줄바꿈된다. 라벨이 길면 막대가 좁아지므로 선택지 문구는 짧게 쓴다.
  chartCols: 'auto max-content 1fr auto',
  chartGap: 'clamp(20px, 2vw, 36px)',
  chartRowMin: 'clamp(64px, 7vw, 110px)',
  chartRowMax: 'clamp(120px, 14vw, 220px)',
  chartValueGap: 'clamp(12px, 1vw, 18px)',
  screenBarHeight: 'clamp(28px, 2.8vw, 56px)',
  screenChartTop: 'clamp(40px, 4vw, 76px)', // 질문과 첫 행 사이
  qrRatio: 0.38, // 화면 짧은 변 대비 QR 크기
  breakpoints: {
    xs: 320, sm: 390, md: 768, lg: 1024, xl: 1280,
    '2xl': 1440, '3xl': 1920, '4xl': 2560, '5xl': 3840,
  },
};

// LiquidGlass 재질 프리셋. 키 이름은 라이브러리 GlassConfig 와 1:1.
// Cheatsheet 대응: regular=.regular, clear=.clear, prominent=.glassProminent
export const glass = {
  regular:   { blurAmount: 0.18, refraction: 0.55, chromAberration: 0.04, edgeHighlight: 0.08, fresnel: 0.9, shadowOpacity: 0.22, shadowSpread: 14, zRadius: 22 },
  clear:     { blurAmount: 0.04, refraction: 0.70, chromAberration: 0.05, edgeHighlight: 0.05, fresnel: 1.0, shadowOpacity: 0.14, shadowSpread: 10, zRadius: 22 },
  prominent: { blurAmount: 0.22, refraction: 0.50, chromAberration: 0.03, edgeHighlight: 0.10, fresnel: 0.9, shadowOpacity: 0.30, shadowSpread: 16, zRadius: 26, brightness: -0.06 },
  // 대형화면 결과 패널: 20m 거리 가독성용. 뒤를 차분하게, 살짝 어둡게.
  screen:    { blurAmount: 0.30, refraction: 0.40, chromAberration: 0.02, edgeHighlight: 0.06, fresnel: 0.8, shadowOpacity: 0.26, shadowSpread: 18, zRadius: 24, brightness: -0.08, saturation: -0.15 },
};

// 코드 생성 배경(ambient). scripts/make-bg.mjs 가 이 값만 읽어 SVG/WebP 를 만든다.
// 사진을 배경으로 쓰지 않는다. 글래스가 굴절할 대상은 넓고 부드러운 색면이면 충분하다.
export const ambient = {
  width: 2560,
  height: 1440,
  warm: '#F3E9DC',
  cool: '#DCE6F5',
  noise: { baseFrequency: 0.8, opacity: 0.035 },
  // 표면별 차이: vote 가 가장 밝고 대비가 낮다. screen 은 20m 가독성 때문에 바탕을 낮춘다.
  surfaces: {
    vote:   { base: '#F4F5F7', blur: 260, blue: [0.30, 0.16], warm: 0.8, cool: 0.9 },
    admin:  { base: '#F4F5F7', blur: 220, blue: [0.45, 0.25], warm: 0.8, cool: 0.9 },
    screen: { base: '#EEF0F3', blur: 200, blue: [0.35, 0.18], warm: 0.8, cool: 0.9 },
  },
  // 타원 4개 위치(비율). 좌상단 blue / 우하단 blue / 우상단 warm / 중앙하단 cool
  blobs: [
    { key: 'blue0', cx: 0.18, cy: 0.20, rx: 0.42, ry: 0.45 },
    { key: 'blue1', cx: 0.86, cy: 0.88, rx: 0.40, ry: 0.42 },
    { key: 'warm',  cx: 0.84, cy: 0.14, rx: 0.34, ry: 0.36 },
    { key: 'cool',  cx: 0.46, cy: 0.86, rx: 0.46, ry: 0.38 },
  ],
};

// transform/opacity만. layout/paint 유발 속성 금지.
export const motion = {
  // press 는 "빠르게 들어가고 부드럽게 나온다". in 과 out 을 나눠 쓴다.
  durFast: '120ms',   // press in, 상태 확정
  durOut: '260ms',    // press out
  durEnter: '220ms',  // 패널 내용 전환
  durBase: '320ms',   // 완료 등장
  durSlow: '700ms',   // 결과 막대 성장
  easeStandard: 'cubic-bezier(0.2, 0, 0, 1)',
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  pressScale: 0.98,
  optionPressScale: 0.97,
  stagger: '70ms',
  leadBrightness: 1.06, // 1등 막대 강조
  qrDelay: '100ms',
};

export const zIndex = {
  base: 0,
  sticky: 10,
  overlay: 100,
  modal: 200,
  toast: 300,
};
