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

  // 브랜드 자산(로고·그래픽) 재도색 램프. 원본은 색이 16~500개라 그대로 쓰면 팔레트 규칙이 무너진다.
  // 명도만 남기고 색상은 blue 계열 하나로 통일한다. 위계는 명도로만 만든다는 규칙과 같은 근거다.
  // scripts/brand-assets.mjs 가 이 배열만 읽어 SVG 를 다시 칠한다.
  brandRamp: ['#0A2557', '#12408F', '#1F6FFF', '#74A6FF', '#B7CFFF', '#E2ECFF'],

  // 글래스 위에 얹는 반투명 표면. 재질 값이라 alpha 를 포함한다.
  optionFill: 'rgba(255, 255, 255, 0.35)',
  optionBorder: 'rgba(255, 255, 255, 0.5)',
  barTrack: 'rgba(0, 0, 0, 0.08)', // 막대 트랙. fill 보다 확실히 연해야 한다
  // 0.08 은 20m 프로젝터에서 사라졌다. 결과 행 구분선만 진하게 둔다(옵션 목록은 카드로 바뀌어 선이 없다).
  rowLine: 'rgba(0, 0, 0, 0.16)',
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
  // 투표 중(결과 공개 전) 대형화면에 띄우는 선택지. 막대·퍼센트 열이 없어 자리가 남으므로
  // 결과 화면 라벨(screenLabel)보다 훨씬 크게 둔다. 20m 밖에서 먼저 읽는 것이 선택지다.
  screenOption: { size: 'clamp(32px, 4vw, 80px)', weight: 700, leading: 1.25, tracking: '-0.01em' },
  screenOptionKey: { size: 'clamp(24px, 2.4vw, 46px)', weight: 500, leading: 1.2, tracking: '0' },
  cloudWord: { size: 'clamp(22px, 2.2vw, 42px)', weight: 600, leading: 1.2, tracking: '-0.01em' },
  cloudLead: { size: 'clamp(22px, 2.2vw, 42px)', weight: 700, leading: 1.2, tracking: '-0.01em' },
  // 커버(오프닝) 라벨 2행. screenMeta 와 같은 크기 스케일(20m 프로젝터 가독 검증됨), 라벨 톤만 트래킹으로.
  // 1행(한글)은 살짝, 2행(영문 대문자)은 더 넓게. 두 줄이 같은 크기와 색이되 자간으로만 위계를 나눈다.
  screenEyebrow: { size: 'clamp(20px, 1.6vw, 30px)', weight: 600, leading: 1.4, tracking: '0.02em' },
  screenEyebrowWide: { size: 'clamp(20px, 1.6vw, 30px)', weight: 600, leading: 1.4, tracking: '0.05em' },
  // 커버 모듈 태그 2행. "우리는 포럼 전체가 아니라 5모듈"이라는 걸 표시하려고 추가했다.
  // 영어(작고 넓은 트래킹)는 태그, 한글(굵고 좁은 트래킹)은 실제 세션명 강조다. 라벨과 헤드라인처럼 위계를 분리한다.
  screenModuleEn: { size: 'clamp(15px, 1.2vw, 22px)', weight: 600, leading: 1.4, tracking: '0.1em' },
  screenModuleKr: { size: 'clamp(22px, 2vw, 34px)', weight: 700, leading: 1.3, tracking: '-0.01em' },
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
  // Q1 척도 슬라이더. 시각 트랙은 얇게, 히트 영역은 손가락 터치 최소값(touchMin)을 그대로 쓴다.
  sliderTrackHeight: '8px',
  sliderThumbSize: '28px',
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

  // 워드클라우드. 위계는 크기로만 만든다(색·투명도 아님).
  // 크기는 단어 수에 따라 cloudFitWords 기준으로 함께 줄어든다(넘침 방지).
  // 단어가 적을 때 최대치가 화면을 잡아먹었다(1개일 때 154px 칩이 패널 절반을 차지).
  // 칩 여백까지 계산하면 이 정도가 상한이다.
  cloudMin: typography.cloudWord.size,
  cloudMax: 'clamp(46px, 5vw, 96px)',
  cloudGap: 'clamp(10px, 1.2vw, 22px)',
  // 패널 전체 폭을 쓰면 단어가 한 줄로 늘어서 띠가 된다. 구름이 되려면 줄이 여러 개여야 한다.
  // 짧은 화면에서는 폭을 넓혀 줄 수를 줄인다. 줄이 늘면 세로로 넘친다.
  // 칩(글래스 배경)을 입히면서 단어마다 좌우 1.2em, 상하 0.52em 이 더 붙었다.
  // 그만큼 줄이 늘어 9줄까지 가며 세로로 240px 넘쳐서 폭을 넓히고 기준 단어 수를 낮춰 전체를 줄였다.
  cloudWidth: 'min(100%, max(76vh, 58vw))',
  cloudWords: 30, // 상위 N
  cloudLengthRef: 5, // 이 길이를 넘으면 최댓값만 길이에 반비례해 축소
  cloudFitWords: 8, // 이 개수일 때 최대 크기. 더 많으면 전체를 줄여 패널을 넘지 않게 한다
  // 결과 공개 전 선택지 카드. 행 사이 간격과 안쪽 여백.
  optionCardGap: 'clamp(10px, 1.1vw, 20px)',
  optionCardX: 'clamp(20px, 2vw, 40px)',
  optionCardY: 'clamp(12px, 1.2vw, 24px)',

  // 표지 브랜드 자산. 로고·타이틀은 왼쪽 열, 그래픽은 오른쪽 열이다(lg 1024 이상. 미만은 세로 스택).
  // 이 세션은 포럼 전체가 아니라 5모듈 하나라서 로고·타이틀 크기를 줄이고 모듈 태그로 위계를 보완했다.
  coverLogoMax: 'clamp(64px, 6vw, 130px)',
  coverTitleMax: 'min(40vw, 600px)',
  coverGraphicMax: 'min(30%, 420px)',
  coverGraphicMaxH: '78vh',
  // lg 미만(세로 스택)에서 쓰는 그래픽 크기. 가로폭 기준 30% 룰이 스택 레이아웃에서는 의미가 없어
  // 컨테이너 자체 폭 비율로 다시 잡고, 세로는 텍스트 블록이 이미 많은 공간을 쓰므로 훨씬 낮게 둔다.
  coverGraphicMaxSm: 'min(58%, 280px)',
  coverGraphicMaxHSm: '26vh',

  qrRatio: 0.38, // 화면 짧은 변 대비 QR 크기
  // 클로징(홍보) 화면. 로고가 주인공이고 QR 은 보조라 대기 화면 QR 보다 작게 둔다.
  closingLogoMax: 'min(72%, 1180px)',
  // 폭만 제한하면 세로가 짧은 화면에서 로고+QR 합이 패널을 넘는다(1440x900 실측 34px 초과).
  // 백분율은 부모 높이가 확정되지 않아 무시된다. 뷰포트 기준(vh)으로 둔다.
  closingLogoMaxH: '40vh',
  closingQrRatio: 0.62, // 대기 QR 대비 비율
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
