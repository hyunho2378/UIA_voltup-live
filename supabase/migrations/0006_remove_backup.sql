-- voltup-live · 0006 백업 전환 기능 제거
-- 백업(Slido 전환) 경로를 앱에서 없앴다. status 에서 'backup' 을 되돌린다.
-- 비파괴: 컬럼·행·투표를 지우지 않는다. 남아 있는 'backup' 값만 'standby' 로 정리하고 CHECK 를 축소한다.

update public.sessions set status = 'standby' where status = 'backup';

alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check
  check (status in ('standby','live','ended'));
