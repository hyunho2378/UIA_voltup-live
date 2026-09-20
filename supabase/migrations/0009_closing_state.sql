-- voltup-live · 0009 sessions.status 에 'closing' 추가
-- 마지막 순서에 띄우는 홍보 화면(2026 세계경주포럼 로고 + 참가등록 QR).
-- 비파괴: CHECK 제약만 확장한다. 기존 값·행을 지우지 않는다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended','cover','closing'));
