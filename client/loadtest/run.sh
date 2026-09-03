#!/usr/bin/env bash
# 50 → 250 스윕. 각 회차 사이 10초 쉬어 연결을 정리한다.
# 사용: QID=<uuid> OPTS=<id,id,id> ./loadtest/run.sh
set -u
: "${QID:?QID 환경변수 필요}"
OPTS="${OPTS:-}"
for N in 50 100 150 200 250; do
  echo "===== n=$N ====="
  node "$(dirname "$0")/vote-storm.mjs" --n="$N" --qid="$QID" --optionIds="$OPTS" || echo "n=$N 실패"
  echo "10초 대기"
  sleep 10
done
