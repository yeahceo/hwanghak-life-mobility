import { useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

// 마우스를 따라다니는 glow 스포트라이트 (참고 코드 이식, Tailwind→일반 CSS)
function withOpacity(color, opacity) {
  if (color.startsWith('rgba')) return color.replace(/[\d.]+\)$/, `${opacity})`);
  if (color.startsWith('rgb')) return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export default function Glow({
  glowColor = '#58a6ff',
  glowSize = '240px',
  glowOpacity = 0.18,
  glowFadeAt = '100%',
  className = '',
  style,
  children,
}) {
  const ref = useRef(null);
  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);

  const onMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  };
  const onLeave = () => {
    mx.set(-9999);
    my.set(-9999);
  };

  const glow = useTransform([mx, my], ([x, y]) => {
    const c = withOpacity(glowColor, glowOpacity);
    return `radial-gradient(${glowSize} circle at ${x}px ${y}px, ${c}, transparent ${glowFadeAt})`;
  });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      <motion.div
        style={{ background: glow, position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  );
}
