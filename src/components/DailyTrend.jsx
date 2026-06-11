import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';

// 6일 이동인구 추이 (4월>1월, 금>월 트렌드). 현재 월 강조.
export default function DailyTrend({ days, activeMonth }) {
  const data = days.map((d) => ({
    name: `${d.month.replace('월', '')}/${d.date.slice(6)}\n${d.dow}`,
    label: `${d.date.slice(4, 6)}/${d.date.slice(6)}(${d.dow})`,
    value: Math.round(d.total),
    month: d.month,
    active: d.month === activeMonth,
  }));

  return (
    <div className="chart-wrap" style={{ height: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8b949e', fontSize: 9 }}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tick={{ fill: '#8b949e', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
          />
          <Tooltip
            contentStyle={{ background: '#1c2330', border: '1px solid #30363d', borderRadius: 8, fontSize: 12, color: '#e6edf3' }}
            labelStyle={{ color: '#e6edf3' }}
            itemStyle={{ color: '#e6edf3' }}
            formatter={(v) => [`${Number(v).toLocaleString()}명`, '이동인구']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#58a6ff"
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
            dot={(props) => {
              const { cx, cy, payload } = props;
              return (
                <Dot
                  cx={cx}
                  cy={cy}
                  r={payload.active ? 5 : 3}
                  fill={payload.active ? '#58a6ff' : '#1c2330'}
                  stroke="#58a6ff"
                  strokeWidth={2}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
