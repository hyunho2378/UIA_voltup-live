# SESSION_HEADER.md

이 프로젝트의 모든 Claude Code 작업 프롬프트는 아래 헤더로 시작한다. 복사해서 맨 앞에 붙인다.

```
아래 작업을 순서대로 실행해라.
세션 시작. 작업 전 아래 파일을 순서대로 전부 읽어라.

[표준 — 항상]
1. CLAUDE.md
2. .claude/skills/fullstack-product-setup/SKILL.md

[프로젝트 문서 — 항상]
3. DESIGN.md
4. client/src/tokens.js
5. IA.md
6. ROUTES.md
7. COMPONENTS.md
8. PATTERNS.md
9. PROGRESS.md

[작업 성격에 따라 — 해당하면 반드시]
- 백엔드·DB·실시간(Supabase) 작업 → SUPABASE.md (스키마·채널 규약)
- 실제 질문 문안 시드 작업 → SOURCE.md (원문, 문자 그대로)
```

## 문서 경로 확정본
- DESIGN.md — 프로젝트 루트
- IA.md / ROUTES.md / COMPONENTS.md / PATTERNS.md / PROGRESS.md — 프로젝트 루트
- tokens.js — client/src/tokens.js
- SUPABASE.md — 프로젝트 루트 (스키마·RLS·채널 규약). 정본 SQL은 supabase/migrations/, 실행용 단일 파일은 supabase/_ALL.sql
- SKILL.md — .claude/skills/fullstack-product-setup/SKILL.md

## 갱신 규칙
- 문서를 새로 만들거나 이름을 바꾸면 이 파일을 즉시 갱신한다.
- 이 목록에 없는 문서를 근거로 삼지 않는다.
- Supabase 스키마를 확정하면 SUPABASE.md를 만들어 위 조건부 목록과 연결한다.
