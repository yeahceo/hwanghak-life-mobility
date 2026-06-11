import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import MapView from './components/MapView';
import TimeChart from './components/TimeChart';
import ModeChart from './components/ModeChart';
import DestTop10 from './components/DestTop10';
import DayToggle from './components/DayToggle';
import CountUp from './components/CountUp';
import { aggregateByDest, modeBreakdown, hourSeries } from './lib/selectors';

const SECTIONS = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const ITEM = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function App() {
  const [datasets, setDatasets] = useState(null); // { weekday, weekend }
  const [day, setDay] = useState('weekday');
  const [hour, setHour] = useState(-1); // -1 = 전체
  const mapRef = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch('data/hwanghak_weekday.json').then((r) => r.json()),
      fetch('data/hwanghak_weekend.json').then((r) => r.json()),
    ]).then(([weekday, weekend]) => setDatasets({ weekday, weekend }));
  }, []);

  const data = datasets?.[day];

  const byDest = useMemo(
    () => (data ? aggregateByDest(data.destinations, hour) : []),
    [data, hour]
  );
  const modes = useMemo(
    () => (data ? modeBreakdown(data.destinations, hour, data.meta.mode_labels) : []),
    [data, hour]
  );
  const series = useMemo(() => (data ? hourSeries(data) : []), [data]);

  const currentTotal = useMemo(
    () => byDest.reduce((s, d) => s + d.value, 0),
    [byDest]
  );

  const handlePickDest = (d) => {
    if (d.dest_lat != null) mapRef.current?.setView([d.dest_lat, d.dest_lon], 14);
  };

  if (!data) return <div className="loading">데이터 불러오는 중…</div>;

  const hourLabel = hour < 0 ? '전체' : `${String(hour).padStart(2, '0')}:00`;

  return (
    <>
      <header>
        <h1>황학동 생활이동</h1>
        <span className="sub">서울시 중구 황학동 출발 · 2026.04</span>
        <span className="spacer" />
        <DayToggle value={day} onChange={setDay} />
      </header>

      <div className="layout">
        <MapView
          byDest={byDest}
          originName={data.meta.origin.name}
          onPickDest={handlePickDest}
          mapRef={mapRef}
        />

        <motion.div
          className="panel"
          variants={SECTIONS}
          initial="hidden"
          animate="show"
          key={day}
        >
          {/* 요약 카드 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">{data.meta.label} 요약</div>
            <div className="summary-cards">
              <div className="card">
                <div className="k">총 이동인구</div>
                <div className="v">
                  <CountUp value={currentTotal} /> <small>명</small>
                </div>
              </div>
              <div className="card">
                <div className="k">도착지 수</div>
                <div className="v">
                  <CountUp value={byDest.length} /> <small>곳</small>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 시간대 슬라이더 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">시간대 필터</div>
            <div className="time-head">
              <div id="time-display">{hourLabel}</div>
              <div className="time-total">
                이동인구 <CountUp value={currentTotal} />명
              </div>
            </div>
            <div className="slider-row">
              <input
                type="range"
                min="0"
                max="23"
                value={hour < 0 ? 0 : hour}
                onChange={(e) => setHour(Number(e.target.value))}
              />
              <button
                className={`btn-all ${hour < 0 ? 'active' : ''}`}
                onClick={() => setHour(-1)}
              >
                전체
              </button>
            </div>
            <div className="slider-legend">
              <span>← 0시</span>
              <span>23시 →</span>
            </div>
          </motion.div>

          {/* 시간대별 차트 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">시간대별 이동인구</div>
            <TimeChart series={series} activeHour={hour} onPickHour={setHour} />
          </motion.div>

          {/* 이동수단 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">
              이동수단 분포 <span className="sub">({hourLabel})</span>
            </div>
            <ModeChart modes={modes} />
          </motion.div>

          {/* 도착지 TOP10 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">
              도착지 TOP 10 <span className="sub">({hourLabel})</span>
            </div>
            <DestTop10 byDest={byDest} onPick={handlePickDest} />
          </motion.div>

          {/* 범례 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="legend">
              <div className="legend-item"><span className="legend-dot" style={{ background: '#ff6b6b' }} /> 황학동 (출발)</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#4ecdc4' }} /> 서울 내 도착</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#ffe66d' }} /> 경기·인천 도착</div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
