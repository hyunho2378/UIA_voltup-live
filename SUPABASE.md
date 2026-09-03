# SUPABASE.md

voltup-live 백엔드 규약. 정본 SQL은 `supabase/migrations/`, 실행 편의용 단일 파일은 `supabase/_ALL.sql`.

## 비파괴 원칙

- `CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 만 쓴다.
- `DROP TABLE` / `DROP COLUMN` / `TRUNCATE` 금지. 트리거·정책의 `DROP ... IF EXISTS`는 재생성 직전에만 허용.
- 마이그레이션은 여러 번 실행해도 결과가 같아야 한다.

## 스키마

| 테이블 | 핵심 컬럼 | 비고 |
|---|---|---|
| `questions` | id, order_no(unique), type(choice/text), title | 질문 순서는 order_no |
| `options` | id, question_id, order_no, label | unique(question_id, order_no) |
| `sessions` | id, active_question_id, voting_open, results_visible, status(standby/live/ended), updated_at | 제어 행 1개만 운용 |
| `votes` | id, question_id, option_id, text_value, voter_key, created_at | unique(question_id, voter_key) |

- `votes_one_answer` 체크: `option_id`와 `text_value`는 정확히 하나만 채운다.
- `sessions.updated_at`은 `touch_updated_at` 트리거가 자동 갱신.

## RLS

anon(청중)에게 허용되는 것은 이것뿐이다.

| 테이블 | SELECT | INSERT | UPDATE/DELETE |
|---|---|---|---|
| questions | 허용 | 없음 | 없음 |
| options | 허용 | 없음 | 없음 |
| sessions | 허용 | 없음 | 없음 |
| votes | **없음** | 조건부 허용 | 없음 |

- `votes` SELECT 정책이 없다. 원시 votes는 클라이언트가 절대 못 읽는다. 집계는 SECURITY DEFINER RPC 경유만.
- `votes_insert_open` 정책 조건: `sessions.voting_open = true` 이고 `sessions.active_question_id = 대상 질문`, 그리고 `option_id`가 그 질문 소속일 것. 즉 마감된 질문·다른 질문에는 서버가 INSERT를 거부한다.
- 어드민 쓰기(sessions 제어, 질문 편집)는 정책이 없다. **secret 키를 쓰는 serverless 함수**로만 수행한다. secret 키는 절대 프론트 번들에 넣지 않는다(`VITE_` 접두사 금지).

## 집계 RPC

- `get_results(q_id uuid) -> jsonb`
  - choice: `{ question_id, type:'choice', total, items:[{option_id,label,order_no,count}] }` (order_no 순, 0표 옵션 포함)
  - text: `{ question_id, type:'text', total, items:[{word,count}] }` (소문자·trim 후 집계, 빈도 내림차순 상위 100)
  - 없는 질문: `{ question_id, type:null, total:0, items:[] }`
- `get_live_count(q_id uuid) -> int` 해당 질문 응답 수.
- 둘 다 `security definer` + `grant execute to anon, authenticated`.

## 실시간 채널 규약

| 용도 | 방식 | 토픽 | 이벤트 |
|---|---|---|---|
| 제어 상태 | Postgres Changes | `session` (table `public.sessions`) | `*` |
| 결과 집계 | Broadcast | `results:{question_id}` | `results` |

- `votes` 테이블은 Realtime publication에 넣지 않는다. 100명이 붙어도 원시 row가 방송되지 않게 하기 위함.
- 결과는 `votes` INSERT 트리거 `broadcast_vote_results`가 `realtime.send(payload, 'results', 'results:{qid}', false)`로 집계만 방송한다. payload는 `{ results, live_count }`.
- broadcast는 유실될 수 있다. **초기 진입과 재연결 시 반드시 `get_results` / `get_live_count`로 보정한다.** 구독만으로 상태를 만들지 않는다.
- 채널 status → UI 상태 매핑은 `client/src/lib/supabase.js`의 `mapChannelStatus` 하나만 쓴다. SUBSCRIBED=connected, CHANNEL_ERROR/TIMED_OUT=reconnecting, 그 외=disconnected.

## voter_key (중복 투표 차단)

- localStorage/sessionStorage 금지 규율 때문에 브라우저 식별자는 **쿠키 `vk`**(path=/, max-age 86400, samesite=lax).
- 최종 차단선은 DB의 `unique(question_id, voter_key)`. 클라이언트는 `23505`를 '이미 투표함'으로 해석한다.
- 시크릿 창·쿠키 삭제로 우회 가능한 best-effort다. 행사 성격상 이 수준으로 충분하다고 판단. 더 강한 차단이 필요하면 익명 인증(auth.uid)으로 올린다.

## 환경변수

| 이름 | 위치 | 노출 |
|---|---|---|
| `VITE_SUPABASE_URL` | client/.env | 브라우저 노출 OK |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client/.env | 브라우저 노출 OK (RLS가 방어선) |
| `VITE_VOTE_SHORT_URL` | client/.env | 브라우저 노출 OK |
| `ADMIN_PASSCODE` | 서버 환경변수 | 노출 금지 |
| `ADMIN_COOKIE_SECRET` | 서버 환경변수 | 노출 금지 |
| `SUPABASE_SECRET_KEY` | 서버 환경변수 | 노출 금지 |

`VITE_` 접두사가 붙은 값은 전부 번들에 박힌다. 비밀에 붙이지 않는다.

## 적용 절차

1. Supabase 프로젝트 생성.
2. Project Settings > API 에서 URL / publishable key / secret key 복사 → `client/.env`.
3. SQL Editor 에 `supabase/_ALL.sql` 전체 붙여넣고 Run.
4. Database > Replication 에서 `supabase_realtime` publication 에 `sessions` 포함 확인. `votes`는 포함되면 안 된다.
