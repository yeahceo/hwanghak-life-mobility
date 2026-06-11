import { motion } from 'framer-motion';

// 내·외국인 비율(스택 바) + 외국인 국적 TOP5. [인사이트 18, 19]
export default function NationalityPanel({ inout, nationalities }) {
  const foreignerPct = inout
    .filter((x) => x.label !== '내국인')
    .reduce((s, x) => s + x.pct, 0);

  return (
    <div>
      {/* 내외국인 스택 바 */}
      <div className="stack-bar">
        {inout.map((x) => (
          <motion.div
            key={x.label}
            className="stack-seg"
            style={{ background: x.color }}
            initial={{ width: 0 }}
            animate={{ width: `${x.pct}%` }}
            transition={{ duration: 0.5 }}
            title={`${x.label} ${x.pct.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="stack-legend">
        {inout.map((x) => (
          <span key={x.label} className="stack-legend-item">
            <span className="dot" style={{ background: x.color }} />
            {x.label} {x.pct.toFixed(0)}%
          </span>
        ))}
      </div>
      <div className="foreigner-note">외국인 비중 <b>{foreignerPct.toFixed(1)}%</b></div>

      {/* 외국인 국적 TOP5 */}
      {nationalities.length > 0 && (
        <>
          <div className="sub-title">외국인 국적 TOP5</div>
          <div className="nat-list">
            {nationalities.map((nat, i) => (
              <motion.div
                key={nat.label}
                className="nat-row"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <span className="nat-rank">{i + 1}</span>
                <span className="nat-name">{nat.label}</span>
                <div className="nat-bar-wrap">
                  <motion.div
                    className="nat-bar"
                    initial={{ width: 0 }}
                    animate={{ width: `${nat.pct}%` }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  />
                </div>
                <span className="nat-pct">{nat.pct.toFixed(0)}%</span>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
