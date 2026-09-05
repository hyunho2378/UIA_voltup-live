# PROGRESS.md

프로젝트: voltup-live (제5모듈 실시간 참여형 투표 앱)

## 완료
- 부트스트랩 문서 세트 확정: DESIGN / IA / COMPONENTS / PATTERNS / ROUTES / tokens.js / SESSION_HEADER
- SETUP 실행: client 구조, Vite+Tailwind(토큰 override), vercel.json, .env.example, 라우트 자리표시. build 통과, 금지 항목 grep 0건
- Supabase 배선 작성: supabase/migrations 0001~0003 + seed + _ALL.sql, lib/supabase.js 실장, .env 정리, SUPABASE.md 작성
- Liquid Glass 전환: tokens.js 재정의(ink/blue 팔레트 + glass 프리셋 + radius), tailwind override 갱신, index.css 글래스 시스템, components/glass 3종, /vote /screen /admin /landing /login /offline /404 전면 재작성, DESIGN.md 동기화
- Supabase 키 이름 교정: anon → publishable, service_role → secret (.env, .env.example, lib/supabase.js, SUPABASE.md)
- liquidglass vendored (dist 1.0.3). npm 의존성과 .npmrc ignore-scripts 제거, 설치 결정론 확보
- ambient 배경 전환: 사진 삭제, scripts/make-bg.mjs 가 tokens.ambient 만 읽어 SVG + 2560x1440 WebP 생성(`npm run bg`)
- AGENTS.md 1절 글래스 조항 교정 + DESIGN.md "재질 사용 조건", "배경" 절 추가
- 크리틱 2차: CTA 라벨 z-index 버그 수정(텍스트 노드 → span), 차트 단일 grid + display:contents 로 막대 시작 정렬, 비1등 막대 inkSoft, 제품 텍스트 회색 전면 폐지(ink 단일), 한국어 관형사 접착(ko-break), 마감 상태 폐지(대기와 통합)
- 여백·행간 복원: 1차 패널 padding 12 → 20 + radius xl 28 → 36 으로 concentric 유지, /vote 세로 리듬 토큰화, 폰 질문 행간 1.4 / 대형 질문 1.22, CTA 라벨 center 복귀, 대형화면 막대 54px·N명 참여 30px
- 디자인 크리틱 1차 반영: prominent 버튼 solid blue, disabled 대비 5.5:1(opacity 폐기), 제목 700, text-wrap balance, 정렬 전부 왼쪽, 불필요 문구·/vote 초록점 삭제, 대형화면 차트 재설계(라벨 max-content + 패널 세로 91% 채움)
- radius 감사·통일: 역할 기반 단일 스케일(bar 6 / sm 12 / md 16 / lg 24 / pill 26 / xl 28 / screen 32 / full)로 수렴. concentric 강제(1차 패널 padding 12 통일). DESIGN.md 동시 갱신
- /preview 갤러리(DEV 전용): 20개 화면 상태를 목업으로 한 페이지에 렌더. Supabase 요청 0
- 화면 컴포넌트 View/컨테이너 분리: VoteView, ScreenView, AdminView, LandingView 를 순수 props 로 빼고 실시간 경로는 컨테이너가 담당
- 샘플 질문 세트 src/mock/sample-questions.js (객관식 4 + 주관식 2, 목업 집계 포함). seed 의 [더미] 와 별개
- 마이크로인터랙션 보강: press in 120 / out 260 분리, 패널 전환 220ms 키 기반 재생, 1등 막대 brightness 1.06, 완료 점 pop, QR 플레이트 상승 + 캔버스 100ms 지연
- 개발 전용 제어 패널: DevControlPanel + vite dev 미들웨어 `/__dev__/session-control`. 제어 로직은 api/_lib/session-actions.js 로 추출해 프로덕션 경로와 공유
- 어드민 인증·세션 제어 serverless 구현: client/api/{admin-login,admin-session,session-control}.js + _lib/auth.js(HMAC httpOnly 쿠키), RequireAdmin 실검증, /admin 버튼 전면 배선, /screen standby QR
- 방어 코드 작성: 0004 broadcast 쓰로틀(질문당 250ms 병합 + flush_results), client eventsPerSecond 10, close_voting 시 최종 집계 확정 발사
- sessions 구독을 SessionProvider 하나로 통합. 라우트별 중복 채널 3개 → 1개
- /offline 자동 전환(연결 8초 이상 끊기면 전환, 복구 시 자동 복귀)
- 부하 테스트 하네스: client/loadtest/{vote-storm.mjs,run.sh,README.md}
- 결과 정합성 수정: 질문 전환 시 /screen 결과 즉시 비움 + broadcast/fetch 에 question_id 가드. 이전 질문 막대가 남던 원인 제거
- 투표 초기화 추가(어드민 '이 질문 초기화' 즉시 / '전체 초기화' 2단 확인). 서버 secret 키 경로에서 votes 삭제 후 flush_results 로 화면 0 확정
- 외부 도구 전환 경로 제거(0006). status CHECK 는 다시 (standby, live, ended)

## 진행 중
- **배포 준비 완료, 실키 미투입.** 리포는 커밋 가능 상태. 실키는 client/.env 에만 있고 커밋되지 않는다.
  다음: GitHub push → Vercel import(Root=client) → 환경변수 8개 투입 → Redeploy → 스모크 → 양방향 라이브 검증.
- Vercel 환경변수 입력 대기(사람 몫): ADMIN_PASSCODE, ADMIN_COOKIE_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY.
- /preview 와 DevControlPanel 은 DEV 전용이라 별도 제거 작업이 없다. RLS 를 푸는 dev 정책(0006)은 만들지 않았으므로 행사 전 되돌릴 DB 변경도 없다.
- 마이그레이션 0001~0005 적용 완료(2026-09-02). flush_results 204 실측 확인.
- **0006_remove_backup.sql 은 사람이 Supabase SQL Editor 에서 Run 해야 한다(미적용).** 비파괴 — status 값 정리 + CHECK 축소만.
- 결과 정합성 실측(2026-09-05, 로컬 dev + 프로덕션 DB): 질문 전환 중 218 샘플에서 "다른 질문 막대" 0건.
  다만 구버전으로 되돌려 같은 시퀀스를 돌려도 0건이었다. set_question 이 results_visible=false 로 내리기 때문에
  fetch 대기 구간이 가려진다. 코드상 결함(state 미초기화 + question_id 가드 없음)은 실재하지만
  화면에 보이는 증상의 원인은 아니었다. 실제 원인은 남아 있던 votes 7행(아래).
- 리허설 잔여 투표 실측: 검증 시작 시점 프로덕션에 votes 7행(Q1 3 / Q2 2 / Q3 2)이 남아 있었다.
  "투표 안 했는데 결과가 나온다"의 실제 원인. 초기화 기능으로 제거했고 검증 후 votes 0 / standby 로 복구.
- Supabase 스키마·시드 적용 완료 확인(2026-09-02). sessions/questions/options/votes, RLS, get_results, 중복 차단 전부 실측 통과.

## 다음 작업 (순서)
1. VITE_VOTE_SHORT_URL 확정 후 .env 와 Vercel 에 입력. 실기기 QR 스캔 1회.
2. 배포 후 전 화면 재검증, 반응형 전 구간, 금지 항목 grep.
3. 리허설 3회, 장애 대체안(short URL, offline 화면) 점검.
4. 배포 실주소로 부하 스윕 1회 재측정(로컬 단일 IP 측정과 다를 수 있음).

## 부하 실측 (2026-09-02)

### 쓰로틀 검증 (0004 적용 후)

- 단건 투표 → broadcast 1회. 3회 반복 모두 동일.
- 250ms 안에 2건 → **broadcast 1회로 병합**. 초당 최대 1.
- `close_voting` → `final:true` 집계가 한 번 더 도착. 병합으로 스킵됐던 2번째 투표까지 최종 집계에 반영됨(지역사회 1, 글로벌 1).
- 쓰로틀 전 실측은 n=20 / 1초 버스트에서 초당 **18**이었다. 적용 후 전 구간 **4** 고정(250ms 병합의 이론 상한과 일치).

### 스윕 (worst case: 클라이언트당 session + results 2채널)

| N | 채널 SUBSCRIBED | 조인 시간 | INSERT | p95 | 초당 broadcast 최대 | 첫 에러 |
|---|---|---|---|---|---|---|
| 50 | 100/100 (100%) | 801ms | 50/50 (100%) | 111ms | 4 | 없음 |
| 100 | 200/200 (100%) | 1197ms | 100/100 (100%) | 110ms | 4 | 없음 |
| 150 | 300/300 (100%) | 2212ms | 150/150 (100%) | 108ms | 4 | 없음 |
| 200 | 400/400 (100%) | 3054ms | 200/200 (100%) | 107ms | 4 | 없음 |
| 250 | 500/500 (100%) | 3752ms | 250/250 (100%) | 116ms | 4 | 없음 |
| 300 | 600/600 (100%) | 3951ms | 300/300 (100%) | 173ms | 4 | 없음 |
| 350 | 700/700 (100%) | **10040ms** | 350/350 (100%) | 160ms | 4 | 없음(조인 지연 급증) |
| **400** | 636/800 (79.5%) | 15169ms(타임아웃) | 400/400 (100%) | 213ms | 4 | **ConnectionRateLimitReached x8**, transport failure x84, CHANNEL_ERROR x92, TIMED_OUT x88 |

### 스윕 (실제 청중 조건: 클라이언트당 1채널. SessionProvider 통합 후 /vote 가 실제로 여는 수)

| N | 채널 | 조인 시간 | INSERT | 첫 에러 |
|---|---|---|---|---|
| 350 | 350/350 (100%) | 5145ms | 350/350 (100%) | 없음 |
| 500 | 397/500 (79.4%) | 15158ms(타임아웃) | 500/500 (100%) | **ConnectionRateLimitReached x42**, TIMED_OUT x103, CHANNEL_ERROR x42 |

### 결론

- **첫 에러 N = 400** (에러 종류: `ConnectionRateLimitReached: Too many connected users`). 채널 수가 아니라 **동시 연결 수**가 병목이다. 1채널 조건에서도 약 400에서 같은 에러가 났다.
- **행사 안전선 = 400 x 0.7 = 280명.**
- 다만 조인 시간이 300명(3.9초) → 350명(10.0초)에서 급격히 나빠진다. 청중이 QR 찍고 10초를 기다리는 상황을 피하려면 **체감 안전선은 300명**으로 본다.
- `tenant_events`(초당 메시지) 에러는 전 구간 0건. 0004 쓰로틀이 broadcast 를 4/s 로 묶어둔 덕분이다. 쓰로틀 없이 150명이면 약 50/s 였을 것이다.
- **INSERT 는 500명에서도 100% 성공.** PostgREST 경로는 실시간 한도와 무관하다. 즉 과부하 상황에서도 투표 자체는 들어가고, 대형화면 실시간 갱신만 나빠진다. /screen 은 진입·재연결 시 RPC 로 보정하므로 복구된다.

측정 조건: Node 단일 프로세스, 단일 IP, 로컬 네트워크. 실제 청중은 서로 다른 IP와 모바일 회선에서 붙고 각자 SPA 자산도 받으므로 이 숫자가 그대로 재현된다는 보장은 없다. 무료 티어 문서상 동시 연결 한도는 200인데 실측은 약 400이었다.

## radius 규칙 (2026-09-03 감사 확정)

| 토큰 | 값 | 용도 |
|---|---|---|
| `bar` | 6px | 결과 막대 (2px 은 20m 에서 각져 보여 상향) |
| `sm` | 12px | 개발 도구 전용. 앱 표면 미사용 |
| `md` | 16px | 옵션 버튼, 주관식 인풋, 어드민 질문 버튼 |
| `lg` | 24px | QR 플레이트 |
| `pill` | 27px | 캡슐 버튼 (높이 54 의 절반) |
| `xl` | 36px | 1차 글래스 패널 |
| `screen` | 32px | 대형화면 결과 패널 |
| `full` | 9999px | 원형 도형 |

- **1차 글래스 패널의 padding 은 `spacing.panel`(20), radius 는 `xl`(36).** 36 = 16 + 20 이라 concentric 이 성립한다.
- **concentric 이 안 맞으면 바깥 radius 를 올린다. padding 을 깎지 마라.** 12 로 눌렀던 시기가 실패 사례다.
- `pill` 을 9999 로 두지 않는다. 글래스 셰이더가 `cornerRadius` 를 클램프 없이 넘긴다(GlassRenderer.ts:262).
- tailwind `borderRadius` 는 `tokens.radius` 를 그대로 펼친다. 키와 값이 1:1 로 일치하는지가 검증 항목이다.

## /preview 갤러리에 담긴 상태 (18)

- 청중 /vote (7): 대기 / 투표 미선택 / 투표 선택됨 / 완료 / 이미 투표함 / 주관식 입력 / 주관식 제출완료
- 대형화면 /screen (5): 대기 QR / 결과 객관식 박빙 / 결과 객관식 압도적 1등 / 결과 주관식 빈도 / 결과 미공개 질문만
- 어드민 (4): 로그인 / 제어 연결됨 / 제어 다시 연결 중 / 제어 끊김
- 랜딩 (2): 진행 중 / 종료

재질은 CSS 글래스로 고정한다. 패널 18개에 WebGL 컨텍스트를 각각 열면 브라우저 한도(약 16)를 넘겨 오래된 것부터 죽는다.
실제 WebGL 재질은 /vote /screen /admin 실 라우트에서 본다.

/preview 는 넓은 화면에서 보는 도구다. 프레임이 축소 고정이라 좁은 폭에서는 리플로우하지 않는다.

## 미확정 / 대기
- 실제 질문 문안: 9/9~9/10 확정 예정. 지금은 seed 의 [더미] 와 mock/sample-questions.js 샘플로 개발. 확정되면 SOURCE.md 원문 그대로 시드하고 샘플도 교체.
- 루트에 skills-main(Emil apple-design/improve-animations), make-interfaces-feel-better-main 이 없다(zip 도 없음). 모션 작업은 프롬프트에 적힌 항목과 LiquidGlassCheatsheet 기준으로만 반영했다.
- 배경은 코드 생성 ambient(webp). 색을 바꾸려면 tokens.ambient 를 고치고 `npm run bg` 를 다시 돌린다. 사진은 쓰지 않는다.
- 로컬 client/.env 의 ADMIN_PASSCODE 와 ADMIN_COOKIE_SECRET 은 개발용 임시값이다. 문서에 값을 적지 않는다. 배포값은 Vercel 환경변수로 따로 넣는다.
- 부하 테스트는 별도 테스트 Supabase 프로젝트가 없어 프로덕션 프로젝트를 쓴다. 리허설 시간대에만 돌린다. 끝나면 투표 삭제와 standby 복구를 반드시 확인한다.
- `vercel dev` 는 Vercel 로그인이 필요하다(현재 로그아웃 상태). 로그인 후 `npm run dev:api`.
- SESSION_HEADER.md가 참조하는 .claude/skills/fullstack-product-setup/SKILL.md 미존재.
- submitVote 코드 실측: 중복 = 23505(HTTP 409) → "이미 투표했어요", 투표 닫힘 = 42501(HTTP 401) → "지금은 투표할 수 없어요". 둘 다 화면 문구까지 확인함.
- 배포 도메인 미정. Supabase 키는 client/.env 에 주입 완료.
- 주관식(text) 결과는 워드클라우드가 아니라 빈도순 막대로 그린다. COMPONENTS.md 의 WordCloud 는 미구현.
- Lighthouse 모바일 성능 /vote = 85 (사진 배경 시점 측정). ambient webp(20KB대)로 바뀌어 더 올랐을 가능성이 있으나 재측정 안 함.

## 데이터 무결성 주의
- 확정된 질문 문안이 오면 SOURCE.md에 원문 그대로 넣고 문자 단위로 시드. 윤문 금지.
