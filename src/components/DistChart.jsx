import { motion } from 'framer-motion';

// 거리대 분포 가로 막대 (단거리 집중도 강조). [인사이트 12]
export default function DistChart({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.pct), 1);
  return (
    <div className="dist-list">
      {buckets.map((b, i) => (
        <div className="dist-row" key={b.key}>
          <span className="dist-label">{b.label}</span>
          <div className="dist-bar-wrap">
            <motion.div
              className="dist-bar"
              initial={{ width: 0 }}
              animate={{ width: `${(b.pct / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
            />
          </div>
          <span className="dist-pct">{b.pct.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}
