import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export default function TimeChart({ series, activeHour, onPickHour }) {
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <XAxis
            dataKey="hour"
            tick={{ fill: '#8b949e', fontSize: 9 }}
            tickFormatter={(h) => (h % 3 === 0 ? `${h}시` : '')}
            interval={0}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(88,166,255,0.08)' }}
            contentStyle={{ background: '#1c2330', border: '1px solid #30363d', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#8b949e' }}
            labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
            formatter={(v) => [`${Number(v).toLocaleString()}명`, '이동인구']}
          />
          <Bar
            dataKey="value"
            radius={[2, 2, 0, 0]}
            isAnimationActive
            animationDuration={500}
            onClick={(d) => onPickHour?.(d.hour)}
            cursor="pointer"
          >
            {series.map((s) => (
              <Cell
                key={s.hour}
                fill={
                  activeHour < 0
                    ? 'rgba(31,111,235,0.7)'
                    : s.hour === activeHour
                    ? '#58a6ff'
                    : 'rgba(31,111,235,0.25)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
