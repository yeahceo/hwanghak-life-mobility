import { motion } from 'framer-motion';

const DAYS = [
  { key: 'weekday', label: '평일' },
  { key: 'weekend', label: '주말' },
];

export default function DayToggle({ value, onChange }) {
  return (
    <div className="day-toggle">
      {DAYS.map((d) => (
        <button
          key={d.key}
          className={value === d.key ? 'active' : ''}
          onClick={() => onChange(d.key)}
        >
          {value === d.key && (
            <motion.span
              layoutId="day-pill"
              className="pill"
              style={{ left: 0, right: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{d.label}</span>
        </button>
      ))}
    </div>
  );
}
