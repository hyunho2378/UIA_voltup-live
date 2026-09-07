// 디자인 판단용 샘플. 실제 확정 문안이 아니다.
// 9/9~9/10 문안이 확정되면 SOURCE.md 원문 그대로 시드하고 이 파일은 /preview 용으로만 남긴다.
// seed.sql 의 [더미] 질문과는 별개다. 여기 값은 DB 로 가지 않는다.

export const sampleQuestions = [
  {
    id: 's1',
    order_no: 1,
    type: 'choice',
    title: '첫 직장을 고른다면 무엇을 가장 크게 볼까요?',
    options: [
      { id: 's1a', order_no: 1, label: '배울 기회' },
      { id: 's1b', order_no: 2, label: '연봉' },
      { id: 's1c', order_no: 3, label: '워라밸' },
      { id: 's1d', order_no: 4, label: '회사 성장성' },
    ],
  },
  {
    id: 's2',
    order_no: 2,
    type: 'choice',
    title: '임팩트를 만들고 싶은 영역은 어디에 가까운가요?',
    options: [
      { id: 's2a', order_no: 1, label: '지역사회' },
      { id: 's2b', order_no: 2, label: '교육' },
      { id: 's2c', order_no: 3, label: '환경' },
      { id: 's2d', order_no: 4, label: '기술' },
    ],
  },
  {
    id: 's3',
    order_no: 3,
    type: 'choice',
    title: '지금 나에게 더 필요한 건 무엇일까요?',
    options: [
      { id: 's3a', order_no: 1, label: '실행력' },
      { id: 's3b', order_no: 2, label: '방향 설정' },
      { id: 's3c', order_no: 3, label: '네트워크' },
      { id: 's3d', order_no: 4, label: '자금' },
    ],
  },
  {
    id: 's4',
    order_no: 4,
    type: 'choice',
    title: '신입에게 더 중요한 강점은 무엇일까요?',
    options: [
      { id: 's4a', order_no: 1, label: '바로 쓰는 실무 능력' },
      { id: 's4b', order_no: 2, label: '새 상황에 대응하는 능력' },
    ],
  },
  { id: 's5', order_no: 5, type: 'text', title: '오늘 세션을 한 단어로 남긴다면?' },
  { id: 's6', order_no: 6, type: 'text', title: '1년 뒤의 나에게 한 문장을 보낸다면?' },
];

// 주관식 응답 원본. 중복 포함 15개. 빈도 막대가 실제로 어떻게 보이는지 확인용.
const textAnswers = [
  '연결', '용기', '연결', '방향', '시작', '연결', '용기', '실행',
  '방향', '연결', '시작', '가능성', '용기', '연결', '방향',
];

// 워드클라우드용. 막대 뷰는 단어 수가 늘면 행이 그만큼 늘어 읽기 어려워지므로 목록을 따로 둔다.
// 실제 행사 규모(응답 100+)에서 나올 법한 분포: 1등이 뚜렷하고 꼬리가 길다.
const cloudAnswers = [
  ...Array(18).fill('연결'),
  ...Array(13).fill('용기'),
  ...Array(11).fill('방향'),
  ...Array(9).fill('실행'),
  ...Array(8).fill('가능성'),
  ...Array(6).fill('시작'),
  ...Array(5).fill('성장'),
  ...Array(4).fill('질문'),
  ...Array(4).fill('사람'),
  ...Array(3).fill('임팩트'),
  ...Array(3).fill('현장'),
  ...Array(2).fill('책임'),
  ...Array(2).fill('지속가능'),
  '기회', '태도', '균형', '호기심',
];

const tally = (words) => {
  const m = new Map();
  for (const w of words) m.set(w, (m.get(w) ?? 0) + 1);
  return [...m.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
};

const choiceResults = (q, counts) => ({
  question_id: q.id,
  type: 'choice',
  total: counts.reduce((a, b) => a + b, 0),
  items: q.options.map((o, i) => ({
    option_id: o.id,
    label: o.label,
    order_no: o.order_no,
    count: counts[i],
  })),
});

// 최상단에서 호출하지 않고 함수로 둔다. 모듈에 실행문이 있으면 rollup 이
// 순수하다고 판정하지 못해 DEV 게이트로 지워도 프로덕션 번들에 남는다.
export function buildMocks() {
  return {
    results: {
      // 박빙: 1등과 2등이 한 표 차
      close: choiceResults(sampleQuestions[0], [34, 33, 29, 32]),
      // 압도적 1등
      landslide: choiceResults(sampleQuestions[1], [96, 14, 11, 7]),
      // 주관식 빈도
      text: { question_id: 's5', type: 'text', total: textAnswers.length, items: tally(textAnswers) },
      cloud: { question_id: 's5', type: 'text', total: cloudAnswers.length, items: tally(cloudAnswers) },
    },
    counts: { close: 128, landslide: 128, text: textAnswers.length, cloud: cloudAnswers.length },
  };
}
