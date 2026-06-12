import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

// 화면 전역 마우스 추적 글로우.
// position:fixed + pointer-events:none → 지도/버튼 등 모든 인터랙션을 막지 않음.
export default function CursorGlow({ color = '#58a6ff', size = 420, opacity = 0.12 }) {
  const mx = useMotionValue(-9999);
  const my = useMotionValue(-9999);
  // 살짝 지연되어 따라오는 부드러운 추적
  const sx = useSpring(mx, { stiffness: 90, damping: 26, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 90, damping: 26, mass: 0.6 });

  useEffect(() => {
    const move = (e) => {
      mx.set(e.clientX);
      my.set(e.clientY);
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, [mx, my]);

  const background = useTransform([sx, sy], ([x, y]) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // 중심을 또렷하게: 밝은 코어 → 빠르게 투명
    return `radial-gradient(${size}px circle at ${x}px ${y}px, rgba(${r},${g},${b},${opacity}) 0%, rgba(${r},${g},${b},${opacity * 0.55}) 20%, rgba(${r},${g},${b},${opacity * 0.15}) 50%, transparent 70%)`;
  });

  return (
    <motion.div
      aria-hidden
      style={{
        background,
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        mixBlendMode: 'screen',
      }}
    />
  );
}
