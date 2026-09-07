// /screen 이 "지금 무엇을 그릴 수 있는가"를 정하는 두 판단.
// Screen.jsx 와 loadtest/verify.mjs 가 이 함수를 그대로 쓴다.
// 하네스가 자기 복사본을 검사하면 앱을 증명한 게 아니라 하네스를 증명한 것이 된다.

/** 도착한 broadcast payload 를 지금 질문의 것으로 받아들일지. */
export const acceptsBroadcast = (qid, payload) =>
  Boolean(qid) && payload?.results?.question_id === qid;

/** 화면에 그릴 집계. 질문과 집계의 question_id 가 맞을 때만 그린다. */
export const visibleResults = (question, results) =>
  results && question && results.question_id === question.id ? results : null;
