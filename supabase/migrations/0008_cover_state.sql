-- voltup-live · 0008 sessions.status 에 'cover' 추가
-- 대형화면에 모듈 시작을 알리는 오프닝(커버) 상태 하나를 더한다.
-- 비파괴: CHECK 제약만 확장한다. 기존 값·행을 지우지 않는다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended','cover'));
