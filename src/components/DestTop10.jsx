import { motion, AnimatePresence } from 'framer-motion';
import { shortName, isSeoul } from '../lib/selectors';

export default function DestTop10({ byDest, onPick }) {
  const top = byDest.slice(0, 10);
  const max = top[0]?.value || 1;

  return (
    <div className="dest-list">
      <AnimatePresence initial={false}>
        {top.map((d, i) => {
          const pct = (d.value / max) * 100;
          const color = isSeoul(d.dest_code) ? '#4ecdc4' : '#ffe66d';
          return (
            <motion.div
              key={d.dest_code}
              layout
              className="dest-row"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ layout: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }, duration: 0.35 }}
              onClick={() => onPick?.(d)}
            >
              <span className="dest-rank">{i + 1}</span>
              <span className="dest-name" title={d.dest_name}>{shortName(d.dest_name)}</span>
              <div className="dest-bar-wrap">
                <motion.div
                  className="dest-bar"
                  style={{ background: color }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
              <span className="dest-val">{Math.round(d.value).toLocaleString()}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
