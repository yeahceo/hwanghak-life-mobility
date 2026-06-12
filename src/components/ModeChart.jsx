import { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// 선택된 섹터만 밝게, 나머지는 어둡게 — activeShape
function ActiveShape({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill }) {
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius - 4}
      outerRadius={outerRadius + 10}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export default function ModeChart({ modes }) {
  const [activeIdx, setActiveIdx] = useState(null);

  const handleClick = (_, idx) => {
    setActiveIdx((prev) => (prev === idx ? null : idx));
  };

  return (
    <div>
      <div className="chart-wrap" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={modes}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={66}
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationBegin={0}
              animationDuration={280}
              animationEasingType="ease-out"
              activeIndex={activeIdx ?? undefined}
              activeShape={ActiveShape}
              onClick={handleClick}
              style={{ cursor: 'pointer' }}
            >
              {modes.map((m, i) => (
                <Cell
                  key={m.code}
                  fill={m.color}
                  opacity={activeIdx === null ? 1 : activeIdx === i ? 1 : 0.12}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mode-chips">
        <AnimatePresence mode="popLayout">
          {modes.map((m, i) => (
            <motion.div
              key={m.code}
              className="mode-chip"
              onClick={() => handleClick(null, i)}
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{
                opacity: activeIdx === null ? 1 : activeIdx === i ? 1 : 0.25,
                scale: activeIdx === i ? 1.06 : 1,
                y: 0,
              }}
              transition={{ delay: i * 0.03, duration: 0.2, ease: [0.34, 1.56, 0.64, 1] }}
              style={{ cursor: 'pointer' }}
            >
              <span className="dot" style={{ background: m.color }} />
              {m.label}
              <span className="pct">{m.pct.toFixed(0)}%</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
