import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

export default function ModeChart({ modes }) {
  const total = modes.reduce((s, m) => s + m.value, 0);
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
              animationDuration={500}
            >
              {modes.map((m) => (
                <Cell key={m.code} fill={m.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: '#1c2330', border: '1px solid #30363d', borderRadius: 8, fontSize: 12, color: '#e6edf3' }}
              labelStyle={{ color: '#e6edf3' }}
              itemStyle={{ color: '#e6edf3' }}
              formatter={(v, n) => [`${Number(v).toLocaleString()}명`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mode-chips">
        {modes.map((m, i) => (
          <motion.div
            key={m.code}
            className="mode-chip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <span className="dot" style={{ background: m.color }} />
            {m.label}
            <span className="pct">{m.pct.toFixed(0)}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
