-- voltup-live · 0007 결과 뷰 전환 (막대 ↔ 워드클라우드)
-- 주관식 결과를 대형화면에서 어떤 형태로 그릴지 어드민이 정한다. 집계는 그대로다(같은 데이터, 다른 배치).
-- 비파괴: 컬럼 추가만. 기존 행은 default 'bars' 로 채워진다.

alter table public.sessions add column if not exists results_view text not null default 'bars'
  check (results_view in ('bars','cloud'));
