-- voltup-live · 0012 경주포럼 화면을 별도 상태로 분리
--
-- 지금까지 'closing' 하나가 2026 세계경주포럼 홍보 화면이었다. 이제 마지막 순서가 둘로 나뉜다.
--   'wgj'     = 2026 세계경주포럼 홍보(로고 + 참가등록 QR). 기존 closing 내용 그대로.
--   'closing' = 새로 만드는 클로징 화면. 청중이 사진을 찍는 배경이라 디자인이 완전히 다르다.
-- 값 이름을 바꾸지 않고 'wgj' 를 더하는 이유: 이미 'closing' 을 쓰는 코드·문서가 있어
-- 이름을 옮기면 그 사이에 배포된 클라이언트가 빈 화면을 만난다.
--
-- 비파괴: CHECK 제약만 확장한다. 기존 값·행을 지우지 않는다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby', 'live', 'ended', 'cover', 'closing', 'wgj'));
