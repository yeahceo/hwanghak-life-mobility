import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Dot } from 'recharts';

// 2023~2026 24일 이동인구 추이. 선택한 연도·월 강조, 공휴일(한글날)은 금색 마커.
export default function DailyTrend({ days, activeYear, activeMonth }) {
  const data = days.map((d) => ({
    label: `${d.date.slice(2, 4)}.${parseInt(d.date.slice(4, 6), 10)}/${parseInt(d.date.slice(6), 10)}`,
    full: `${d.date.slice(0, 4)}.${d.date.slice(4, 6)}.${d.date.slice(6)} (${d.dow})${d.holiday ? ` · ${d.holiday}` : ''}`,
    value: Math.round(d.total),
    holiday: !!d.holiday,
    active: d.year === activeYear && d.month === activeMonth,
  }));

  return (
    <div className="chart-wrap" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#21262d" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: '#8b949e', fontSize: 8 }}
            axisLine={{ stroke: '#21262d' }}
            tickLine={false}
            interval={2}
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
            labelFormatter={(_, payload) => payload?.[0]?.payload?.full || ''}
            formatter={(v) => [`${Number(v).toLocaleString()}명`, '유출 이동인구']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#58a6ff"
            strokeWidth={2}
            isAnimationActive
            animationDuration={700}
            dot={(props) => {
              const { cx, cy, payload, index } = props;
              if (payload.holiday) {
                return <Dot key={index} cx={cx} cy={cy} r={5} fill="#ffe66d" stroke="#ffe66d" strokeWidth={2} />;
              }
              return (
                <Dot
                  key={index}
                  cx={cx}
                  cy={cy}
                  r={payload.active ? 4.5 : 2.5}
                  fill={payload.active ? '#58a6ff' : '#1c2330'}
                  stroke="#58a6ff"
                  strokeWidth={1.5}
                />
              );
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
