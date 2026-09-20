# PROGRESS.md

프로젝트: voltup-live (제5모듈 실시간 참여형 투표 앱)

## 행사 당일 화면 순서 (운영자용, 2026-09-20 기준)

**링크(`https://uia-vote.vercel.app/`)를 열면 표지가 뜬다. QR 이 아니다.** 우측 하단 "메뉴" 로 관리자에 들어가고,
**관리자에서 "QR 열기" 를 눌러야** 대형화면이 QR 로 바뀐다. 청중은 그 QR 로만 들어온다.
이후 질문 1 → 2 → 3 → 4 순으로 진행한다. 각 질문은 "투표 열기" 로 받고 "결과 공개" 로 띄운다
(결과 공개를 누르는 순간 집계가 확정 전송되므로 숫자가 정확해진다). **4번은 주관식이라 "워드클라우드" 버튼으로
전환**해 띄운다. 교수님 마무리 뒤에는 **"클로징 화면"** 을 눌러 2026 세계경주포럼 홍보와 참가등록 QR 을 띄운다.
표지로 되돌리려면 "표지 화면", 전부 지우려면 "전체 초기화"(표지로 돌아간다). 프로젝터에 띄운 뒤 **F 키** 를
누르면 전체화면이 되고 메뉴 버튼이 사라진다(다시 F 또는 ESC 로 해제).

## 현재 상태 요약 (2026-09-20 전수 재검증 기준)

**기능은 전부 들어가 있고 실제 구동으로 검증됐다. 행사 투입 가능 상태다.** 청중(`/vote`)·대형화면(`/screen`)·어드민(`/admin`)
세 화면이 Supabase Realtime 으로 묶여 있고, 대형화면은 커버(오프닝)·대기(QR)·진행·결과(막대/워드클라우드)·종료
다섯 상태를 어드민 버튼으로 전부 수동 제어한다. 전환은 전부 새로고침 없이 700ms 안쪽에 반영된다(실측).
전체 사이클(대기→커버→질문→투표→결과→마감→주관식→워드클라우드→초기화→종료→복귀) 7단계 검증 전부 PASS,
동시 투표 유실 0·중복 0, 콘솔 에러 0, 가로 스크롤 0, 금지 항목 grep 0건이다. DB 마이그레이션은 0008까지
프로덕션에 적용 완료라 따로 할 일이 없다.

**사람이 해야 할 일은 두 가지다.** (1) **Supabase 쿼터**. 09-02 부하 스윕(동시 연결 398/200)으로 유예 중이며
10-04 전까지 스윕을 다시 돌리지만 않으면 09-28 새 청구 주기에 저절로 해제된다. 단 **행사 당일 동시 접속이
200명을 넘으면 같은 초과가 재발해 요청이 402 로 떨어진다.** 예상 인원이 200 을 넘으면 행사 달만 Pro(월 $25)로
올려야 한다. (2) **실문안 시드**. 현재 질문은 전부 `[더미]` 접두사 더미다. 확정 문안이 나오면 SOURCE.md 에
원문 그대로 넣고 시드해야 한다. 그 외에 미구현 기능은 없다.

참고: 이 대화에서 한때 거론된 **화면 간 이동 FAB(NavFab)와 F키 전체화면은 구현된 적이 없다**(코드·문서 grep 0건).
IA.md · ROUTES.md 가 "세 화면은 서로 이동하지 않는다"를 명시한 설계라 의도된 미구현이다. 필요하면 별도 결정이 필요하다.

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
- 실시간 정합성 자동 검증 하네스 client/loadtest/verify.mjs (7케이스, 연결 9개 미만). 판단은 앱과 같은 함수를
  import 해서 태운다: src/lib/screen-state.js 의 acceptsBroadcast/visibleResults, api/_lib/session-actions.js
- 하네스가 찾은 실결함 수정: show_results 도 flush_results 를 쏜다. 250ms 병합 때문에 마지막 표들이
  broadcast 되지 않은 채 남아, 투표를 닫지 않고 결과를 공개하면 화면이 실제보다 적게 나왔다(실측 3표 → 1표 표시)
- vote-storm.mjs 에 SIGINT/SIGTERM/uncaughtException 정리 경로 추가. 중단 시 N개 소켓이 서버 타임아웃까지 남던 문제
- 주관식 결과 워드클라우드 뷰 + 어드민 토글(0007 results_view). 막대와 같은 글래스 패널·같은 여백·같은 폰트를
  쓰고 막대가 있던 자리만 바꾼다. 배경/캔버스/라이브러리 없이 DOM 텍스트 + sqrt 크기매핑 + flex 중앙배치
- 0007 미적용 DB 배포 가드: results_view 컬럼이 없으면 그 필드만 빼고 재시도한다. 코드가 마이그레이션보다
  먼저 올라가도 질문 전환 같은 기본 제어가 죽지 않는다(가드 없을 땐 set_question 이 500 이었다)
- **0007_results_view 프로덕션 DB 적용 완료(2026-09-19).** Supabase SQL Editor 에서 Run, `Success. No rows returned`.
  `sessions.results_view` 기본값 `bars` 확인. 워드클라우드 토글이 실 DB 에서 동작한다
- **재연결 보정 2건 추가(2026-09-19, 시뮬레이션이 찾은 실결함).** 소켓이 끊긴 구간의 변경은 재조인해도 다시 오지 않는다.
  `session-context.jsx` 는 두 번째 이후 SUBSCRIBED 에서 `fetchSession`, `Screen.jsx` 는 같은 조건에서 `fetchResults`+`fetchLiveCount` 를 다시 읽는다
- **시뮬레이션 잔여 3건 수정(2026-09-19).** 어드민 "세션 종료" 버튼(2단 확인), 어드민 응답 수 실시간화(results 채널 구독),
  결과 강조를 "단독 1등"일 때만으로 변경(동점·0표는 blue 0개). 상세는 아래 "시뮬레이션 잔여 결함 수정" 절.

## 진행 중
- **배포 준비 완료, 실키 미투입.** 리포는 커밋 가능 상태. 실키는 client/.env 에만 있고 커밋되지 않는다.
  다음: GitHub push → Vercel import(Root=client) → 환경변수 8개 투입 → Redeploy → 스모크 → 양방향 라이브 검증.
- Vercel 환경변수 입력 대기(사람 몫): ADMIN_PASSCODE, ADMIN_COOKIE_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY.
- /preview 와 DevControlPanel 은 DEV 전용이라 별도 제거 작업이 없다. RLS 를 푸는 dev 정책(0006)은 만들지 않았으므로 행사 전 되돌릴 DB 변경도 없다.
- 마이그레이션 0001~0005 적용 완료(2026-09-02). flush_results 204 실측 확인.
- **0006_remove_backup.sql 은 사람이 Supabase SQL Editor 에서 Run 해야 한다(미적용).** 비파괴. status 값 정리 + CHECK 축소만.
- 결과 정합성 실측(2026-09-05, 로컬 dev + 프로덕션 DB): 질문 전환 중 218 샘플에서 "다른 질문 막대" 0건.
  다만 구버전으로 되돌려 같은 시퀀스를 돌려도 0건이었다. set_question 이 results_visible=false 로 내리기 때문에
  fetch 대기 구간이 가려진다. 코드상 결함(state 미초기화 + question_id 가드 없음)은 실재하지만
  화면에 보이는 증상의 원인은 아니었다. 실제 원인은 남아 있던 votes 7행(아래).
- 리허설 잔여 투표 실측: 검증 시작 시점 프로덕션에 votes 7행(Q1 3 / Q2 2 / Q3 2)이 남아 있었다.
  "투표 안 했는데 결과가 나온다"의 실제 원인. 초기화 기능으로 제거했고 검증 후 votes 0 / standby 로 복구.
- Supabase 스키마·시드 적용 완료 확인(2026-09-02). sessions/questions/options/votes, RLS, get_results, 중복 차단 전부 실측 통과.

## 실시간 정합성 검증 (2026-09-05, 프로덕션 프로젝트, 연결 9개 미만)

`node loadtest/verify.mjs --env=.env --allow-prod` → **7/7 통과**. 검증 후 votes 0 / standby 복구 확인.

| 케이스 | 실측 |
|---|---|
| 1 전환 정합성 | DB 3행 = 화면 3표, stale 프레임 0 / 7프레임 |
| 2 늦은 broadcast | Q1 payload 주입 → 거부 1, stale 0 |
| 3 초기화 | final:true 0집계 수신, Q1 0행, Q2 1행 보존, 전체 0행 + standby |
| 4 중복 | 첫 ok / 재투표 23505 / 다른 질문 ok |
| 5 마감 | 마감 후 42501, final 정확히 1회 |
| 6 재연결 | 끊기 전 1표 → 끊긴 사이 3표 → 재연결 후 4표 |
| 7 유실 관측 | 20/20 수신(100%), 유실 회차 없음 |

케이스 1 은 처음에 FAIL(화면 1표 / DB 3표)이었고, 원인은 `show_results` 가 flush 를 쏘지 않던 것.
250ms 병합 창에 표가 몰리면 마지막 표들이 방송되지 않는데, 마감 전에 결과를 공개하는 진행에서는
보정할 계기가 없었다. `applySessionAction` 의 flush 조건에 `show_results` 를 추가해 해결.

## 워드클라우드 실측 (2026-09-08)

디자인 시스템 준수(/preview, 뷰포트 1920 고정, 30단어 포화 상태):

| 항목 | 실측 |
|---|---|
| 단어 색 | `rgb(10,10,10)` + `rgb(31,111,255)` **2종뿐**. 회색·투명도 0 |
| blue 단어 | 최다 단어 1개만 |
| 폰트 | 패널 h1 과 **문자열까지 동일** (-apple-system 스택). 라이브러리 폰트 유입 0 |
| 컨테이너 배경 | `rgba(0,0,0,0)` · 보더 `0px` · canvas 0개 |
| 크기 범위 | 1920 기준 60px ~ 148px (14단어) / 41px ~ 101px (30단어) |
| 굵기 | 600 / 700 두 단계 |
| 넘침 | 1280x720 · 1920x1080 · 2560x1440 · 3840x2160 에서 14단어/30단어 모두 가로 0, 세로 0 |
| 막대 뷰와 비교 | 질문 56px·ink, 실시간 점, 메타 30px, 패널 padding 48px·radius 32px **전부 동일** |
| reduced-motion | animation-duration 0.01ms, 최종 opacity 1 / transform none |

실시간 갱신(실제 /screen, 1920, 새로고침 없음):
7표 4단어 → 7표 추가 → 6단어로 크기·순서 재계산, `N명 참여` 7 → 14.
객관식으로 전환하면 클라우드 0 / 막대 4 로 항상 막대.

배치 튜닝 기록: 처음엔 패널 폭을 다 써서 14단어가 한 줄로 늘어섰다(구름이 아니라 띠). `cloudWidth` 로 감아
여러 줄을 만들었고, 크기를 키우니 30단어에서 세로로 넘쳤다. 단어 수 보정(`cloudFitWords`)을 넣어
두 경우 모두 넘침 0 으로 맞췄다.

메모: 굵기 기준이 중앙값이라 꼬리가 긴(1표 단어가 많은) 분포에서는 중앙값이 1 이 되어 전부 700 으로 나온다.
크기 위계는 그대로라 읽기에는 문제없다. 신경 쓰이면 기준을 상위 1/3 등으로 바꾸면 된다.

## 연결 실측 (2026-09-05)

- 프로덕션 빌드 기준 **관객 1명 = WebSocket 1개**. 채널은 /vote 1, /screen 2, /admin 1, /preview 0.
- dev 에서만 StrictMode 로 `session` 채널이 join 2 / leave 1. 순증 1개이고 프로덕션 빌드는 join 1 / leave 0. 누수 아님.
- 앱 코드에 채널 누수 없음. 모든 subscribe 지점에 대응하는 removeChannel 이 있다.
- **대시보드 398/200 의 추정 원인은 부하 스윕**(vote-storm.mjs, 가상 청중 1명 = 소켓 1개, N=400 스윕 실행 이력).
  앱이 아니다. 재발 방지: 스윕은 테스트 전용 프로젝트에서만, 그리고 중단 시에도 소켓을 닫도록 정리 경로 추가함.

## 다음 작업 (순서)
0. ~~0007_results_view Run~~ → 2026-09-19 적용 완료.
0-1. ~~Supabase 조직 쿼터 초과 경고 확인~~ → 2026-09-19 원인 특정 완료. 아래 "Supabase 쿼터 초과 원인" 절.
   **행사 날짜가 10/4 이후면 그대로 진행 가능. 다만 동시 접속 200명을 넘기면 같은 초과가 반복된다.**
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

## 최종 행사 시나리오 검증 (2026-09-07)

- `node loadtest/scenario.mjs --env=.env --allow-prod` 실행: **33/33 통과**.
- 실제 순서(standby → Q1 공개 전/투표/마감 전 결과 공개/마감 → Q2 → Q3 주관식/초기화 → standby)와 재연결·늦은 broadcast를 확인했다.
- 최대 동시 연결은 3개(admin, screen, voter)로 10개 미만이다. 부하 스윕은 실행하지 않았다.
- 실행 전 votes 0행, 실행 후 votes 0행과 `standby`, `voting_open=false`, `results_visible=false`를 재확인했다.
- 루트 `.gitignore`에 참고 폴더 3개를 추가하고 기존 추적분은 인덱스에서만 제거했다.

## 브라우저 드라이브 검증 (2026-09-10)

- 경로 A(Vite dev + DEV 제어)에서 Playwright Chromium으로 screen(1920×1080), mobile 3개(iPhone), DEV-admin을 구동했다.
- S0~S9 전체 통과. 투표 열기와 결과 집계 증가를 새로고침 없이 확인했고, 중복 투표 409과 Q2 stale 제거, Q3 질문별 초기화, 종료/대기를 확인했다.
- `client/test-artifacts/드라이브/`에 단계별 screen/mobile/admin 캡처와 `browser-drive-report.json`을 남겼다.
- 최대 동시 연결 5개. 종료 시 votes 0, standby, voting_open=false, results_visible=false를 재확인했다.
- 워드클라우드는 코드와 0007 마이그레이션은 있으나 프로덕션 DB에 `sessions.results_view`가 없어 생략됐다. 0007 Run 후 이 단계만 재검증한다.
  → 2026-09-19 시뮬레이션에서 0007 적용 후 S11 로 재검증 완료.

## 행사 전체 시뮬레이션 (2026-09-19)

관리자 1 + 대형화면 1 + 청중 4 를 실제 브라우저 탭으로 동시에 띄워 행사 흐름 전체를 시연했다.
산출물: `client/test-artifacts/simulation/` (스크린샷 75장, `SUMMARY.md`, `simulation-report.json`).

- 실행 경로: 프로덕션 빌드(dist) + 실제 `client/api/*` 핸들러 + 실제 어드민 패스코드 로그인.
  `vercel dev` 는 로그인이 필요해 같은 핸들러를 그대로 구동하는 하네스(`client/scripts/sim-server3.mjs`)로 대체했다.
- 역할마다 오리진을 나눠(`admin/screen/v1~v8 .localhost`) 쿠키(voter_key)를 격리했다. DB 에서 voter_key 4종 확인.
- 결과: 순차 15 + 동시성 6 + 오류 8 = **29단계 전부 PASS**(수정 후). 콘솔 에러 0, 페이지 예외 0, 가로 스크롤 0.
- 최대 동시 연결 10개(기본 6 + 동시 진입 4). 부하 스윕은 돌리지 않았다.
- 종료 후 votes 0행 / standby / voting_open false / results_visible false / results_view bars 확인.

### 지연 시간 실측 (브라우저 안에서 DOM 변경 시각으로 측정)

| 구간 | 측정값 |
|---|---|
| 질문 전환 → 대형화면 | 510ms |
| 투표 열기 → 청중 4명 선택지 | 689~690ms |
| 결과 공개 → 막대 | 733ms |
| 투표 제출 → 대형화면 집계 증가 | 156ms |
| 이 질문 초기화 → 화면 0표 | 329ms |
| 4명 동시 제출 → 전원 완료 | 304ms (INSERT 시각 분포 19ms) |
| 신규 4명 동시 진입 → 전원 렌더 | 705ms |
| 대형화면 재연결 → 집계 보정 | 592ms |
| 청중 재연결 → 세션 상태 수렴 | 1929ms |

### 발견해 수정한 결함 (둘 다 순차 테스트로는 안 잡힌다)

**D1 `client/src/routes/Screen.jsx`. 재연결 후 집계 미보정.**
소켓을 강제로 끊고 그 사이에 3표를 넣자 DB 는 4행인데 화면은 1표에서 멈췄고 20초가 지나도 복구되지 않았다.
results 채널 재조인 시 RPC 보정이 없었다(보정은 최초 마운트에만 있었다). `subscribeResults` 의 status 콜백을 받아
두 번째 이후 SUBSCRIBED 에서 `fetchResults`+`fetchLiveCount` 를 다시 읽는다. 수정 후 592ms 만에 4표로 복구.

**D2 `client/src/lib/session-context.jsx`. 재연결 후 세션 상태 미수렴.**
청중 폰의 소켓이 끊긴 사이에 관리자가 마감하면 재연결 후에도 선택지 4개가 그대로 남아 "마감된 질문에 계속 투표할 수 있는 화면"이 됐다.
유실된 sessions 변경은 재조인해도 재전송되지 않는다. 같은 방식으로 `fetchSession` 재조회를 넣었고 수정 후 1.9초 안에 대기 화면으로 수렴.

처음 C4(관리자 연타)에서 "DB 는 마감인데 청중 4명은 열림"이 우연히 관측됐고, 소켓을 강제로 막는 케이스(C4b/C5b)로 결정적 재현에 성공했다.
연타 자체는 결함이 아니었다(API 3연타 순서 보존, 최종 상태 = 마지막 명령).

### 수정하지 않고 기록만 한 관측

- 어드민 화면에 세션 종료(end) 버튼이 없다. end 액션과 청중·랜딩 종료 화면은 있지만 진입점이 없어 행사에서 쓰려면 버튼이 필요하다.
- 어드민 "응답" 카운터는 active_question_id 가 바뀔 때만 조회한다. 투표가 들어오는 동안 0 에서 움직이지 않는다(IA 의 "응답 수 모니터"와 불일치).
- 주관식 입력은 MAX_TEXT=12 로 잘린다. 80자 응답은 UI 경로로 만들 수 없어 상한 동작 자체를 검증했다(56자 타이핑 → 12자 저장).
- 동점이면 최다값 막대가 전부 blue 가 된다(4파전에서 4개 모두). 뚜렷한 1등이 있으면 blue 1개 + inkSoft 나머지로 정상.
- 시드 질문이 3개뿐이라 Q4 는 전체 초기화 후 Q1 을 재사용했다. 옵션 2개 질문도 없어 E5 는 주관식 2단어(2행) 대 객관식(4행)으로 비교했다.
- E3 첫 시도에서 결과 공개 후 막대가 15초 안에 뜨지 않은 1회가 있었다. 같은 시퀀스를 두 번 재현했으나 재발하지 않았고 원인은 미확정이다.
- 뷰포트는 전 역할이 1440x900 이다. 샌드박스에서 Playwright 브라우저 기동이 막혀 Aside 브라우저 탭을 썼고 탭별 뷰포트를 지정할 수 없다.
  1920x1080 대형화면과 390x844 폰 뷰포트는 이번 실행에서 재현하지 못했다(2026-09-08 워드클라우드 실측, 2026-09-10 드라이브 기록이 대체 근거).

## Supabase 무활동 정지 방지 (2026-09-18)

- 무료 티어가 며칠간 무활동이면 프로젝트를 자동 정지한다는 우려 → `client/api/keep-alive.js`(read only, sessions 1행 select) + `client/vercel.json` Cron(`0 3 * * *`, 매일 UTC 03:00) 추가.
- Vercel Hobby(무료)는 Cron 하루 1회 제한이라 이 주기로 잡았다. 쓰기 없음 확인(select 만).
- 사람이 할 일: 배포 후 Vercel 대시보드 → Cron Jobs 탭에서 활성·첫 실행 로그 확인. 급하면 Supabase SQL Editor에서 `select 1;` 한 번 Run 하면 즉시 정지 카운트다운 리셋.


## 시뮬레이션 잔여 결함 수정 (2026-09-19)

2026-09-19 전체 시뮬레이션의 "기록만 한 관측" 중 행사 운영에 걸리는 3건을 고쳤다. 검증 산출물은 `client/test-artifacts/simulation/F-*.png`.

### A. 어드민 세션 종료 버튼 (`client/src/routes/Admin.jsx`)

end 액션은 `api/_lib/session-actions.js` 에 이미 있었고 청중·랜딩 종료 화면도 있었는데 어드민에 진입점이 없었다.
초기화 그룹 아래 줄에 `세션 종료` 버튼을 넣었다. 되돌릴 수 없는 동작이라 전체 초기화와 같은 2단 확인이다
(첫 클릭 → "한 번 더 누르면 세션 종료", 3초 뒤 자동 해제). 위험은 색이 아니라 위치와 여백(`mt-md`)으로 표시한다.
완료하면 상태 패널에 "세션을 종료했어요"가 2초간 뜬다. 오른쪽 컨트롤 열이 6개 → 7개가 되어 질문 리스트를 `md:row-span-7` 로 맞췄다.

**다시 시작 경로는 기존 "대기 화면" 버튼이다.** 실측: ended → "대기 화면" → `status=standby`, `voting_open=false`, `results_visible=false`, 대형화면 QR 복귀.

### B. 어드민 응답 수 실시간화 (`client/src/routes/Admin.jsx`)

원인: 응답 수를 `active_question_id` 가 바뀔 때만 `fetchLiveCount` 로 1회 조회했다. 투표가 들어오는 동안 0 에서 움직이지 않았다.
수정: `/screen` 과 같은 `results:{qid}` broadcast 를 구독하고 payload 의 `live_count` 를 그대로 쓴다.
중복 채널을 새로 만들지 않는다. 같은 소켓 위에 채널 1개가 늘고 어드민은 1명이라 청중 연결 수에는 영향이 없다(SUPABASE.md 채널표 갱신).
재연결 보정도 Screen 과 같은 규칙으로 넣었다. 실측: 투표 3건에 어드민 응답 수가 306 / 305 / 302ms 만에 0→1→2→3 으로 갱신, 대형화면과 동시에 올랐다.

### C. 동점일 때 강조 제거 (`client/src/routes/Screen.jsx`)

기존: `count === max` 인 항목을 전부 blue 로 칠했다. 4파전이면 4개가 전부 blue 라 "1등 강조"라는 의도와 어긋났다.
수정: 최다값을 가진 항목이 **정확히 1개일 때만** 그 항목을 blue 로 두고, 동점이면 전부 `inkSoft`(비1등과 같은 처리)다. 0표(전부 0)도 동점 취급이라 blue 가 0개다.
`highlight`(강조할 표 수, 없으면 null)를 ScreenView 에서 한 번 계산해 BarChart 와 WordCloud 가 같이 쓴다. 워드클라우드도 단독 최다 단어일 때만 blue 다.
실측: 1표 3파전 → blue 0 / inkSoft 4, 2표 단독 1등 → blue 1 / inkSoft 3, 0표 → blue 0, 워드클라우드 동점 → blue 0 · 단독 → "미래" 1개만 blue.

### D. E3(막대가 안 뜬 1회) 진단

**원인 특정 실패. 다만 같은 증상을 만들 수 있는 코드 취약점을 찾아 초기 경로를 보정 함수로 통일했다.**

- 확인한 것: 최초 구독에서도 SUBSCRIBED 콜백은 온다. D1 의 재연결 보정은 `joins === 1`(최초 조인)을 건너뛰고 별도의 초기 fetch 에 의존하고 있었다.
  즉 초기 진입과 재연결 보정이 **다른 코드 경로**였다.
- 취약점: 초기 `fetchQuestion` / `fetchResults` / `fetchLiveCount` 세 개에 `.catch` 도 재시도도 없었다. 하나라도 실패하면 `results` 가 null 로 남는다.
  **0표 질문은 broadcast 가 아예 발생하지 않으므로** 질문을 바꾸거나 소켓이 재연결되기 전까지 화면이 빈 채로 영구히 남는다. E3 은 정확히 0표 상태였다.
- 수정: 초기 진입과 재연결 보정을 `sync()` 하나로 합치고 실패 시 1초 뒤 1회 재시도한다(Screen 의 질문·집계·참여 수, Admin 의 응답 수 동일).
- 한계: E3 당시 네트워크 실패 로그를 남기지 않아 이 경로가 실제 원인이었는지는 확정할 수 없다. 재현 시도 2회 모두 재발하지 않았다.
- **리허설에서 재발하면 볼 것:** (1) `/screen` 콘솔에 unhandled rejection 이 있는지, (2) Network 탭에서 `rpc/get_results` 가 실패했는지,
  (3) 그 시점 `sessions.updated_at` 과 화면 상태가 어긋나는지. 필요하면 `sync()` 안에 성공·실패 타임스탬프 콘솔 로그를 임시로 넣고
  (`import.meta.env.DEV` 게이트) 리허설 뒤 제거한다. 프로덕션 번들에는 로그를 남기지 않는다.

### 검증 (수정 후, 프로덕션 빌드 + 실 /api 핸들러)

| 항목 | 결과 |
|---|---|
| F-A 세션 종료 2단 확인 → ended → 대기 화면 복귀 | PASS |
| F-B 어드민 응답 수 실시간(306/305/302ms) | PASS |
| F-C1 동점 → blue 0 / inkSoft 4 | PASS |
| F-C2 단독 1등 → blue 1 / inkSoft 3 | PASS |
| F-C3 0표 → blue 0 | PASS |
| F-C4 워드클라우드 동점 0 · 단독 1개 | PASS |
| F-R1 [회귀] 대형화면 재연결 보정(D1) 1209ms | PASS |
| F-R2 [회귀] 청중 재연결 수렴(D2) 1755ms | PASS |
| F-R3 [회귀] 전환 stale 0 · 중복 차단 · 초기화 · 색 감사 · 콘솔 0 | PASS |

종료 후 votes 0행 / standby / voting_open false / results_visible false 재확인.

### 이번에도 안 고친 것

- ~~이미 투표를 마친 청중은 세션을 종료해도 "투표했어요" 화면에 머문다~~ → 2026-09-19 수정(아래 "종료 상태 우선순위 수정" 절).
- 뷰포트 1920/390 실측은 여전히 미확인이다. 샌드박스에서 브라우저 기동이 막혀 탭 뷰포트를 지정할 수 없다. 실기기·실제 창으로 눈으로 확인해야 한다.

## 종료 상태 우선순위 수정 (2026-09-19)

`/vote` 의 화면 상태 판정에서 `voted` 가 `ended` 보다 먼저 검사돼, 이미 투표한 청중은 세션이 종료돼도
"투표했어요" 화면에 그대로 머물렀다. 새로고침해야만 종료 안내로 바뀌었다. 새로고침을 안전장치로 쓰지 않는다.

`client/src/routes/Vote.jsx` 한 줄:

```
before: const state = voted ? 'done' : open && !ended ? 'voting' : 'waiting';
after:  const state = ended ? 'waiting' : voted ? 'done' : open ? 'voting' : 'waiting';
```

우선순위는 ended → standby/마감 → voted → 투표 순이다. 마감(`voting_open=false`)은 예전 결정대로 대기와 같은 화면이라
별도 분기가 아니다. 상태는 session-context 가 realtime 으로 주는 `session.status` 를 그대로 쓰므로 새로고침이 필요 없다.
종료 문구는 기존 "오늘 세션이 종료되었어요" 하나를 그대로 쓴다. 투표한 사람과 안 한 사람에게 다른 문구를 만들지 않았다.

### 검증 (프로덕션 빌드 + 실 /api 핸들러, 산출물 `client/test-artifacts/simulation/G-*.png`)

| 항목 | 결과 |
|---|---|
| G-1 완료(done) 상태에서 종료 → 새로고침 없이 종료 화면. 완료 문구 사라짐, 선택지·버튼 0 | PASS |
| G-1 미투표자도 동시에 종료 화면. 두 화면 문구가 완전히 동일 | PASS |
| G-2 [회귀] 종료 → "대기 화면" → 종료 문구 해제, 투표자는 완료 화면 복귀, 다음 질문 전환 정상 | PASS |
| G-3 종료 확정 클릭 기준 전환 지연 **투표 완료자 756ms / 미투표자 756ms** (동일) | PASS |
| G-4 [회귀] 중복 차단 문구·마감 화면(대기와 동일)·전환 stale 0·색 감사·콘솔 0 | PASS |

새로고침 없이 전환됐는지는 `performance.getEntriesByType("navigation").length === 1` 로 같이 확인했다.
종료 후 votes 0행 / standby / voting_open false / results_visible false 재확인.

## Supabase 쿼터 초과 원인 (2026-09-19 확인)

대시보드 배너: "Organization exceeded its quota in the previous billing cycle (Realtime Connection Count Exceeded).
Projects will be restricted from 04 Oct, 2026 if your organization remains over quota." 제한이 걸리면 요청이 402 로 떨어진다.

### 초과 항목은 하나뿐이다

| 항목 | 사용 / 한도 |
|---|---|
| **Realtime Concurrent Peak Connections** | **398 / 200 (199%)** |
| Database Size | 0.028 / 0.5 GB (6%) |
| Realtime Messages | 24,351 / 2,000,000 (1%) |
| Egress | 0.032 / 5 GB (<1%) |
| Storage / MAU / Edge Functions | 전부 0 |

### 398 은 단 하루, 부하 스윕 날이다

일자별 최대 동시 연결(차트 호버로 전부 읽음, 청구 주기 2026-08-28 ~ 09-28):

| 날짜 | 피크 |
|---|---|
| **02 Sep** | **398** |
| 03 Sep | 4 |
| 04 Sep | 6 |
| 05 Sep | 3 |
| 06 Sep | 1 |
| 07 Sep | 7 |
| 08 Sep | 1 |
| 10 Sep | 6 |
| 11 Sep | 1 |
| 18 Sep | 1 |
| 19 Sep | 9 |

09-02 는 `loadtest/vote-storm.mjs` 로 N=400 스윕을 돌린 날이다(위 "부하 실측 2026-09-02" 절과 일치).
**앱이 만든 부하가 아니라 우리가 돌린 테스트 부하다.** 그 외 모든 날은 한 자릿수이고, 09-19 브라우저 시뮬레이션도 9 였다(탭 최대 10개와 일치).

### 그래서 어떻게 되나

- 이 지표는 누적이 아니라 **청구 주기 내 최댓값**이다. 09-28 에 새 주기가 시작되면 398 은 집계에서 빠진다.
- 스윕을 다시 돌리지 않으면 09-28 ~ 10-04 구간 피크는 한 자릿수라 10-04 유예 종료 시점에 초과 상태가 아니게 된다.
- **단, 행사 당일 동시 접속이 200 을 넘으면 같은 초과가 다시 난다.** 무료 티어 한도는 200 이고 우리 실측 안전선(280~300)은 한도가 아니라 기술적 한계였다.

### 해야 할 일

1. **부하 스윕을 이 프로젝트에서 다시 돌리지 않는다.** 꼭 필요하면 별도 테스트 프로젝트를 만든다.
2. 09-29 경 대시보드에서 피크가 리셋됐는지, 배너가 사라졌는지 확인한다.
3. 행사 예상 인원이 200 명을 넘으면 그 달만 Pro 로 올리거나(월 $25), 동시 접속을 200 아래로 관리한다.
   초과 상태에서 유예가 끝나면 요청이 402 로 떨어져 행사 중 앱이 죽는다.

근거 캡처: `client/test-artifacts/simulation/supabase-realtime-usage.png`

## 커버(오프닝) 화면 추가 (2026-09-19)

/screen 에 모듈 시작을 알리는 네 번째 상태 `cover` 를 추가했다. 대기(standby)/진행(live)/결과/종료(ended) 와 같은
배경·Glass 패널·타이포 스케일·색을 전부 재사용하고, 새 디자인 언어를 만들지 않았다.

### 원문 지시와 실제 코드가 어긋난 부분 (진행 전 확인)

작업 프롬프트는 "eyebrow 클래스·문자열 그대로 재사용"을 전제했지만, 소스를 먼저 읽어보니 사실과 달랐다.

- `client/src` 전체에서 `eyebrow` 검색 0건. 결과 화면(`ScreenView`)은 h1(질문) + 초록 점 + `N명 참여` 메타뿐이고
  eyebrow/라벨 텍스트 자체가 없었다.
- "코리아 넥스트 임팩트 포럼" / "INTERACTIVE SESSION" / "청중과 함께 그려보는 미래의 대학" 세 문구는 저장소
  전체(`*.md`, `*.jsx`, `*.js`)에 0건. `SOURCE.md`도 없다. 이번에 처음 들어가는 문구다.
- `tokens.js` typography 전체를 봐도 양수 자간(letter-spacing) 토큰이 없다. 전부 `0` 아니면 음수
  (`-0.01em`, `-0.02em`)다. 요청한 "0.04~0.06em" 라벨톤 자간은 재사용할 게 없었다.

문구는 프롬프트가 명시한 최종 텍스트이므로 그대로 썼다(추측 아님). eyebrow 타이포는 프로젝트의 기존 확장 절차
(새 토큰 필요 시 tokens.js 추가 + DESIGN.md 동시 갱신)를 따라 `screenEyebrow` / `screenEyebrowWide` 두 역할을
새로 추가했다. 크기·leading은 이미 20m 프로젝터 가독 검증이 끝난 `screenMeta`와 완전히 동일한 스케일을 그대로
가져왔고, 서로 다른 값은 tracking(0.02em / 0.05em) 하나뿐이다. HIG 타이포 규율("아주 작은 텍스트는 약간 양수
tracking")에 부합한다.

### 재사용한 기존 것 (새로 안 만든 것)

| 항목 | 재사용 소스 |
|---|---|
| 배경 | `GlassRoot background="/images/bg/ambient-screen.webp"` (standby/결과와 100% 동일) |
| 패널 | `Glass variant="screen" radius="screen"` (standby/결과와 100% 동일) |
| 좌측 정렬 | 기존 결과 블록의 기본 정렬(QR만 예외로 중앙정렬이던 규칙 그대로 유지, 커버는 새 예외 안 만듦) |
| 등장 모션 | `.plate-in`(rise-in, opacity 0→1 + translateY(8px)→0, durBase 320ms, easeOut). QR 플레이트가 쓰는 것과 동일 클래스, 새 keyframe·새 duration 0개 |
| reduced-motion 폴백 | 전역 `@media (prefers-reduced-motion: reduce)` 규칙이 `*` 셀렉터로 이미 `.plate-in`을 포함해 전체 애니메이션에 걸려 있다. 새 코드 없이 자동 상속 |
| 타이틀 타이포·<Ko>·balance | `text-screenQuestion` + `<Ko>` + `balance`. 결과 화면 질문과 완전히 동일 |
| eyebrow와 타이틀 사이 간격 | `spacing.sub`(10px, "제목과 부제 사이" 역할, Landing.jsx/Offline.jsx 에서 이미 쓰는 값) |
| 색 | `colors.ink` 하나만. 새 색 0개 |

### 새로 만든 것 (2개, 이유는 위 "원문과 어긋난 부분" 참고)

- `tokens.js`: `typography.screenEyebrow`, `typography.screenEyebrowWide`. 크기 스케일은 screenMeta 재사용, 다른 건 tracking 값뿐.
- dist 빌드에서 생성된 tailwind 유틸리티 클래스 `text-screenEyebrow`, `text-screenEyebrowWide` (tokens.js 값에서 자동 파생, 컴포넌트에 하드코딩 없음).

### 2줄 타이틀

"청중과 함께 그려보는 미래의 대학"(16자)은 `screenQuestion`의 최대 크기(56px) 기준으로도 1920px 패널 폭에
한 줄로 들어간다(실측: 1440px 창에서 `h1` 렌더 결과 1줄). `text-wrap:balance` 만으로는 프롬프트가 지정한
"청중과 함께 그려보는 / 미래의 대학" 분할이 자연 발생하지 않아, 프롬프트가 허용한 대로 `<Ko>` 의 ` / ` 마커를
그 지점에 그대로 넣었다. 결과 HTML: `청중과 함께 그려보는<br>미래의 대학`.

### A. DB / 서버

- `supabase/migrations/0008_cover_state.sql`. CHECK 제약 확장만(비파괴). `status in ('standby','live','ended','cover')`.
- `supabase/_ALL.sql` 끝에 0008 섹션 반영, 헤더 주석 갱신.
- `api/_lib/session-actions.js`: `patchFor`에 `case 'cover': return { status: 'cover', voting_open: false, results_visible: false };` 추가.
- **프로덕션 DB(`sqrnlursfdmqpigkmnio`)에 직접 Run 완료.** Supabase SQL Editor에서 실행, "Success. No rows returned" 확인.
  실행 전 `{action:'cover'}` 호출 시 `sessions_status_check` 위반 500 에러로 재현 후, 실행 뒤 200 정상 전환으로 재검증했다.

### B. /screen 렌더

- `Screen.jsx`에 `CoverPlate` 함수 추가(파일 내부, 새 파일 아님. 기존 `QrPlate`/`WordCloud`/`BarChart`와 같은 패턴).
- `ScreenView`에 `cover` prop 추가, `standby ? ... : cover ? <CoverPlate/> : <라이브 블록>` 3분기.
- `Screen()`에서 `cover={session?.status === 'cover'}` 전달.

### C. 어드민 버튼

- `Admin.jsx`: "대기 화면" 바로 위에 "커버 화면" 버튼 추가(`onAction('cover')`, 같은 톤·크기, 확인 다이얼로그 없음. 가벼운 전환이라 프롬프트 지시대로 생략).
  `STATUS`에 `cover: '커버'` 추가.
- `DevControlPanel.jsx`: "대기로" 위에 "커버로" 버튼 추가.

### D. Preview

- `Preview.jsx` 대형화면 섹션 맨 앞에 "커버 / 오프닝" 프레임 추가(`<ScreenView cover />`).

### 검증 (프로덕션 빌드 + 실 /api + 실제 Supabase, sim-server3 on :5301)

| 항목 | 결과 |
|---|---|
| 마이그레이션 적용 후 build | 통과 |
| 마이그레이션 미적용 상태 재현(500, `sessions_status_check` 위반) → 적용 후 재검증(200) | 확인 |
| 어드민 "커버 화면" → /screen 새로고침 없이 전환(realtime) | **820ms**, `performance.getEntriesByType('navigation').length === 1` |
| 배경/패널/radius/폰트가 결과 화면과 같은 클래스인지 코드 확인 | `GlassRoot background="/images/bg/ambient-screen.webp"`, `Glass variant="screen" radius="screen"` 동일 소스 |
| "대기 화면" 클릭 → cover → standby(QR) 정상 전환 | 확인(어드민 상태 라벨 "커버"→"대기", 화면 QR 캔버스 렌더) |
| 이후 질문 설정 → 투표 열기 사이클 정상(회귀) | 확인, 커버 잔존 텍스트 0 |
| 초록 점 없음 / QR 없음 / 부제 없음 | 확인(`liveDotExists: false`, 텍스트 3줄만) |
| 커버 화면 텍스트 색 | `rgb(10, 10, 10)`(ink) 단일값 |
| reduced-motion 폴백 | 런타임 emulateMedia 는 이 하네스에서 미지원(환경 제약, 기존과 동일) → 코드 근거로 확인: 새 애니메이션이 아니라 기존 `.plate-in`을 재사용하므로 이미 전역 규칙에 포함됨 |
| dist 격리 grep(`__dev__`/DevControlPanel/backup/Slido/가운뎃점/gray/navy/lucide) | 전부 0건 |
| 새로 생성된 tailwind 클래스 | `text-screenEyebrow`, `text-screenEyebrowWide` 2개(위 "새로 만든 것" 참고, 의도된 것) |

산출물: `client/test-artifacts/simulation/H-1-cover-screen.png`(1440 초기 렌더), `H-3-cover-2line.png`(마커 적용 2줄),
`H-4-standby-after-cover.png`(대기 전환), `H-5-question-after-cover-cycle.png`(회귀), `H-6-cover-final.png`(색 감사용).

### 남은 것

- 정확한 1920×1080 실기기 렌더는 이 세션에서도 Playwright viewport 리사이즈가 막혀 있어(기존과 동일 제약)
  1440px 창 + CSS 계산 근거로 대체 검증했다. 실기기(무대 프로젝터)에서 최종 육안 확인 권장.
- 로컬 테스트용 `sim-server3`(포트 5301)가 이 세션에서 kill 권한이 없어 백그라운드에 남아 있다. 로컬 전용이라
  프로덕션·Supabase 쿼터에 영향 없음. 터미널에서 `lsof -ti:5301 | xargs kill`로 정리 가능.


## 전수 재검증 (2026-09-20)

이 대화에서 합의된 기능·수정이 지금 코드에 실제로 다 들어가 있는지 소스 직접 읽기 + 실제 구동으로 확인했다.
PROGRESS.md 요약 문구를 믿지 않고 파일을 다시 열어 확인한 결과다.

### 체크리스트 결과

| # | 항목 | 판정 | 근거 |
|---|---|---|---|
| 1 | migrations 0001~0008 + _ALL.sql 순서 반영 | 있음 | `supabase/migrations/` 8개, `_ALL.sql` 섹션 순서 0001→0002→0003→0004→0005→seed→0006→0007→0008 |
| 1 | results_pulse 병합 + flush_results, show_results 가 호출 | 있음 | `0004_broadcast_throttle.sql:38`, `session-actions.js:44` (`close_voting`·`show_results` 둘 다 flush) |
| 1 | status CHECK: backup 없음 / cover 있음 | 있음 | `_ALL.sql:358` `('standby','live','ended','cover')` (305행 backup 은 0006 이 341행에서 되돌림) |
| 1 | results_view(bars/cloud) | 있음 | `_ALL.sql:348` |
| 1 | RLS 3종 | 있음 | `0002_rls.sql`. 실검증: 마감 INSERT→42501 거부 / votes SELECT→`[]` / sessions UPDATE→영향 행 0 |
| 2 | patchFor 전 액션 존재, backup 0 | 있음 | `session-actions.js:6-21` 10개 액션 + reset(question/all). backup grep 0건 |
| 2 | Admin 버튼 전부 렌더·onClick 연결 | 있음 | `Admin.jsx:58,73,78,85,88,95,99,103,129,132,139`. 실제 화면에서 버튼 전수 확인 |
| 2 | 세션 종료 2단 확인(3초 해제) | 있음 | `Admin.jsx:270`. 실검증: 1차 클릭 시 DB 미변경 → 2차에 ended → 3초 뒤 자동 해제 |
| 2 | 어드민 응답 수 realtime 구독 | 있음 | `Admin.jsx:165-200` `subscribeResults` + `live_count` |
| 2 | 인증 쿠키 검증·401 | 있음 | `session-control.js:7`, `admin-session.js:6`. 실검증: 쿠키 없이 401 / 오답 401 / 정답 204 |
| 3 | ended 가 voted 보다 우선 | 있음 | `Vote.jsx:166` `ended ? 'waiting' : voted ? 'done' : open ? 'voting' : 'waiting'` |
| 3 | 별도 마감 상태 없음, closed prop 0 | 있음 | grep 0건. 마감 화면 = 대기 화면 실측 확인 |
| 3 | 42501·23505 분기 | 있음 | `Vote.jsx:181,184`. 실검증: 중복 시 "이미 투표했어요", DB 2행 유지 |
| 3 | 완료 화면 초록 점·결과 안내 문구 없음 | 있음 | `bg-green` 은 /screen·어드민 연결표시에만. 완료 화면 텍스트에 "결과" 0 |
| 3 | Ko/koGlue, balance, keep-all | 있음 | `Ko.jsx`, `ko-break.js` + 테스트 파일, `index.css:14,34` |
| 4 | standby QR(Canvas), 설명 텍스트 없음 | 있음 | `Screen.jsx:2,39` QRCodeCanvas. 실측: standby 텍스트 0자 |
| 4 | cover: 재사용·초록점/QR/부제 없음·실시간 | 있음 | `Screen.jsx:46-60`. 실측 707ms 전환, 텍스트 4줄(eyebrow 2 + 타이틀 2)이 전부 |
| 4 | 질문 전환 stale 0 | 있음 | `Screen.jsx:242-243` 즉시 비움 + `screen-state.js` question_id 가드. 실측 막대 0 |
| 4 | 동점이면 blue 0, 단독 1등만 blue | 있음 | `Screen.jsx:191`. 실측: 1:1 동점 blue 0개 / 단독 1등 blue 1개 |
| 4 | 워드클라우드 조건·배치·색 | 있음 | `Screen.jsx:196` `isText && resultsView==='cloud'`. 실측: 객관식은 cloud 설정에도 막대, 배경 0·캔버스 0·앱 폰트 상속 |
| 4 | 재연결 보정 sync() 공유 | 있음 | `Screen.jsx:256-282` 초기·재조인 같은 `sync()`, 1회 재시도 |
| 4 | 세션 재연결 수렴 | 있음 | `session-context.jsx:25-30` 재조인 시 `fetchSession` |
| 5 | NavFab(pathname 판정) | **없음** | 코드·문서 grep 0건. 구현된 적 없음 |
| 5 | F키 전체화면 | **없음** | grep 0건 |
| 5 | 온보딩·툴팁 0 | 있음 | 해당 UI 자체가 없음 |
| 6 | keep-alive + crons + read only | 있음 | `api/keep-alive.js` (select만), `vercel.json` crons `0 3 * * *`. 실검증 200 |
| 6 | 백업 기능 grep 0 | 있음 | src·api 0건 (0006 정리문만 예외) |
| 6 | .env 미커밋, .env.example 최신 | 있음 | `.gitignore:3`, publishable/secret 체계 |
| 6 | 참고 폴더 ignore | 있음 | liquidGL-main / liquidglass-main / LiquidGlassCheatsheet-main 등록 |
| 7 | radius 단일 스케일, 커버도 기존 값만 | 있음 | 커버는 `radius="screen"` 재사용, 새 radius 0 |
| 7 | 타이포 충돌 없음 | 있음 | screenEyebrow/Wide 는 screenMeta 와 같은 clamp, tracking 만 다름 |
| 7 | 색 팔레트 외 0, 그라데이션 0, 가운뎃점 0 | 있음 | 3화면 실측: 텍스트 색 ink/white/blue 만, 그라데이션 0, 가운뎃점 0 |
| 7 | prominent solid·disabled 뉴트럴·라벨 가시 | 있음 | `.glass-tint` = `rgb(31,111,255)` opacity 1, 라벨 z=1 > tint z=0, disabled opacity 1 + ink 라벨 |
| 7 | keep-all·balance·tabular 일관 | 있음 | 전역 규칙 + 각 화면 적용 확인 |

**"없음" 2건(NavFab, F키)은 의도된 미구현이다.** IA.md 와 ROUTES.md 가 "세 화면은 서로 이동하지 않는다"를
설계 원칙으로 명시하고 있고, 이 대화 어디에서도 구현된 적이 없다. 지금 만들지 않았다. 필요하면 별도 결정 사항이다.

### 실행 검증 결과 (프로덕션 빌드 + 실 /api + 실제 Supabase, sim-server3 :5301)

| 단계 | 내용 | 결과 |
|---|---|---|
| V-1 | standby → cover → standby 실시간 전환 | PASS (커버 707ms, navigation=1) |
| V-2 | 질문 설정 → 투표 열기 → 투표 2건 → 집계=DB | PASS (화면 2명 = DB 2행) |
| V-3 | 마감 → 투표 거부 → 단독1등 blue 1개 → 다음 질문 stale 0 | PASS |
| V-4 | 주관식 → view_cloud → view_bars → 이 질문 초기화 | PASS (객관식은 cloud 설정에도 막대) |
| V-5 | 전체 초기화 → 세션 종료 → 대기 복귀 | PASS (완료자 615ms / 미투표자 616ms, 문구 동일) |
| V-6 | 동시 투표 유실 0 / 중복 차단 | PASS |
| V-7 | 색 감사 / 가로 스크롤 0 / prominent / 콘솔 0 | PASS |

빌드 통과. dist 격리: `__dev__`·DevControlPanel·Preview·sample-questions·더미·backup·Slido·가운뎃점 전부 0건.
dist 의 em-dash 4건은 전부 서드파티(Supabase SDK, vendor LiquidGlass) 문자열이고 우리 소스는 0건이다.
종료 후 votes 0 / standby / voting_open false / results_visible false / results_view bars 복원 확인.

### 이번 재검증에서 실제로 고친 것

- `client/src/tokens.js` 주석의 em-dash 1건 제거(AGENTS.md 1절 위반이었다).
- `DESIGN.md` 커버 절의 em-dash 2건과 오타 2건("쓔다"→"쓴다", "트래킹뜿이다"→"트래킹뿐이다") 수정.
- `PROGRESS.md` 내 em-dash 전량 제거.
- `session-actions.js` `case 'cover'` 들여쓰기 정렬(기능 영향 없음).
- `.gitignore` 에 `.tmp` 추가(작업용 스크립트가 커밋에 섞일 뻔했다).

### 오탐이었던 것 (기록용)

- anon 으로 `PATCH /rest/v1/sessions` 가 204 를 반환해 한때 RLS 구멍으로 의심했으나,
  `Prefer: return=representation` 으로 재확인하니 영향 행이 `[]` 이고 status 도 `live` 그대로였다.
  UPDATE 정책이 없어 대상 행이 보이지 않아 PostgREST 가 "0행 수정"을 204 로 답한 것이다. RLS 정상이다.

산출물: `client/test-artifacts/simulation/V-cover.png`, `V-bars.png`, `V-admin.png`


## 진단 라운드 (2026-09-20): 느림·jitter·워드클라우드·커버 미표시

### 증상 4 (커버 안 보임) 원인: 배포 누락. 해결됨

프로덕션 DB 는 문제가 없었다. secret 키로 `status='cover'` 를 직접 써 보니 그대로 저장됐다(HTTP 200).
0008 CHECK 는 이미 걸려 있었다. **원인은 코드가 배포되지 않은 것이었다.** 직전 커밋 `d96043a` 의
`client/src/routes/Screen.jsx` 에 `CoverPlate` 가 0건이었다. 커버·종료 우선순위·어드민 실시간 응답 수가
전부 로컬에만 있고 원격에 없었다.

조치: 전체를 커밋해 푸시했다(`e8ff2a8`). Vercel 이 자동 배포(Ready, 22s)했고, 배포 번들에
`INTERACTIVE SESSION`·`코리아 넥스트 임팩트 포럼` 문자열이 각각 1건씩 들어간 것을 확인했다.
실제 `https://uia-vote.vercel.app/screen` 을 열고 프로덕션 세션을 `cover` 로 바꾸니 표지가 떴다.
확인 후 standby 로 원복했다. 산출물: `D-live-cover.png`.

커밋에 검증 스크린샷 117장(41MB)이 섞여 들어가 되돌리고 `client/test-artifacts/` 를 .gitignore 에 넣었다.

### 증상 0 (어드민 활성 질문이 검정) 원인: 명백. 고침

`Admin.jsx` 질문 리스트가 `on ? 'border-ink bg-ink text-white'` 였다. 같은 화면의 토글 버튼은 이미
blue(`GlassButton prominent`)라 활성 표현이 두 가지로 갈려 있었다. blue 로 통일했다.
실측: 활성 항목 `rgb(31,111,255)` + 흰 글자.

DevControlPanel 에는 활성 질문 리스트나 선택 토글 자체가 없다(상태 텍스트와 동작 버튼뿐). 대상이 없어 건드리지 않았다.

### 증상 1 (질문 전환이 느림) 원인: 지연이 아니라 피드백 공백. 고침

구간 실측(로컬, sim-server3):

| 구간 | 시간 |
|---|---|
| 클릭 → fetch 시작 | 45ms |
| 서버 왕복(session-control, Supabase 포함) | 167ms |
| 서버 응답 → 활성 표시 전환 | 2ms |
| **합계** | **214ms** |

214ms 는 느린 값이 아니다. 진짜 문제는 그 214ms 동안 **시각 변화가 한 프레임도 없었다**는 것이다.
클릭 직후 `disabled` 속성은 즉시 걸리지만(12프레임 전부 true) 질문 버튼 className 에 disabled 표현이
없어 배경·테두리·투명도·transform 이 전부 그대로였다(변화 프레임 0/12). `press:active` 는 포인터를 떼면
끝나므로 누른 뒤에는 아무 흔적이 없다. 그래서 "눌렀는데 반응이 없다 → 느리다"로 체감된다.

조치: DESIGN.md 가 이미 규정한 disabled 표현(`line` 바탕 + `ink` 글자, opacity 사용 안 함)을
비활성 질문 항목에 `disabled:border-line disabled:bg-line` 으로 붙였다. 새 토큰·새 스타일 0개다.
활성 항목은 blue 를 유지해 대기 중에도 현재 질문이 무엇인지 계속 보인다.
실측: 클릭 후 **0번째 프레임**에서 색이 바뀐다(이전 0/12 → 현재 즉시).

서버 왕복 167ms 자체는 건드리지 않았다. 인프라 영역이고 실측값이 정상 범위다.

### 증상 2 (미세하게 계속 움직이는 느낌) .  원인 특정. 구조적이라 보류

레이아웃은 흔들리지 않는다. 어드민에서 패널·활성 버튼·카운트·캔버스의 사각형을 180프레임 추적한 결과
**고유 geometry 1개, x/y 변화량 0px** 이다. 정지 상태 0.25초 간격 스크린샷 4장도 바이트 단위로 동일했고,
마우스를 움직여도 픽셀이 변하지 않았다.

흔들림은 **`/screen` 에서 결과가 갱신될 때** 나온다. 투표 31건을 0.2초 간격으로 넣으면서 프레임 간격을 쟀다.

| 화면 | 중앙값 | p95 | p99 | 최대 | 33ms 초과 |
|---|---|---|---|---|---|
| 어드민 (투표 25건 유입) | 8.3ms | 9.2ms | 9.4ms | 14.4ms | **0회** |
| /screen (투표 31건 유입) | 8.3ms | 9.1ms | **39.1ms** | **44.6ms** | **31회** |

**주입 31건에 33ms 초과 프레임이 정확히 31회.** 1:1 로 붙는다. 결과가 하나 들어올 때마다 약 40ms 멈춘다.

경로: 집계 broadcast → React 리렌더로 `N명 참여` 텍스트와 막대가 바뀜 → vendor liquidglass 의
`_glassSubtreeObserver`(`characterData: true`, `subtree: true`)가 변경을 감지 →
`_glassContentDirty` 에 패널을 넣음 → 다음 프레임에 `_captureGlassContent` 가 패널 내용을 다시 캡처.
이 재캡처가 한 프레임을 40ms 로 늘린다(`src/vendor/liquidglass/index.js:1880-1901, 2460-2464`).

같은 파일에 `_checkGlassSizeChanges()` 가 매 프레임 모든 글래스의 `offsetWidth/offsetHeight` 를 읽는
구조도 있다(2337-2352). 어드민 기준 글래스 10개 × 120fps = 초당 1,200회 강제 리플로우다. 이 머신에서는
드롭으로 이어지지 않았지만 성능 여유가 적은 기기에서는 더 불리하다.

**고치지 않았다.** 원인이 vendor 라이브러리의 렌더·캡처 구조라 프롬프트 지시대로 보류한다.
다음 라운드 후보: (a) `N명 참여` 처럼 자주 바뀌는 텍스트를 글래스 패널 바깥으로 빼서 재캡처 유발을 끊는다,
(b) 결과 갱신을 rAF 단위로 묶어 초당 재캡처 횟수를 제한한다, (c) `/screen` 만 CSS 글래스로 내린다.
(a) 가 가장 표면적이 좁다.

### 증상 3 (워드클라우드 완결성) 점검만. 고치지 않음

동작하는 것:

- `results_view` 컬럼(0007)·`view_bars`/`view_cloud` 액션(`session-actions.js:14-15`)·어드민 토글
  (`Admin.jsx:85-90`, 주관식이고 결과가 공개됐을 때만 노출) 전부 실존하고 연결돼 있다.
- 렌더는 `Screen.jsx:63-106`. 배경·패널은 막대 뷰와 같은 `GlassRoot`/`Glass variant="screen"` 을 쓴다.
  컨테이너에 background·border 가 없고 캔버스도 쓰지 않아 폰트는 앱 폰트를 그대로 상속한다.
- 실측(응답 28건 → 단어 15개): **겹침 0쌍**, 단독 1등만 blue 1개, 나머지 ink 14개, 크기 44~107px 로 분포.
- 실시간 갱신은 된다. 집계 broadcast 마다 리렌더되고 새 단어는 `cloud-in` 으로 등장한다. 정적 스냅샷이 아니다.

미흡한 지점(나열만):

1. **배치가 구름이 아니라 행이다.** `flex-wrap` + 지그재그 정렬이라 결과가 7줄짜리 가운데 정렬 텍스트 블록으로
   보인다. 겹침이 0인 건 flex 가 원래 겹치지 않기 때문이지 배치 알고리즘의 성과가 아니다.
2. **굵기 2단 위계가 사실상 죽어 있다.** `count >= median ? 700 : 600` 인데 꼬리가 긴 실제 분포에서는
   중앙값이 최솟값(1)과 같아진다. 실측 15단어 전부 700 이 나왔다. 600 가지가 거의 실행되지 않는다.
3. **인라인 하드코딩이 남아 있다.** `letterSpacing: '-0.01em'`, `lineHeight: 1.2`, `fontWeight: 700/600`
   이 컴포넌트에 직접 박혀 있다(`Screen.jsx:96-98`). tokens.js 경유 원칙(AGENTS 1절)에서 벗어난다.
4. **갱신 때 단어가 자리를 옮긴다.** 순서가 count 기준 지그재그라 표가 하나 들어와 순위가 바뀌면 배치가
   통째로 재계산된다. 위치 애니메이션이 없어 즉시 점프한다.

### 함께 관측된 별건: 세션 이벤트 1건 유실

`set_question → open_voting → show_results → view_cloud` 를 연달아 실행한 첫 시도에서 DB 는
`results_view='cloud'` 인데 `/screen` 은 막대 10개를 계속 그렸다. 이후 `view_bars`→`view_cloud` 를
다시 보내자 정상 전환됐고, 같은 시퀀스를 8회·5회 반복했을 때는 재현되지 않았다(1회성).

`subscribeSession` 은 `postgres_changes` 페이로드를 그대로 `onChange(payload.new)` 로 넘기고
(`supabase.js:48-57`) 순서 보장이나 `updated_at` 비교가 없다. 이벤트가 한 건 유실되면 재연결 전까지
복구 계기가 없다. 결과 채널(D1)과 재연결(D2)에는 보정이 들어갔지만 **연결이 살아 있는 동안의 sessions
이벤트 유실은 아직 보정 경로가 없다.** 행사 중 표지나 뷰 전환이 한 번 안 먹는 형태로 나타날 수 있다.
재현율이 낮아 이번에는 고치지 않았다. 다음 라운드에서 다룰 후보다.


## 루트를 대형화면으로 (2026-09-20)

청중은 QR 로만 들어온다. 도메인을 직접 치는 사람은 시연·리허설 중인 운영자다. 그래서 루트의 청중용 폴백
랜딩을 없애고 `/` 가 `/screen` 과 같은 화면을 그리게 했다.

### A. 라우팅

`App.jsx` 에서 `/` 의 element 를 `Screen` 으로 바꿨다. `<Navigate>` 리다이렉트를 쓰지 않았다.
주소창이 `/` 그대로 유지돼야 하고, 리다이렉트로 재마운트가 일어나면 realtime 소켓이 끊었다 다시 붙기 때문이다.

```
before: <Route path="/" element={<Landing />} />
after:  <Route path="/" element={<Screen />} />
```

`/screen` 라우트는 그대로 뒀다. 기존 북마크와 문서 링크가 계속 작동한다.

### B. Landing 제거

- `client/src/routes/Landing.jsx` 삭제(`Landing`, `LandingView` 둘 다).
- `App.jsx` import·라우트 제거.
- `Preview.jsx` 의 "랜딩 / 390" 섹션(진행 중·종료 프레임 2개)과 `LandingView` import 제거.
- `ROUTES.md` 라우트 표: `/` 를 "대형화면(`/screen` 과 동일 컴포넌트)"로 수정.
- `IA.md` 공용 항목: `/` 설명을 대형화면으로 교체하고 이유를 남겼다.
- `COMPONENTS.md` 에는 Landing 관련 서술이 없어 건드릴 것이 없었다.

코드에서 `Landing` 문자열 0건, dist 번들에서 `Landing`·"지금 참여하기"·"실시간 투표에 참여" 전부 0건이다.

### C. NavFab / F 키 . 대상 없음

작업 지시에 "NavFab·F 키 판정 목록에 `/` 추가"가 있었지만 **이 프로젝트에 NavFab 도 F 키 전체화면도 존재하지 않는다.**
`client/src` 전체에서 `NavFab`, `Fab`, `fullscreen`, `requestFullscreen`, `keydown` 모두 0건이다
(검색되는 건 09-20 전수 재검증에서 내가 "미구현"이라고 적어둔 PROGRESS.md 문장뿐이다).

지시가 우려한 "메인 도메인에서 FAB 가 안 뜨는 모순"은 생기지 않는다. 애초에 어느 경로에도 FAB 가 없기 때문이다.
갱신할 판정 목록 자체가 없어 C 는 수행 대상이 없다. 화면 간 이동 UI 가 필요하면 새로 만드는 작업이라
별도 지시가 필요하다.

### 검증

| # | 항목 | 결과 |
|---|---|---|
| 1 | `/` 가 `/screen` 과 동일 렌더 | standby·cover·결과 **세 상태 모두 DOM 동일**(QR 유무·막대 수·단어 수·배경 src·루트 클래스 일치) |
| 1 | 리다이렉트 없음 | `location.pathname` 이 `/` 로 유지, `navigation` 엔트리 1 → 1 |
| 1 | 소켓 재마운트 없음 | `/` 에서 세션 전환이 **617ms** 만에 반영, 재마운트 0 |
| 2 | `/screen` 회귀 | 기존과 동일 동작 |
| 3 | `/` 에서 NavFab·F 키 | **검증 불가**. 기능이 존재하지 않는다(C 참고) |
| 4 | `/vote` 회귀 | FAB 없음(원래 어디에도 없음), 화면 정상 |
| 5 | Landing 잔재 | 코드 0건, dist 0건 |
| 6 | Preview 갤러리 | 섹션 3개(청중·대형화면·어드민), 프레임 19개, 랜딩 흔적 0 |
| 7 | build·격리·가로 스크롤 | 빌드 통과, dist 격리 유지, `/` 가로 스크롤 0 |

산출물: `client/test-artifacts/simulation/E-root-cover.png`, `E-root-results.png`


## 오프닝 흐름 정리: 표지 우선 + QR 열기 + NavFab (2026-09-20)

### A. 세션 기본 상태를 표지로

기본값이 `standby` 였던 곳은 **DB 컬럼 기본값이 아니라 시드**였다. `supabase/seed.sql` 의
`insert into public.sessions (id, status) values (..., 'standby')` 가 유일한 출처다
(`0001_schema.sql` 의 컬럼 default 도 `'standby'` 이지만 시드가 값을 명시하므로 실제로는 시드가 결정한다).

`seed.sql` 과 `_ALL.sql` 의 시드 값을 `'cover'` 로 바꿨다. **마이그레이션은 만들지 않았다.**
status 의 CHECK 는 0008 에서 이미 `cover` 를 허용하고, 컬럼 default 를 바꿀 필요가 없기 때문이다
(시드가 항상 값을 명시한다).

`_ALL.sql` 에서는 시드 블록을 **맨 뒤로 옮겼다.** 기존 순서(… 0005 → seed → 0006 …)에서는 시드 시점의
CHECK 가 `('standby','live','ended','backup')` 이라 `'cover'` 삽입이 제약 위반으로 실패한다.
0008 뒤로 옮겨야 신규 설치가 성립한다.

**기존 행은 코드가 바꾸지 않는다.** 시드는 `on conflict (id) do nothing` 이다. 운영 DB 에 이미 있던 행은
이번에 직접 UPDATE 해서 `cover` 로 맞춰 두었다(투표 데이터도 0건으로 정리). 나중에 다시 필요하면
SUPABASE.md 의 "시작 상태를 표지로 되돌리기" 절 SQL 을 쓰면 된다.

### B. "QR 열기" 액션

**새 액션을 만들지 않았다.** 기존 `standby` 액션이 이미 "QR 화면으로 보낸다"는 뜻이었고 추가로 바꿔야 할
필드가 없었다. 바뀐 것은 어드민 UI 의 라벨과 배치다.

| 항목 | 전 | 후 |
|---|---|---|
| 버튼 라벨 | "커버 화면" / "대기 화면" (세로로 따로) | "표지 화면" / "QR 열기" (한 행에 나란히, 진행 순서대로) |
| 활성 표시 | 없음 | 현재 상태인 쪽이 blue(prominent) |
| 상태 표기 | `standby: '대기'`, `cover: '커버'` | `cover: '표지'`, `standby: 'QR 공개'` |
| DevControlPanel | "커버로" / "대기로" | "표지 화면" / "QR 열기" |

"대기 화면" 이라는 라벨은 없앴다. 같은 동작을 하는 버튼이 두 개 남지 않게 하나로 합쳤다.

함께 바꾼 것: **전체 초기화의 목적지**를 `standby` → `cover` 로 바꿨다
(`session-actions.js` `resetVotes` scope=all). standby 가 이제 "QR 공개" 를 뜻하므로, 초기화만 했는데
QR 이 저절로 열리면 안 된다.

### C. FAB·F 키가 안 됐던 이유

**버그가 아니라 존재하지 않았다.** 이전 라운드에서 "구현됐다" 고 보고한 적이 없고, 오히려 09-20 전수 재검증에서
NavFab·F 키를 "없음(의도된 미구현)" 으로 보고했다. IA.md 와 ROUTES.md 가 "세 화면은 서로 이동하지 않는다" 를
설계 원칙으로 적고 있어 그때는 만들지 않았다. 이번 지시가 "실행 안 됐으면 그 내용부터 적용" 이라고 명시해서
이번에 새로 만들었다.

신규 파일 `client/src/components/nav/NavFab.jsx` 와 `index.css` 의 `.nav-fab*` 블록.
`App.jsx` 에서 `Routes` 와 형제 레벨에 마운트했다(라우트가 바뀌어도 재마운트되지 않는다).

- 표시 경로: `['/', '/screen', '/admin', '/admin/login']`. `/vote`·`/offline`·404 는 DOM 에 아예 없다.
- 현재 위치: `/` 와 `/screen` 을 같은 화면으로 묶어 "대형화면" 항목이 blue 로 표시된다.
- F 키: 허용 경로에서만 리스너를 등록한다. `input`/`textarea`/`contenteditable` 포커스 중에는 무시하고,
  Cmd·Ctrl·Alt 조합도 무시한다(Cmd+F 찾기를 가로채지 않기 위해).
- 전체화면 중에는 FAB 가 스스로 숨는다. 상태는 `fullscreenchange` 로 따라가므로 ESC 해제도 반영된다.
- **아이콘을 쓰지 않았다.** DESIGN.md 265행이 lucide 를 포함해 모든 아이콘을 금지한다. 라벨은 전부 텍스트다.
  (AGENTS.md 는 "아이콘은 lucide 만" 이라고 쓰지만, 더 구체적인 프로젝트 규정인 DESIGN.md 를 따랐다.)

### 검증

| # | 항목 | 결과 |
|---|---|---|
| 1 | 메인 첫 진입에 표지 | PASS. `/` 에서 QR 없이 표지 3행 렌더 |
| 2 | "QR 열기" → QR 전환 | PASS. **715ms**, 새로고침 없음(navigation 1 유지) |
| 3 | "표지 화면" → 표지 복귀 | PASS. **504ms**, 새로고침 없음 |
| 4 | `/`·`/screen`·`/admin` 에서 FAB | PASS. 메뉴 열림, 현재 위치 blue, 클릭 시 관리자 이동 |
| 5 | F 키 전체화면 | **부분**. 핸들러 실행·`requestFullscreen` 호출까지 확인했으나 이 자동화 브라우저가 `TypeError: not granted` 로 거부(아래 참고). FAB 숨김/복귀 경로는 별도로 검증해 PASS |
| 6 | `/vote` 회귀 | PASS. FAB 없음, F 키 눌러도 호출 0회. 로그인 입력 중 "fff" 는 그대로 입력되고 전체화면 호출 0회 |
| 7 | 빌드·격리·디자인 | PASS. 빌드 통과, dist 격리 0건, 3화면 색 위반 0·가로 스크롤 0·가운뎃점 0, FAB 터치 타깃 44px |

**5번 보충.** 키 이벤트는 정상 도달했고(`key: 'f', target: BODY`) 우리 핸들러가 `requestFullscreen` 을
1회 호출했다. 실패 원인은 브라우저가 사용자 제스처로 인정하지 않는 것이다. 자동화로 만든 **실제 클릭**에서
`requestFullscreen` 을 불러도 똑같이 `TypeError: not granted` 가 났다. 즉 코드 문제가 아니라 이 실행 환경이
Fullscreen API 를 막아둔 것이다. **사람이 실제 브라우저에서 F 를 눌러 한 번 확인해야 한다.**

산출물: `F-1-root-cover-fab.png`, `F-2-fab-menu.png`, `F-3-qr-open.png`, `F-4-fullscreen.png`

## 질문 1 실문안 확정 (2026-09-20)

첫 질문을 더미에서 실제 문안으로 교체했다. 청중 다수가 채용·현업 실무자라, "뽑을 때 아쉬웠던 역량"을
떠올려 고르게 하는 것이 의도다.

**질문**: 미래의 대학이 학생에게 길러줘야 할 역량은?

| 순서 | 라벨 |
|---|---|
| A | 문제 정의력 |
| B | 데이터 활용력 |
| C | 협업과 소통 |
| D | 현장 실무 경험 |

`SOURCE.md` 를 새로 만들어 원문을 두고, `seed.sql` 과 `_ALL.sql` 이 그 텍스트를 문자 그대로 옮기게 했다.
시드는 `on conflict do nothing` 이라 기존 행을 바꾸지 않으므로 운영 DB 의 questions/options 행도 직접 UPDATE 했다.

선택지를 8자 이내로 맞춘 이유는 대형화면 차트의 라벨 열이 `max-content` 라서다. 라벨이 길면 그만큼 막대가
짧아지고, 20m 거리에서는 막대 길이 비교가 먼저 읽혀야 한다.

검증: 폰에서 질문과 선택지 4개 정상 렌더, 대형화면에서 질문이 한 줄에 들어가고 막대 4행 정상, 가로 스크롤 0.
질문 2·3 은 아직 `[더미]` 다.

산출물: `client/test-artifacts/simulation/G-q1-vote.png`, `G-q1-screen.png`

## 결과 막대 갱신 보간 수정 (2026-09-20)

**증상**: 막대가 처음 등장할 때는 자라지만, 표가 추가될 때는 보간 없이 툭 튀었다.

**실측(수정 전)**: A 막대에 1표를 넣고 프레임 단위로 `transform` 을 샘플링했더니 `scaleX` 가
**0 → 1 로 단 한 프레임에 점프**했다(변화 소요 0ms, 변화 지점 1개).

**원인 두 가지** (`index.css` `.bar-fill`)

1. `transition` 에 `transform` 이 없었다. `filter` 만 있었다.
2. 등장 애니메이션이 `animation: bar-grow ... both` 였다. `both` 는 `forwards` 를 포함하므로 애니메이션이
   끝난 뒤에도 계속 값을 잡고 있는다. 키프레임 `to` 가 `scaleX(var(--bar))` 라서 `--bar` 가 바뀌면
   애니메이션 채움값이 즉시 새 값으로 재계산된다. transition 이 끼어들 자리가 없었다.

**수정**: fill-mode 를 `backwards` 로 바꾸고 `transition` 에 `transform` 을 추가했다.
`backwards` 는 지연 구간에서만 `from` 상태를 잡고, 애니메이션이 끝나면 기본 `transform` 으로 돌아온다.
그 뒤 값 변화는 transition 이 맡는다. 등장은 자라고, 갱신은 미끄러진다.

```
before: animation: bar-grow slow out both;
        transition: filter fast standard;
after:  animation: bar-grow slow out backwards;
        transition: transform slow out, filter fast standard;
```

**실측(수정 후)**: 같은 조건에서 `scaleX` 가 **83 프레임에 걸쳐 684ms** 동안 0.037 → 0.500 으로 보간된다.
등장 애니메이션도 그대로다. 첫 프레임 전부 `scaleX 0`, A 막대 고유값 57개로 0 에서 자라고,
막대별 시작 프레임이 3 / 28 로 갈려 stagger 도 유지된다.

새 토큰을 만들지 않았다. 보간 길이는 기존 `durSlow`(700ms), 커브는 기존 `easeOut` 을 그대로 쓴다.
reduced-motion 은 전역 규칙이 transition-duration 까지 0.01ms 로 눌러 그대로 적용된다.

**워드클라우드는 손대지 않았다.** 단어 크기는 `font-size` 라 레이아웃 속성이고, AGENTS.md 1절이
레이아웃 유발 속성 애니메이션을 금지한다. DESIGN.md 도 "즉시 반영" 으로 명시돼 있다. 새로 등장하는 단어의
`cloud-in`(opacity + scale) 은 그대로다.

## 큐시트 반영: 질문 4문항 + 클로징 홍보 화면 (2026-09-20)

### 질문 구조

큐시트대로 4문항으로 재편했다. 원문은 `SOURCE.md` 에 두고 시드와 운영 DB 가 그 텍스트를 문자 그대로 쓴다.

| # | 형식 | 질문 | 선택지 |
|---|---|---|---|
| 1 | 객관식 5점 척도 | 미래 대학으로 가려면 지금의 한국 대학은 얼마나 바뀌어야 하는가? | 바꿀 필요 없음 / 조금 바꾸면 됨 / 절반은 바꿔야 함 / 많이 바꿔야 함 / 전면 재설계 필요 |
| 2 | 객관식 6지 | 미래 대학이 학생에게 길러줘야 할 역량은? | AI와 데이터 활용 / 창의적 사고 / 회복탄력성 / 유연성과 학습역량 / 리더십 / 분석력 |
| 3 | 객관식 5지 | UIA 미래 대학 원칙에 가장 먼저 담을 것은? | 캠퍼스 없는 대학 / 인재상과 입시 변화 / 학점 너머의 경험 / 현장과 전공 간 이동성 / 스스로 설계하는 전공 |
| 4 | 주관식 | UIA가 그리는 미래 대학을 한 단어로 쓴다면? | 워드클라우드 |

질문 2의 선택지는 World Economic Forum 미래 일자리 보고서 핵심역량 항목에서 가져왔다.
질문 3의 라벨은 큐시트 원문을 줄인 것이고, 풀어쓴 의미는 `SOURCE.md` 표에 남겨 사회자가 구두로 설명한다.

운영 DB 의 기존 더미 질문·선택지는 지우고 위 구성으로 교체했다(투표 0건 상태에서 수행).

### 6지선다에서 세로가 잘리던 문제

질문 2를 띄우자 1440x900 기준으로 **세로가 77px 넘쳤다.** 차트 grid 의 `minHeight` 가
`chartRowMin * 행수` 로 고정돼 있어 행이 6개가 되면 패널 높이를 넘겼다. 1920x1080 전체화면에서는
계산상 1056px 로 겨우 들어가지만, 브라우저 주소창이 있는 창 모드에서는 하단이 잘린다.

`minHeight` 에 상한을 씌워 공간이 모자라면 행이 줄어들게 했다.

```
before: minHeight: calc(chartRowMin * items)
after:  minHeight: min(calc(chartRowMin * items), 100%)
```

실측: 수정 후 6지선다 세로 넘침 0, 5지선다 회귀 없음(막대 높이 동일).

### 클로징 홍보 화면

`status` 에 `closing` 을 추가했다(`0009_closing_state.sql`, 비파괴 CHECK 확장, 프로덕션 적용 완료).

- 로고 `client/public/images/wgj-2026.png` (2026 세계경주포럼, 2026.10.8~10.9, 경주화백컨벤션센터 HICO)
- QR 대상 `https://wgjforum.kr/kor/sub03/registration.html` (참가등록). 청중 투표 URL 과 무관한 별도 주소다
- 로고 아래 중앙에 QR. 대기 화면 QR 의 0.62배 크기
- 어드민 "클로징 화면" 버튼, DevControlPanel 과 Preview 프레임에도 추가

실측: 전환 423ms, 새로고침 없음. QR 중앙 정렬, QR 이 로고 아래.

로고 높이 상한을 처음에 `44%` 로 줬더니 1440x900 에서 세로가 34px 넘쳤다. 부모 높이가 확정되지 않은
flex 체인이라 백분율 `max-height` 가 무시된 것이다. 뷰포트 기준 `40vh` 로 바꿔 해결했다(넘침 0).

### 검증

| 항목 | 결과 |
|---|---|
| Q1 5지선다 | 막대 5개, 키 A~E, 가로 스크롤 0 |
| Q2 6지선다 | 막대 6개, 키 A~F, 세로 넘침 0(수정 후) |
| Q3 5지선다 | 막대 5개, 키 A~E |
| Q4 워드클라우드 | 단어 14개, 겹침 0, 최다 1개만 blue, 세로 넘침 0 |
| 클로징 | 로고 + 중앙 하단 QR, 423ms 전환 |
| 어드민 | 질문 4개 + 표지/QR/클로징/종료 버튼 전부 렌더 |

산출물: `J-closing.png`, `J-q2-six.png`(수정 전), `J-q2-fixed.png`(수정 후), `J-q4-cloud.png`
