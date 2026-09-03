# DESIGN.md

2026 UIAx한양대 넥스트 임팩트 포럼 제5모듈 실시간 참여형 투표 앱. 청중이 QR로 접속해 투표하고, 결과가 대형화면에 실시간으로 뜨며, 진행자가 어드민에서 질문과 투표를 컨트롤한다.

## 플랫폼 형태 (C형)

세 화면이 성격이 다르다. 하나의 코드베이스에서 라우트로 나눈다.

- **청중 화면 `/vote`** — A형 고정. 폰 세로 기준 390px, 웹에서도 max-width 430px 중앙 정렬. 엄지 하나로 투표하는 화면.
- **대형화면 `/screen`** — B형 반응형. 1920px 기준으로 설계하고 2560, 3840까지 대응. 무대 프로젝터와 대형 모니터에 송출. 멀리서도 읽히게 큰 타이포.
- **어드민 `/admin`** — B형 반응형. 노트북 1280px 기준. 진행자가 무대 뒤에서 조작.

기준 뷰포트: 청중 390px, 대형화면 1920px, 어드민 1280px.

## 색상 팔레트

배경 위에 글래스를 얹는 구조라 색은 최소한만 둔다. 재질이 색을 대신한다.

| 역할 | 토큰 | 값 | 용도 |
|---|---|---|---|
| Ink | `ink` | `#0A0A0A` | **제품 텍스트는 전부 이 색.** 제목, 본문, 보조, 숫자, 키 전부 |
| Ink 2 | `ink2` | `#757575` | **텍스트 금지.** 미선택 테두리 전용 |
| Line | `line` | `#E5E5E5` | **텍스트 금지.** 구분선, disabled 바탕 전용 |
| Blue | `blue` | `#1F6FFF` | 강조, 1등 막대, prominent 틴트, focus 링 |
| Green | `green` | `#16A34A` | 실시간 점(/screen 전용), 어드민 연결됨 |
| Ink Soft | `inkSoft` | `#39404A` | 비1등 결과 막대. 트랙과 명도가 갈려야 길이가 읽힌다 |
| White | `white` | `#FFFFFF` | 글래스 위 반전 텍스트 |

글래스 위에 얹는 반투명 표면은 alpha 를 포함한 재질 값이다. 같은 tokens.colors 에 둔다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `optionFill` | `rgba(255,255,255,0.35)` | 선택지 기본 필 |
| `optionBorder` | `rgba(255,255,255,0.5)` | 선택지 테두리 |
| `barTrack` | `rgba(0,0,0,0.08)` | 결과 막대 트랙 |
| `rowLine` | `rgba(0,0,0,0.08)` | 결과 행 구분선 |

**회색 텍스트를 쓰지 않는다.** 위계는 색이 아니라 크기와 굵기로 만든다. 진행표시, `N표`, `N명 참여`, A/B/C/D 키, 부제, disabled 라벨까지 전부 `ink` 다. 회색은 글래스 위에서 대비가 무너지고 프로젝터에서 사라진다.

대비 검증 대상: 대형화면 결과 패널의 `ink` 텍스트는 글래스 뒤 배경 대비 최소 7:1. 부족하면 `glass.screen.brightness` 를 -0.12 까지 내린다.

## 타이포그래피

시스템 우선 스택. 애플 기기는 SF Pro 가 잡히고, 안드로이드/윈도는 Pretendard Variable(CDN)로 떨어진다.

`-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Apple SD Gothic Neo", "Pretendard Variable", Pretendard, "Segoe UI", sans-serif`

**제목 700, 본문 400~500.** 폰에서는 엄지로 훑고 대형화면에서는 20m 뒤에서 읽는다. 근거리 모니터 기준의 500~600 은 이 제품에 맞지 않아 폐기했다.

한국어 제목은 `text-wrap: balance` 로 줄을 고르게 나눈다(`word-break: keep-all` 과 함께). 본문은 `text-wrap: pretty`.

### 한국어 줄바꿈

`balance` 만으로는 "오늘 세션을 한 / 단어로" 처럼 관형사가 갈린다. `lib/ko-break.js` 가 두 가지를 처리한다.

1. **접착** - 단음절 관형사·수관형사(한 두 세 네 첫 새 그 이 저 온 각 매 여러 모든 어느 무슨 어떤 다른 같은) 뒤 공백을 NBSP 로 바꿔 다음 어절과 붙인다.
2. **수동 마커** - 원문에 ` / ` 가 있으면 그 자리에서 줄을 강제로 나눈다. 실문안이 오면 SOURCE.md 에서 편집자가 직접 지정한다.

질문, 선택지 라벨, 제목은 `<Ko>` 로 감싸 렌더한다. 문자열 처리만 하고 `innerHTML` 을 쓰지 않는다.

### 폰(청중)
| 역할 | size | weight | leading | tracking |
|---|---|---|---|---|
| question | 26px | 700 | 34px | -0.02em |
| option | 16px | 500 | 24px | -0.01em |
| button | 17px | 600 | 24px | -0.01em |
| caption | 13px | 500 | 20px | 0 |

### 어드민
| 역할 | size | weight | leading | tracking |
|---|---|---|---|---|
| title | 20px | 700 | 28px | -0.02em |
| body | 15px | 500 | 22px | -0.01em |

### 대형화면
| 역할 | size | weight | leading | tracking |
|---|---|---|---|---|
| screenQuestion | `clamp(28px, 3.8vw, 56px)` | 700 | 1.12 | -0.02em |
| screenKey | `clamp(16px, 1.5vw, 27px)` | 500 | 1.2 | 0 |
| screenLabel | `clamp(20px, 1.9vw, 34px)` | 600 | 1.25 | -0.01em |
| screenPct | `clamp(26px, 2.6vw, 48px)` | 700 | 1.1 | -0.02em |
| screenVotes | `clamp(14px, 1.3vw, 22px)` | 500 | 1.3 | 0 |
| screenMeta | `clamp(14px, 1.3vw, 20px)` | 500 | 1.4 | 0 |

전역으로 `word-break: keep-all` 을 걸어 한글 단어 중간 줄바꿈을 막는다. 숫자는 전부 `tabular-nums`.

## 정렬

**앱 표면은 전부 왼쪽(start).** 질문, 선택지, 완료 문구, 차트, 어드민, 버튼까지 예외 없다. 규칙이 하나여야 지켜진다.

**패널 콘텐츠** 이야기다. 예외는 셋.
- **캡슐 CTA 라벨은 가운데.** 버튼은 콘텐츠가 아니라 하나의 오브젝트다. 왼쪽에 붙이면 캡슐 안에서 떠 보인다.
- QR 플레이트: 오브젝트라 패널 가운데에 놓는다.
- `/screen` 실시간 점: 질문 줄 오른쪽 끝에 놓는다.

## 간격

8pt 기반: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64. 값이 같아도 역할이 다르면 이름을 따로 둔다: `panel` 20, `optionX` 18, `radio` 14, `sub` 10.

청중 화면 터치 타깃 최소 44px. 투표 선택지 버튼 높이 최소 56px(엄지 조작 여유), 캡슐 CTA 높이 54px.

### 행간

| 자리 | 값 |
|---|---|
| 폰 질문 26px | **1.4** (36px). 한글 볼드 2줄은 1.31 이면 답답하다 |
| 대형화면 질문 | **1.22**. 한글 볼드 디스플레이는 1.2 미만으로 내리지 않는다 |
| 본문 | 1.5 전후 |

### /vote 세로 리듬

| 구간 | 값 | 토큰 |
|---|---|---|
| 진행표시(13/20) → 질문 | 12px | `spacing.md` |
| 질문 | 26 / 36, 700 | `typography.question` |
| 질문 → 옵션 목록 | 20px | `spacing.panel` |
| 옵션 사이 | 12px | `spacing.md` |
| 옵션 안쪽 좌우 | 18px | `spacing.optionX` |
| 라디오 원 ↔ 라벨 | 14px | `spacing.radio` |
| 옵션 높이 | 56px | `layout.optionMinHeight` |
| 패널 안쪽 | 20px | `spacing.panel` |
| 패널 → CTA | 20px | `spacing.panel` |
| CTA | 높이 54, 17/24, 가운데 | `layout.buttonMinHeight` |
| 제목 → 부제 | 10px | `spacing.sub` |

## 브레이크포인트

xs 320 / sm 390 / md 768 / lg 1024 / xl 1280 / 2xl 1440 / 3xl 1920 / 4xl 2560 / 5xl 3840.

크기 변화는 clamp/minmax로 유동 처리하고, 브레이크포인트는 구조 변화(열 수, 막대 배치)에만 쓴다. 대형화면 3840에서 여백 과다가 없도록 콘텐츠 최대폭과 스케일을 함께 키운다.

## 글래스 재질

엔진은 `@ybouane/liquidglass`. 글래스 요소마다 `<canvas z-index:-1>` 을 첫 자식으로 꽂고 뒤 배경을 굴절시킨다. 텍스트는 DOM 그대로 캔버스 위에 뜬다.

**구조 제약: 글래스 요소는 GlassRoot 의 직계 자식이어야 한다.** 중간 래퍼를 끼우면 라이브러리가 경고 후 건너뛴다. root 의 non-glass 자식은 배경 `<img>` 하나뿐이다.

프리셋은 `tokens.glass`. 키 이름은 라이브러리 GlassConfig 와 1:1.

| variant | Cheatsheet 대응 | 용도 |
|---|---|---|
| `regular` | `.regular` | 기본 패널, 기본 버튼 |
| `clear` | `.clear` | 예약(현재 미사용) |
| `prominent` | `.glassProminent` + `.tint(.blue)` | 주요 버튼, 켜진 토글 |
| `screen` | 없음(자체) | 대형화면 결과 패널. 20m 가독성용으로 blur 높이고 살짝 어둡게 |

폴백: WebGL 불가, `prefers-reduced-transparency: reduce`, `prefers-reduced-motion: reduce` 중 하나라도 걸리면 root 가 `data-glass-mode="css"` 로 떨어지고 `backdrop-filter` 기반 CSS 글래스가 대신 그린다.

### 재질 사용 조건

AGENTS.md 1절과 같은 내용이다. 셋 다 지켜질 때만 글래스를 쓴다.

1. 글래스 위 콘텐츠는 DOM 텍스트와 컨트롤이며 굴절 대상이 아니다. 글자 뒤가 굴절되지 않는다.
2. WebGL 불가 또는 `prefers-reduced-transparency` 시 CSS 글래스로 폴백해야 한다.
3. 한 화면의 읽기 부하는 질문 1개 + 선택지 수준을 넘지 않는다. 긴 본문 화면이 생기면 그 화면만 글래스를 쓰지 않는다.

## 배경

사진을 배경으로 쓰지 않는다. 자연사진과 인물사진 모두 금지. 배경은 `scripts/make-bg.mjs` 가 `tokens.ambient` 만 읽어 생성하는 색면이다.

2560x1440, 바탕 위에 blur 처리한 타원 4개(blue 2, 웜 뉴트럴 1, 쿨 뉴트럴 1)와 밴딩 방지용 미세 노이즈 한 겹. 표면별로 대비가 다르다. `/vote` 가 가장 밝고 대비가 낮으며, `/screen` 은 20m 가독성 때문에 바탕을 낮춘다.

SVG 를 소스로 두고 WebP 로 래스터화해 `GlassRoot` 에 넘긴다(drawImage 안정성). 산출물은 커밋하고 빌드 때 재생성하지 않는다.

## radius

역할 기반 단일 스케일. 값은 `tokens.radius` 하나에서만 나온다. 하드코딩 금지.

| 토큰 | 값 | 용도 |
|---|---|---|
| `bar` | 6px | 결과 막대. 20m 거리에서 2px 은 각져 보인다 |
| `sm` | 12px | 개발 도구 전용(DevControlPanel, /preview). 앱 표면 미사용 |
| `md` | 16px | 옵션 버튼, 주관식 인풋, 어드민 질문 버튼 |
| `lg` | 24px | QR 플레이트 |
| `pill` | 26px | 캡슐 버튼. 높이 52 의 정확히 절반 |
| `xl` | 36px | 1차 글래스 패널(/vote 질문, /admin 패널, 랜딩, 오프라인, 404) |
| `screen` | 32px | 대형화면 결과 패널 |
| `full` | 9999px | 원형 도형(라디오, 실시간 점, 완료 점) |

`pill` 을 9999 로 두지 않는 이유: 글래스 셰이더가 `cornerRadius` 를 클램프 없이 uniform 으로 그대로 넘긴다(`GlassRenderer.ts:262`). 버튼 높이 52 의 절반인 26 이 기하학적으로 완전한 캡슐이면서 셰이더도 깨지지 않는다.

### concentric radius

중첩할 때 **바깥 radius = 안쪽 radius + 그 사이 padding** 을 지킨다.

- 1차 글래스 패널 `xl(36)` + padding `spacing.panel(20)` + 내부 요소 `md(16)` → **36 = 16 + 20**. 성립.
- 1차 패널의 padding 은 전부 `spacing.panel`(20) 로 통일한다. 둥근 자식이 없는 패널(랜딩, 오프라인, 404)도 같은 값을 쓴다.
- **concentric 이 안 맞으면 바깥 radius 를 올린다. padding 을 깎지 마라.** 수식은 맞고 숨 쉴 공간이 죽는 방식으로 고치면 규칙이 디자인을 이긴다. 1차 패널이 28/12 였던 시기가 그 실패 사례다.
- 자식이 모서리에 인접하지 않으면(결과 막대, QR 플레이트처럼 가운데 놓이는 것) concentric 은 적용되지 않는다.
- 자식이 사각형(반지름 0)이면 바깥 radius 가 padding 이하이기만 하면 된다. QR 플레이트 `lg(24)` + padding 32 + 사각 QR → 성립.

## 컴포넌트 스타일

- **투표 선택지(청중)** - 높이 56px 이상, radius `md`. 미선택 `optionFill` + `optionBorder` 1px. 선택 시 `ink` 필 + `white` 글자. 왼쪽 20px 원이 라디오, 선택 시 흰 점이 scale-in. 아이콘이 아니라 순수 CSS 원.
- **글래스 버튼** - 높이 52px 이상, radius `pill`(=높이의 절반), 17/24 weight 600, 텍스트 왼쪽. hover 밝아짐과 press 눌림은 라이브러리가 낸다.
  - prominent: 바탕을 **solid `blue`** 로 채우고 흰 글자. 반투명 틴트는 뒤 배경에 따라 대비가 흔들려서 쓰지 않는다. 글래스는 가장자리 하이라이트와 press 만 담당한다.
  - disabled: **opacity 를 쓰지 않는다.** `line` 바탕 + `ink` 글자(대비 15.7:1). 비활성이어도 무슨 버튼인지 항상 읽혀야 한다.
  - 라벨은 항상 `<span class="glass-btn-label">` 로 감싼다. 맨 텍스트 노드는 z-index 를 못 받아 불투명 틴트 아래로 깔린다.
- **결과 차트(대형화면)** - 차트 전체가 **단일 그리드** `auto max-content 1fr auto` (키 / 라벨 / 막대 / 값), column-gap `clamp(20px,2vw,36px)`. 각 행 래퍼는 `display: contents` 라 셀이 부모 그리드에 직접 들어간다.
  - 라벨 열이 `max-content` 이고 전 행이 공유하므로 **막대 시작 x 가 모든 행에서 같다.** 가장 긴 라벨 뒤에만 gap 이 붙는다. 행마다 독립 그리드를 쓰면 시작점이 어긋난다.
  - **대신 선택지 문구를 짧게 쓴다.** 가장 긴 라벨이 열 폭을 정한다.
  - 색: 트랙 `barTrack`(연회색), 비1등 `inkSoft`(진회색), 1등 `blue`. **1등은 채도로, 막대는 명도로 구분한다.** 비1등과 트랙이 같은 색이면 막대 길이를 못 읽는다.
  - 키(A/B/C/D)는 라벨과 별도 노드. `screenKey`, `ink2`. 라벨은 `screenLabel`, `ink`.
  - 값은 `%`(`screenPct`, `ink`)와 `N표`(`screenVotes`, `ink2`)를 baseline 정렬로 띄워 둔다. 간격 `clamp(12px,1vw,18px)`. 둘 다 tabular-nums.
  - 막대 높이 `clamp(28px,2.8vw,56px)`, radius `bar(6)`. 성장은 `transform: scaleX`.
  - **패널이 화면을 채운다.** 결과 패널은 프레임 세로의 78% 이상(실측 91%). 내부는 flex column 으로 질문 / 차트(flex 1) / 참여 수. 행 높이는 `clamp(64px,7vw,110px)` ~ `clamp(120px,14vw,220px)` 사이에서 행 수에 따라 늘어나고, 최대를 넘으면 세로 가운데 정렬한다. 행이 2개든 6개든 패널이 비지 않는다.
  - 질문 크기는 줄이지 않는다. 비율은 행을 키워서 맞춘다.
- **어드민** - 패널과 컨트롤 버튼 모두 GlassRoot 직계 자식. 768 미만에서 1열로 접힌다.

## 아이콘, 일러스트

**아이콘 금지.** lucide 를 포함해 어떤 아이콘도 쓰지 않는다. 체크, 번개, 마크, 로고, 이모지 전부 없음. 상태는 글래스 밝기와 틴트, 그리고 텍스트로만 전달한다. 예외는 의미를 담지 않는 순수 도형(라디오 원, 실시간 점)뿐이다.

**일러스트 금지.** unDraw 를 포함해 장식 이미지를 넣지 않는다. 배경 이미지는 글래스가 굴절할 대상이지 장식이 아니다.

가운데점(·)과 설명 문구, 자기소개 텍스트를 넣지 않는다. 화면에는 사용자가 지금 필요한 것만 둔다.

## 라이팅

존댓말 구어체(~해요). 확정 문구는 다음과 같다.

| 자리 | 문구 |
|---|---|
| 대기 힌트 | 곧 선택할 수 있어요 |
| 제출 버튼 | 투표하기 |
| 완료 제목 | 투표했어요 |
| 완료 설명 | 결과는 앞 화면에서 함께 봐요 |
| 중복 투표 | 이미 투표했어요 |
| 투표 불가 | 지금은 투표할 수 없어요 |
| 진행 표시 | 2 / 5 |
| 대형화면 총계 | 128명 참여 |

## z-index 위계표

| 레이어 | 값 | 용도 |
|---|---|---|
| base | 0 | 일반 콘텐츠 |
| sticky | 10 | 상단 상태바, 하단 고정 투표 버튼 |
| overlay | 100 | 딤 배경 |
| modal | 200 | 바텀시트, 다이얼로그 |
| toast | 300 | 투표 완료 토스트, 오류 알림 |

## 모션 토큰

`transform` 과 `opacity` 만 쓴다. layout/paint 유발 속성 금지. hover scale 금지, press 0.98 허용.

| 토큰 | 값 | 용도 |
|---|---|---|
| dur-fast | 120ms | press 피드백 |
| dur-base | 320ms | 패널 내용 전환 |
| dur-slow | 700ms | 결과 막대 성장 |
| ease-standard | cubic-bezier(0.2, 0, 0, 1) | 반복 애니메이션 |
| ease-out | cubic-bezier(0.16, 1, 0.3, 1) | 등장, 전환 |
| stagger | 70ms | 막대 행 간 지연 |

패널 내용 전환은 opacity + translateY(6px). 막대는 scaleX 로 행마다 70ms 씩 밀려 들어온다.

`prefers-reduced-motion` 시 애니메이션을 즉시 표시로 대체하고, 글래스도 CSS 폴백으로 내린다. `prefers-reduced-transparency`, `prefers-contrast` 대응 필수.

## 실시간 특유 상태 표시

- 연결 상태 인디케이터는 **어드민에만** 둔다. 점 + 텍스트(연결됨 / 다시 연결 중 / 끊김).
- 청중 화면과 대형화면에는 배지를 두지 않는다. 화면에 필요한 것만 남기는 규칙이 우선한다.
- 대형화면은 우상단 초록 점 하나로 라이브임을 알린다. 텍스트 없음.
- 수신이 끊겨도 대형화면은 마지막 결과를 유지한다. 조용히 실패하지 않되, 청중에게는 제출 시점에 인라인 문구로만 알린다.
