# AGENTS.md — TOEIC 학습 웹앱 에이전트 규율

이 프로젝트에서 코드를 만지는 모든 에이전트가 따르는 고정 규칙.
개인용 정규 TOEIC(L&R) 학습 웹앱. 노베이스 → 720 → 900+. 단일 사용자, 비공개.

---

## 1. 절대 금지 (빌드/리뷰에서 0건 유지)
- TypeScript 금지 — JavaScript + JSX만.
- localStorage / sessionStorage 금지 — 상태는 서버/DB, 인증은 httpOnly 쿠키.
- 색·간격·폰트·radius·z-index 하드코딩 금지 — 반드시 tokens.js 경유. tailwind는 override라 토큰 밖 값은 클래스 자체가 존재하지 않는다(`bg-slate-500`, `p-7`, `z-[9999]` 불가).
- 이모지 아이콘 금지 — lucide-react만.
- em-dash 금지 — 코드·UI 카피 전부.
- hover에 `scale()` 금지 — press 피드백만 허용하고 값은 `tokens.motion.pressScale`(= `active:scale-press`) 하나만 쓴다. 문서에 숫자를 다시 적지 않는다.
- layout/paint 유발 속성 애니메이션 금지 — `transform`·`opacity`(및 필요 시 `filter`)만.
- `transition: all` / `transition-all` 금지 — 바뀌는 속성만 명시한다.
- 리퀴드 글래스(WebGL)는 이 프로젝트의 /vote /screen /admin 전 화면에 허용한다. 조건:
  (1) 글래스 위 콘텐츠는 DOM 텍스트·컨트롤이며 굴절 대상이 아니다.
  (2) WebGL 불가 또는 prefers-reduced-transparency 시 CSS 글래스로 폴백해야 한다.
  (3) 한 화면의 읽기 부하는 질문 1개 + 선택지 수준을 넘지 않는다. 긴 본문 화면이 생기면 그 화면만 글래스를 쓰지 않는다.
- 네이티브 `<select>`·`<input type="date">` 노출 금지 — 커스텀 컴포넌트.
- 임의 z-index 금지 — tokens.zIndex 경유.

## 2. 토큰 단일 원천
- **원본은 `client/src/tokens.js`.** 루트 tokens.js는 값 사본이 아니라 재수출(포인터)만 한다. 값이 두 곳으로 갈라진 이력이 있으므로 이 순서를 절대 어기지 않는다.
- 새 토큰이 필요하면 tokens.js에 추가하고 DESIGN.md를 같은 커밋에서 갱신한다. 문서 없는 토큰, 토큰 없는 문서를 만들지 않는다.

## 3. UX 카피 규약 (한국어)
- 명사형 종결(슬라이드·라벨), 능동태, 주어-서술어 순, 불필요한 조사 제거.
- 사실만. 과장·감탄 금지. em-dash·이모지 금지.

## 4. 반응형 · 접근성
- 320~3840px 전 구간 유동. 크기는 clamp/minmax, 브레이크포인트는 구조 전환에만.
- 학습 본문 폭 상한(contentMax), 독해 지문은 readingMax 행폭 제한.
- 퀴즈 상태는 색만으로 전달 금지 — 아이콘+텍스트 병행.
- focus-visible 링 필수, 터치 타깃 44px, reduced-motion/transparency/contrast 3종 대응.
- 타이머·점수는 tabular-nums.

## 5. AI 생성물 규율 (문항·지문·리스닝 스크립트)
- 생성은 tool use 구조화 출력으로만. 스키마: `stem, choices[4], answer_index, grammar_point, difficulty, explanation_ko, distractor_rationale[3]`.
- 생성 후 검증 파이프라인 통과분만 DB 풀에 적재: ① 정답 유일성 재검증 → ② 문법 정확성 → ③ 오답 매력도 → ④ 보기 순서 무작위화(정답 위치 균등).
- 생성=배치, 풀이=풀에서 서빙. 런타임 실시간 생성 지양(비용·지연). 생성 실패 시 캐시 풀로 대체해 흐름 유지.
- 런타임 입력(외부 API 응답·AI 생성물)은 받는 즉시 스키마 검증(예: zod). "그럴듯하게 틀린" 생성물을 코드가 막는다.

## 6. 오픈 자원 출처 표기
- 어휘 NGSL/TSL: Browne & Culligan, CC BY-SA 4.0 — 출처 표기 유지.
- 예문 Tatoeba: CC BY 2.0 FR — 표기 유지, 오류 문장 필터링 전제.
- Kokoro TTS: Apache 2.0. 라이선스 상충 자원(Coqui 모델 상업 제약 등) 개인용 한정.

## 7. 보안 · 시크릿
- `DATABASE_URL`·`ANTHROPIC_API_KEY` 등 시크릿은 `server/.env`(로컬)·배포처 환경변수(Render)에만. 저장소·문서·채팅·프론트에 노출 금지.
- 개인·민감 정보를 URL 쿼리스트링에 넣지 않는다.
- 배포 cross-origin 쿠키: production 분기에서 sameSite 'none' + secure + trust proxy.

## 8. 세션 워크플로
- 모든 작업은 SESSION_HEADER.md 규약으로 연다(표준 문서 선독).
- 작업은 PROGRESS.md의 "현재 다음 작업"부터. 완료 시 PROGRESS.md에 완료·진행중·다음 기록.
- 컨텍스트 85% 도달 시 PROGRESS.md 갱신 후 대기.
- 한 번에 여러 Phase를 몰아 만들지 않는다. 단계마다 빌드·검증·확인.

## 9. 검증 체크리스트 (각 작업 완료 시)
- [ ] client `npm run build` 성공, 미검출 utility 경고 0
- [ ] 금지 항목 grep 0건(HEX·TS·localStorage·hover:scale·네이티브 select/date·layout 애니 속성·임의 z-index·이모지·`transition-all`·학습 표면 글래스)
- [ ] 토큰 실측 일치(색·타이포 튜플·z·max-w·easing)
- [ ] server 기동·엔드포인트 응답, client 딥링크 200, 프록시 통과
- [ ] 320~3840 레이아웃 무결(뷰포트 확인 가능 시), 가로 스크롤 0

## 10. 커밋 규약 (이 프로젝트)
- 태그: `feat` `fix` `chore` `docs` `refactor` `style`.
- 스코프: `vocab` `grammar` `reading` `listening` `mock` `review` `stats` `core` `server` `db`.
- 예: `feat(vocab): FSRS 카드 상태 스키마와 세션 채점`. em-dash 금지, 한국어 명사형 요약 허용.