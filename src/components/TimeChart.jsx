import { ComposedChart, Bar, Line, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// 시간대별 듀얼 차트: 막대 = 현재 방향, 라인 = 반대 방향
// "평일 18시 유입>유출 역전" 인사이트가 한눈에 보이도록.
export default function TimeChart({ series, activeHour, onPickHour, barName = '이동인구', lineName = null }) {
  const hasLine = lineName && series.some((s) => s.value2 != null);
  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
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
            contentStyle={{ background: '#1c2330', border: '1px solid #30363d', borderRadius: 8, fontSize: 12, color: '#e6edf3' }}
            labelStyle={{ color: '#e6edf3' }}
            itemStyle={{ color: '#e6edf3' }}
            labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
            formatter={(v, name) => [`${Number(v).toLocaleString()}명`, name]}
          />
          <Bar
            dataKey="value"
            name={barName}
            radius={[2, 2, 0, 0]}
            isAnimationActive
            animationDuration={400}
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
          {hasLine && (
            <Line
              dataKey="value2"
              name={lineName}
              type="monotone"
              stroke="#fb923c"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={600}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
