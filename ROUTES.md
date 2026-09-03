# ROUTES.md

React Router v6.

## 라우트 표

| 경로 | 화면 | 접근 | 가드 |
|---|---|---|---|
| `/` | 랜딩(→ /vote 안내) | 공개 | 없음 |
| `/vote` | 청중 투표 | 공개 | 없음(QR 진입) |
| `/screen` | 대형화면 결과 송출 | 공개 | 없음(무대에서만 사용, 링크 비공개 운용) |
| `/admin/login` | 어드민 패스코드 | 공개 | 이미 인증 시 → /admin |
| `/admin` | 어드민 컨트롤 | 보호 | 미인증 → /admin/login |
| `/offline` | 장애 시 안내 | 공개 | 없음 |
| `*` | 404 | 공개 | 없음 |
| `/preview` | 화면 상태 갤러리 | **DEV 전용** | 라우트 자체가 프로덕션 번들에 없음 |

## 가드

- 어드민 인증은 httpOnly 쿠키 기반. localStorage/sessionStorage 금지.
- `RequireAdmin` 래퍼: 마운트 시 `GET /api/admin-session` 으로 검증하고, 실패 시 `/admin/login` 으로 replace. 확인 전에는 아무것도 렌더하지 않는다.
- **어드민은 `npm run dev:api`(vercel dev)로 테스트한다.** `npm run dev`(vite)는 `client/api/` 를 실행하지 않아 `/admin` 이 항상 로그인으로 튕긴다.
- `/preview` 는 SessionProvider 와 DevControlPanel 바깥에서 렌더한다. 갤러리를 여는 것만으로 realtime 소켓이나 조회가 나가면 안 되기 때문이다. Supabase 요청 0을 유지한다.
- `npm run dev` 에서는 라우트가 아닌 **DevControlPanel**(우하단 고정, DEV 전용)로 세션 상태를 넘긴다. 프로덕션 번들에는 존재하지 않는다. client/README.md 참고.
- `/screen`은 인증 없이 열되, URL을 공개 홍보물에 넣지 않는다(운영 규칙). 결과 조작은 불가능(읽기 전용 구독)하므로 노출돼도 안전.

## SPA 라우팅

- `client/vercel.json` rewrites 필수. 새로고침·직접 진입 404 방지.

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## 딥링크 동작

- `/vote` 직접 진입/새로고침 시 현재 session 상태를 fetch해 올바른 하위 상태(대기/투표/완료/마감)로 복원.
- `/screen` 새로고침 시에도 현재 질문·결과를 즉시 복원.
