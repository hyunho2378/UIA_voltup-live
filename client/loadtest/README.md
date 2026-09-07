# loadtest

가상 청중 N명을 띄워 "몇 명에서 무너지는가"를 숫자로 확정한다.

## 경고

**프로덕션 Supabase 프로젝트에 돌리지 마라.** 이 스크립트는 실제 동시 연결과 초당 메시지를 소모하고 votes 에 행을 쓴다.
별도 테스트 프로젝트를 쓰거나, 최소한 행사 전 리허설 시간대에만 돌린다.
`SUPABASE_SECRET_KEY` 가 `.env` 에 있으면 끝나고 자기가 넣은 투표를 지운다(`voter_key LIKE 'loadtest-<ts>-%'`).

## 무료 티어 한도(합격/불합격 기준선)

| 항목 | 한도 |
|---|---|
| 동시 연결 | 200 |
| 초당 메시지 | 100 |
| 초당 채널 조인 | 100 |
| broadcast payload | 256KB |

## 실행

```bash
# 단발
node loadtest/vote-storm.mjs --n=100 --qid=<question uuid> --optionIds=<opt,opt,opt>

# 스윕 50 → 250
QID=<question uuid> OPTS=<opt,opt,opt> ./loadtest/run.sh
```

url/key 는 `client/.env` 에서 자동으로 읽는다. 다른 프로젝트로 쏘려면 `--url` `--key` `--secret` 을 직접 준다.

| 인자 | 기본 | 뜻 |
|---|---|---|
| `--n` | 100 | 동시 투표자 수 |
| `--rampMs` | 3000 | 이 시간 안에 무작위 시점으로 투표가 흩어진다 |
| `--subscribeResults` | true | 투표자도 results 채널을 구독(최악 부하). `false` 면 실제 청중과 같음 |
| `--cleanup` | true | 끝나고 자기 투표 삭제(secret 키 필요) |

투표자 수와 별개로 관측자 클라이언트 1개가 항상 붙어 서버가 실제로 쏘는 broadcast 비율을 잰다.

## 지표 읽는 법

- `channels.subscribed / channels.target` — 조인 성공률. 1 미만이면 연결 또는 조인 한도.
- `insert.ok / duplicate / closed / other` — `closed`(42501)가 많으면 투표가 열려 있지 않은 것이다. 테스트 전에 `open_voting` 을 해라.
- `broadcast.초당최대` — **쓰로틀 검증 핵심.** 0004 적용 후에는 10 이하로 눌려야 한다. 그보다 크면 트리거가 안 걸린 것이다.
- `broadcast.final수신` — `close_voting` 을 같이 돌렸을 때만 true.
- `errors` — `too_many_connections`, `tenant_events`, `too_many_joins` 원문이 여기 쌓인다. 하나라도 나오면 그 N 이 한계다.

## 합격 기준

- 목표 **150명까지**: SUBSCRIBED 성공률 100%, `tenant_events` 0, INSERT 성공률 99% 이상 → 통과.
- 관측 초당 broadcast 가 쓰로틀로 **10 이하**로 눌리는지 확인. 안 눌리면 0004 트리거를 다시 확인한다.
- `too_many_connections` 또는 `tenant_events` 가 **처음 나오는 N** 을 기록하고, 그 값의 **70%** 를 행사 안전선으로 삼는다.
- 예상 청중이 안전선을 넘으면 안전선 안으로 들어올 때까지 질문 수를 줄이거나 투표 창을 나눠 연다.

## 리포트

`loadtest/reports/report-<n>-<ts>.json` 에 쌓인다. 커밋하지 않아도 된다.

## verify.mjs — 실시간 정합성 검증

부하가 아니라 **정합성**을 본다. 연결은 10개 미만만 쓴다.

```
node loadtest/verify.mjs --url=<테스트URL> --key=<publishable> --secret=<secret>
node loadtest/verify.mjs --env=.env.test
```

`client/.env` 와 같은 프로젝트면 거부한다(`--allow-prod` 로만 통과). 검증은 votes 를 지우고 세션을 건드리므로
**반드시 테스트 전용 프로젝트**에서 돌린다.

| 케이스 | 확인 |
|---|---|
| 1 전환 정합성 | Q2 활성 이후 Q1 집계가 그려진 프레임 0 |
| 2 늦은 broadcast | Q1 payload 를 Q2 상태에서 거부(`acceptsBroadcast`) |
| 3 초기화 | 질문 단위 → final:true 0집계 수신·다른 질문 보존 / 전체 → votes 0·standby |
| 4 중복 | 같은 질문 재투표 23505, 다른 질문은 허용 |
| 5 마감 | close_voting 후 42501, final 정확히 1회 |
| 6 재연결 | 끊긴 사이 들어온 표가 재진입 RPC 로 반영 |
| 7 유실 관측 | 단건 투표 20회 broadcast 수신률 |

판단은 하네스가 따로 하지 않는다. `src/lib/screen-state.js` 의 `acceptsBroadcast` / `visibleResults` 와
`api/_lib/session-actions.js` 를 **앱과 같은 함수로 import** 해서 태운다. 결과는 `loadtest/reports/verify-report.json`.
