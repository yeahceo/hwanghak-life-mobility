import { motion } from 'framer-motion';

// 범용 세그먼트 토글 (슬라이딩 pill). DayToggle/MonthToggle 공용.
export default function SegToggle({ options, value, onChange, layoutId }) {
  return (
    <div className="day-toggle">
      {options.map((o) => (
        <button
          key={o.key}
          className={value === o.key ? 'active' : ''}
          onClick={() => onChange(o.key)}
        >
          {value === o.key && (
            <motion.span
              layoutId={layoutId}
              className="pill"
              style={{ left: 0, right: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
