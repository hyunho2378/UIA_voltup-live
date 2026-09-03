# voltup-live client

React 18 + Vite + Tailwind(tokens override) + Supabase. 프론트와 serverless 함수(`api/`)가 한 폴더에 있고 Vercel 프로젝트 루트가 여기다.

## 로컬 실행 3가지 모드

| 명령 | 되는 것 | 안 되는 것 | 언제 쓰나 |
|---|---|---|---|
| `npm run dev` | 프론트 전부. Supabase 실시간. **DevControlPanel** 로 세션 상태 조작 | `/api/*` 미실행 → `/admin` 은 항상 `/admin/login` 으로 튕김 | 화면 만들고 확인할 때. 대부분의 작업 |
| `npm run dev:api` | 실제 `/api/*` + 어드민 로그인. 행사 당일과 같은 경로 | `vercel login` 필요 | 어드민 인증·세션 제어를 실제 경로로 검증할 때 |
| `npm run build` / `npm run preview` | 프로덕션 빌드 확인. DevControlPanel 없음 | `/api/*` 미실행 | 번들 크기, 트리셰이킹, 프로덕션 화면 확인 |

`npm run dev` 로는 어드민에 못 들어간다. 그래서 DevControlPanel 이 있다.

## DevControlPanel (개발 전용)

`npm run dev` 일 때만 우하단에 뜨는 솔리드 다크 패널. 현재 세션 상태를 보여주고 투표 열기/닫기, 결과 공개/숨기기, 다음 질문, 대기로, 백업을 누를 수 있다.

- 어드민 인증을 우회한다. **`import.meta.env.DEV` 게이트 안에서만 마운트되고 프로덕션 번들에는 문자열조차 남지 않는다.**
- 쓰기는 `POST /__dev__/session-control` 로 간다. 이 엔드포인트는 `vite.config.js` 의 `apply:'serve'` 플러그인이라 dev 서버에만 존재한다.
- 제어 로직은 `api/_lib/session-actions.js` 하나를 프로덕션 `api/session-control.js` 와 공유한다. dev 에서 통과한 동작이 프로덕션에서 달라지지 않는다.
- anon 은 RLS 로 sessions 를 못 쓰므로 이 경로도 서버에서 secret 키를 쓴다. RLS 를 느슨하게 푸는 방식(dev 전용 정책)은 프로덕션과 같은 DB 를 쓰는 동안 채택하지 않는다.

## /preview 갤러리 (개발 전용)

`npm run dev` 에서 `http://localhost:5173/preview`. 20개 화면 상태를 목업으로 한 페이지에 실물 렌더한다.
세션을 조작하지 않아도 모든 상태를 동시에 볼 수 있어 디자인을 반복해서 보기 좋다.

- Supabase 를 호출하지 않는다. SessionProvider 와 DevControlPanel 바깥에서 렌더한다.
- 재질은 CSS 글래스 고정. 실제 WebGL 재질은 실 라우트에서 확인한다.
- 데이터는 `src/mock/sample-questions.js`. 실제 문안이 아니라 디자인 판단용 샘플이다.
- 프로덕션 번들에는 라우트도 목업도 남지 않는다.

## 그 밖의 스크립트

| 명령 | 하는 일 |
|---|---|
| `npm run bg` | `tokens.ambient` 를 읽어 배경 SVG/WebP 재생성. 산출물은 커밋한다 |
| `node loadtest/vote-storm.mjs --n=100 --qid=...` | 부하 테스트. `loadtest/README.md` 참고 |

## 배포 (Vercel 하나)

`/vote` `/screen` `/admin` 은 한 앱의 세 라우트다. Vercel 이 프론트(Vite build)와 `api/` serverless 를 한 번에 배포한다. 다른 호스팅은 필요 없다. 백업(Slido)만 남의 링크다.

| 항목 | 값 |
|---|---|
| **Root Directory** | **`client`** (이걸 안 바꾸면 빌드 실패한다) |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

### 환경변수 (전부 Production 스코프)

| 이름 | 값 | 노출 |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL | 브라우저 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | 브라우저 (RLS 가 방어선) |
| `VITE_VOTE_SHORT_URL` | 배포 URL + `/vote` | 브라우저 |
| `VITE_BACKUP_URL` | Slido 등 백업 주소 | 브라우저 |
| `SUPABASE_URL` | `VITE_SUPABASE_URL` 과 같은 값 | 서버 전용 |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | **노출 금지** |
| `ADMIN_PASSCODE` | 행사용 패스코드 | **노출 금지** |
| `ADMIN_COOKIE_SECRET` | 32자 이상 랜덤 (`openssl rand -base64 32`) | **노출 금지** |

`VITE_` 접두사가 붙은 값은 전부 브라우저 번들에 박힌다. 비밀에는 절대 붙이지 않는다.

**환경변수를 바꾸면 Redeploy 해야 반영된다.** 빌드 시점에 번들로 들어가기 때문이다. `VITE_VOTE_SHORT_URL` 은 배포 URL 이 나온 뒤에 채우고 다시 배포한다. 비워두면 `/screen` QR 이 `location.origin + '/vote'` 로 폴백한다.

### 라우팅

`vercel.json` 의 rewrite 는 `/((?!api/).*)` 다. `/api/*` 를 먼저 빠져나가게 해서 SPA fallback 이 serverless 함수를 삼키지 않는다.

`api/_lib/` 는 밑줄로 시작해 Vercel 이 함수로 만들지 않는다. 공용 모듈 자리다.

### 프로덕션에 없는 것

DevControlPanel, `/preview`, `src/mock/`, `/__dev__/session-control` 은 전부 `import.meta.env.DEV` 게이트와 `apply:'serve'` 플러그인 안에 있어 프로덕션 번들에 문자열조차 남지 않는다. 배포 전 `npm run build` 후 `dist` grep 으로 매번 확인한다.

## 환경변수

`.env.example` 참고. `VITE_` 접두사가 붙은 값은 전부 브라우저 번들에 박힌다. 비밀에는 절대 붙이지 않는다.
