import Glass from './Glass.jsx';
import { colors } from '../../tokens.js';

// prominent: 바탕을 solid tokens.blue 로 채운다. 글래스는 가장자리 하이라이트와 press 만 담당한다.
// 반투명 틴트는 배경에 따라 대비가 흔들려서 쓰지 않는다. disabled 는 틴트를 아예 얹지 않는다.
export default function GlassButton({ prominent = false, disabled = false, className = '', children, ...rest }) {
  return (
    <Glass
      as="button"
      type="button"
      variant={prominent ? 'prominent' : 'regular'}
      radius="pill"
      button={!disabled}
      tint={prominent && !disabled ? colors.blue : null}
      disabled={disabled}
      aria-disabled={disabled}
      className={`glass-btn ${prominent ? 'glass-btn-prominent' : ''} ${className}`}
      {...rest}
    >
      <span className="glass-btn-label">{children}</span>
    </Glass>
  );
}
