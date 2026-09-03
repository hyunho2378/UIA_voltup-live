import { Children, useEffect, useRef } from 'react';
import { glass as G, radius as R } from '../../tokens.js';

// radius 는 tokens.radius 의 키. 라이브러리 config 는 px 숫자를 받으므로 여기서 한 번만 변환한다.
const px = (key) => parseFloat(R[key]);

export default function Glass({
  as: Tag = 'div',
  variant = 'regular',
  radius = 'lg',
  button = false,
  tint = null,
  config = {},
  className = '',
  children,
  ...rest
}) {
  const ref = useRef(null);
  const r = px(radius);
  const cfg = { ...G[variant], cornerRadius: r, zRadius: Math.min(G[variant].zRadius, r), button, ...config };
  const json = JSON.stringify(cfg);

  // 라이브러리는 data-config 변경을 MutationObserver 로 읽는다. 값이 바뀌면 재적용.
  useEffect(() => {
    if (ref.current) ref.current.dataset.config = json;
  }, [json]);

  return (
    <Tag
      ref={ref}
      data-glass
      data-config={json}
      className={`glass glass-${variant} ${className}`}
      style={{ borderRadius: R[radius] }}
      {...rest}
    >
      {tint ? <span className="glass-tint" style={{ background: tint }} aria-hidden="true" /> : null}
      {/* 문자열 자식은 텍스트 노드라 z-index 를 못 받는다. 불투명 틴트 아래로 깔리므로 감싼다. */}
      {Children.map(children, (child) =>
        typeof child === 'string' || typeof child === 'number' ? (
          <span className="glass-content">{child}</span>
        ) : (
          child
        ),
      )}
    </Tag>
  );
}
