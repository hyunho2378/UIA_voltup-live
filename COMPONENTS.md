# COMPONENTS.md

경로 기준: `client/src/`. 모든 색·간격·폰트는 tokens.js 경유. TypeScript 금지, JSX만.

## 공용 (components/common)
- **`Button.jsx`** — variant: primary / ghost / danger. press scale(0.97). 최소 높이 44(청중 56).
- **`ConnectionBadge.jsx`** — 실시간 연결 상태(connected / reconnecting / disconnected). 우상단 고정. 색: success / warning / danger.
- **`QRBlock.jsx`** — 투표 링크 QR + 짧은 주소 텍스트. 대형화면 대기/투표 중에 표시. qrcode 라이브러리로 생성.
- **`EmptyState.jsx`** — unDraw 일러스트 + 안내문. 대기/종료 상태.
- **`Toast.jsx`** — 투표 완료, 오류 알림. z-index toast.

## 청중 (components/vote)
- **`OptionButton.jsx`** — 객관식 선택지. 미선택/선택/제출됨 3상태. 높이 56 이상.
- **`TextVoteInput.jsx`** — 주관식(워드클라우드용) 입력. 짧은 단어 위주, 글자 수 제한. 네이티브 input 스타일 제거하고 커스텀.
- **`VoteWaiting.jsx`** — 투표 대기 화면.
- **`VoteDone.jsx`** — 제출 완료. "대형화면에서 결과를 확인하세요".
- **`VoteClosed.jsx`** — 마감 안내.

## 대형화면 (components/screen)
- **`ResultBars.jsx`** — 객관식 실시간 막대. transform: scaleX로 성장. 퍼센트+득표수 크게. 최다 득표 강조.
- **`WordCloud.jsx`** — 주관식 빈도 클라우드. 빈도순 크기 매핑, 색 2단. 다색 금지.
- **`ScreenQuestion.jsx`** — 질문 대형 표시(Screen Question 타이포).
- **`ScreenStandby.jsx`** — 슬로건 + QR + 접속 안내.
- 커버(오프닝) 상태 — 별도 파일이 아니라 `Screen.jsx` 내부 `CoverPlate`. 결과 패널과 같은 배경·Glass 재사용,
  eyebrow 2행 + 타이틀만(QR·버튼 없음). 이미 있는 파일 목록과 달리 실제 Screen.jsx 는 이 모든 하위 컴포넌트를
  한 파일에 인라인으로 둘다(QrPlate/WordCloud/BarChart 동일). 이 문서의 파일 목록은 설계 의도를 보여주는 참고이고
  실제 구조와 1:1이 아니다.
- **`LiveCount.jsx`** — 응답 수 실시간 표시.

## 내비게이션 (components/nav)
- **`NavFab.jsx`** 운영자 전용 이동 도구. 우하단 고정. 기본은 "메뉴" 캡슐 하나이고 누르면 대형화면·관리자·투표 화면
  목록이 열린다. 현재 위치 항목은 blue 필. `/`, `/screen`, `/admin`, `/admin/login` 에서만 마운트되고
  `/vote`·`/offline`·404 에는 DOM 에 존재하지 않는다(pathname 판정). F 키 전체화면 토글도 이 컴포넌트가 들고 있다.
  전체화면 중에는 스스로 숨는다. 아이콘 금지 규칙에 따라 라벨은 전부 텍스트다.

## 어드민 (components/admin)
- **`QuestionList.jsx`** — 질문 목록, 현재 질문 표시, 클릭으로 이동.
- **`SessionControls.jsx`** — 투표 열기/닫기, 결과 공개/숨김, 다음/이전.
- **`LiveMonitor.jsx`** — 접속자 수, 응답 수, 연결 상태.
- **`PasscodeForm.jsx`** — 어드민 진입 패스코드(커스텀 인풋).

## 레이아웃 (components/layout)
- **`VoteLayout.jsx`** — max-width 430 중앙, safe-area 패딩, 하단 고정 제출 버튼 영역.
- **`ScreenLayout.jsx`** — 다크 배경 풀블리드, 대형화면 최대폭 스케일.
- **`AdminLayout.jsx`** — 사이드 컨트롤 + 메인 모니터, 1280 기준.

## 반응형 변형 메모
- OptionButton: 320에서도 텍스트 2줄까지 줄바꿈 허용, 잘림 없음.
- ResultBars: 3840에서 막대 두께·폰트 함께 확대, 여백 과다 방지.
- AdminLayout: 768 미만에서 사이드 컨트롤을 상단 접힘으로 전환(진행자가 폰으로 급히 볼 때 대비).
