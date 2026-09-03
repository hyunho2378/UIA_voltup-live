# SUPABASE.md

voltup-live 의 DB·실시간 규약. 백엔드·DB·실시간 작업 시 SESSION_HEADER.md 조건부 목록에 따라 이 문서를 읽는다.

## 스키마

| 테이블 | 역할 | 핵심 제약 |
|---|---|---|
| `sessions` | 단일 제어 행(활성 질문·투표 열림·결과 공개·status) | 고정 id `…0001`, status ∈ standby/live/ended |
| `questions` | 질문 | `type` ∈ choice/text, `order_no` unique |
| `options` | 객관식 선택지 | `(question_id, order_no)` unique |
| `votes` | 투표 | `(question_id, voter_key)` **unique = 중복 차단**, choice/text 정확히 하나 |

마이그레이션은 `supabase/migrations/` 순서대로. 전부 비파괴(CREATE IF NOT EXISTS). 컬럼 추가는 `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. `DROP TABLE/COLUMN`·`TRUNCATE`·`DELETE` 금지. (`DROP TRIGGER/POLICY IF EXISTS` 는 정의만 교체하며 데이터를 파괴하지 않으므로 재적용용으로 허용.)

## 실행 순서

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_results_realtime.sql
supabase/seed.sql            # 개발용 더미. 실문안 확정 시 SOURCE.md 원문으로 교체
```

`supabase db push` 또는 대시보드 SQL Editor 에 위 순서로 붙여넣어 실행. 실행 후 대시보드 → Database → Replication(또는 Realtime)에서 `sessions` 가 `supabase_realtime` publication 에 포함됐는지 육안 확인.

## RLS (권한으로 규율을 강제)

| 테이블 | anon SELECT | anon INSERT | 쓰기 경로 |
|---|---|---|---|
| questions | O | X | 어드민/시드 |
| options | O | X | 어드민/시드 |
| sessions | O | X | **serverless(service_role)** |
| votes | **X** | O(열린 질문만) | 청중 |

- **votes SELECT 정책이 없다** → 원시 votes 는 어떤 클라이언트도 못 읽는다. 집계는 `get_results()`(SECURITY DEFINER)로만 나간다. voter_key 는 DB 밖으로 절대 안 나감.
- votes INSERT 는 `sessions.voting_open=true` 이고 `active_question_id` 가 그 질문일 때만. 옵션은 해당 질문 소속만. 닫힌/남의 질문 투표를 서버에서 차단.
- sessions 쓰기 정책 없음 = anon 쓰기 전면 차단. 어드민 제어는 아래 serverless 경로로만.

## 실시간 채널 규약 (폴링 금지)

원시 votes 를 테이블 스트림으로 뿌리지 않는다(100+ 구독자에 원시행 전송 금지). 두 경로로 나눈다.

**1) 제어 상태 — Postgres Changes on `sessions`**
- 구독: 세 화면 전부.
- `sessions` 1행은 비민감(활성 질문·열림·공개·status)이라 그대로 스트림해도 안전.
```js
supabase.channel('session')
  .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions' },
      ({ new: s }) => applySession(s))
  .subscribe()
```

**2) 결과 집계 — Broadcast on `results:{question_id}`**
- votes AFTER INSERT 트리거가 `realtime.send(payload, 'results', 'results:'||qid, false)` 로 **집계 payload 만** 공개 채널에 broadcast.
- 구독: `/screen`, `/admin` 만(청중 `/vote` 는 결과를 안 본다 → sessions 만 구독).
- payload: `{ results: <get_results 반환>, live_count: int }`.
```js
supabase.channel('results:' + qid, { config: { private: false } })
  .on('broadcast', { event: 'results' }, ({ payload }) => render(payload))
  .subscribe()
```

**초기/재연결 정합성** — broadcast 는 fire-and-forget 이라 구독 직후·재연결 직후 한 번은 반드시 `get_results(qid)` / `get_live_count(qid)` 를 fetch 해 현재 상태를 복원한다(놓친 이벤트 보정). ROUTES.md 딥링크 복원과 동일 원칙.

**질문 전환** — 어드민이 active_question 을 바꾸면 화면은 이전 `results:{old}` 를 unsubscribe 하고 `results:{new}` 를 subscribe + `get_results(new)` fetch.

> `realtime.send` 시그니처 `(payload jsonb, event text, topic text, private boolean)` 는 현재 Supabase 문서 기준. 프로젝트 Supabase 버전에서 함수 존재/시그니처를 최초 1회 확인.

## 집계 함수

- `get_results(q_id uuid) → jsonb` : choice 는 `items:[{option_id,label,order_no,count}]`, text 는 상위 100 단어 `items:[{word,count}]`. 둘 다 `total` 포함.
- `get_live_count(q_id uuid) → int` : 질문 총 응답 수.
- 둘 다 SECURITY DEFINER + anon EXECUTE 부여. 원시행 미노출.

## 어드민 쓰기 경로 (다음 세션에서 구현)

sessions 제어(질문 이동·투표 열기/닫기·결과 공개)와 어드민 인증은 **정적 클라이언트로 불가**. Vercel Serverless Function 필요:

- `client/api/admin-login`   — 패스코드(`ADMIN_PASSCODE`, 서버 전용) 검증 → httpOnly 서명 쿠키 Set-Cookie.
- `client/api/admin-session` — 쿠키 검증 → 200/401. `RequireAdmin` 이 이걸 fetch.
- `client/api/session-control`— 쿠키 검증 후 `SUPABASE_SERVICE_ROLE_KEY`(서버 전용)로 `sessions` UPDATE. anon 은 sessions 를 못 쓰므로 조작 불가.

`ADMIN_PASSCODE`·`SUPABASE_SERVICE_ROLE_KEY` 는 절대 `VITE_` 접두사 금지(번들 노출). `.env.example` 참조.

## 부하 관점

- 트리거는 INSERT 마다 해당 질문 집계 1회 후 broadcast. `votes(question_id, option_id)` 인덱스로 count 저렴.
- 청중 100+ 는 sessions(1행) 만 구독 → 부하 미미. 원시 votes fan-out 없음.
- 필요 시 broadcast 쓰로틀(예: 200ms 병합)은 트리거가 아니라 별도 debounce 계층에서. 현재 규모(100~수백)에선 불필요.
