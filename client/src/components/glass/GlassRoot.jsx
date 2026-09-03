import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { LiquidGlass } from '../../vendor/liquidglass/index.js';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function prefersReduced() {
  return (
    matchMedia('(prefers-reduced-transparency: reduce)').matches ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * 규칙: Glass 컴포넌트는 반드시 GlassRoot 의 "직계 자식" DOM 이어야 한다(라이브러리 제약).
 * 중간에 래퍼 div 를 두지 마라. 페이지 안에서 글래스 패널을 mount/unmount 하지 말고
 * 패널은 유지한 채 내용만 바꿔라(대기→투표→완료는 같은 패널 안에서 내용 교체).
 * root 의 non-glass 자식은 배경 <img> 하나뿐이어야 한다. 텍스트는 전부 Glass 안에 둔다.
 */
// GlassModeProvider value='css' 는 /preview 전용이다. 한 페이지에 패널이 20개쯤 뜨면
// WebGL 컨텍스트 한도(브라우저당 약 16)를 넘겨 오래된 것부터 죽는다.
// Preview 는 레이아웃, 타이포, 색, 모션을 보는 도구라 CSS 글래스로 고정한다.
// 실제 재질은 /vote /screen /admin 실 라우트에서 본다.
const ForcedMode = createContext(null);
export const GlassModeProvider = ForcedMode.Provider;

export default function GlassRoot({ background, panelKey = 'default', className = '', children }) {
  const forceMode = useContext(ForcedMode);
  const rootRef = useRef(null);
  const [mode, setMode] = useState('css');


  useEffect(() => {
    if (forceMode) {
      setMode(forceMode);
      if (forceMode === 'css') return undefined;
    }
    const useGL = hasWebGL() && !prefersReduced();
    setMode(useGL ? 'webgl' : 'css');
    if (!useGL) return undefined;

    let alive = true;
    let instance = null;
    const root = rootRef.current;
    const glassElements = root.querySelectorAll(':scope > [data-glass]');

    LiquidGlass.init({ root, glassElements }).then((inst) => {
      if (!alive) {
        inst.destroy();
        return;
      }
      instance = inst;
      if (import.meta.env.DEV) window.__lg = inst;
    });

    return () => {
      alive = false;
      if (instance) instance.destroy();
    };
  }, [panelKey, forceMode]);

  return (
    <div ref={rootRef} className={`glass-root ${className}`} data-glass-mode={mode}>
      <img className="glass-bg" src={background} alt="" aria-hidden="true" />
      {children}
    </div>
  );
}
