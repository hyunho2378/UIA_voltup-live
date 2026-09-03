-- voltup-live · 0005 sessions.status 에 'backup' 추가
-- 비파괴: CHECK 제약만 확장한다. status 값이나 컬럼을 지우지 않는다.

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended','backup'));
