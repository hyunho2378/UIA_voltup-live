import { Fragment } from 'react';
import { koLines } from '../../lib/ko-break.js';

// 한국어 제목과 라벨 렌더. 관형사 접착 + " / " 마커 줄바꿈.
export default function Ko({ children }) {
  const lines = koLines(children);
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </>
  );
}
