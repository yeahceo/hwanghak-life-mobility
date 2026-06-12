import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import MapView from './components/MapView';
import TimeChart from './components/TimeChart';
import ModeChart from './components/ModeChart';
import DestTop10 from './components/DestTop10';
import SegToggle from './components/SegToggle';
import CountUp from './components/CountUp';
import Glow from './components/Glow';
import CursorGlow from './components/CursorGlow';
import DistChart from './components/DistChart';
import NationalityPanel from './components/NationalityPanel';
import DailyTrend from './components/DailyTrend';
import {
  aggregateByDest, modeBreakdown, hourSeries,
  distBuckets, inoutShare, nationalityTop,
} from './lib/selectors';

const EASE = [0.25, 0.46, 0.45, 0.94];
const SECTIONS = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } };
// filter:blur는 부모 backdrop-filter(유리)와 충돌해 깜빡임을 유발 → opacity+y만 사용
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 1.1, ease: EASE } },
};

const MONTHS = [{ key: 'jan', label: '1월' }, { key: 'apr', label: '4월' }];
const DAYS = [{ key: 'weekday', label: '평일' }, { key: 'weekend', label: '주말' }];
const DATASET_KEYS = ['jan_weekday', 'jan_weekend', 'apr_weekday', 'apr_weekend'];

export default function App() {
  const [datasets, setDatasets] = useState(null); // { jan_weekday: {...}, ... }
  const [daily, setDaily] = useState(null);
  const [month, setMonth] = useState('apr');
  const [day, setDay] = useState('weekday');
  const [hour, setHour] = useState(-1);
  const mapRef = useRef(null);

  useEffect(() => {
    Promise.all([
      ...DATASET_KEYS.map((k) => fetch(`data/hwanghak_${k}.json`).then((r) => r.json())),
      fetch('data/hwanghak_daily.json').then((r) => r.json()),
    ]).then((results) => {
      const dailyData = results.pop();
      const map = {};
      DATASET_KEYS.forEach((k, i) => (map[k] = results[i]));
      setDatasets(map);
      setDaily(dailyData);
    });
  }, []);

  const data = datasets?.[`${month}_${day}`];

  const byDest = useMemo(() => (data ? aggregateByDest(data.destinations, hour) : []), [data, hour]);
  const modes = useMemo(() => (data ? modeBreakdown(data.summary, hour, data.meta.mode_labels) : []), [data, hour]);
  const series = useMemo(() => (data ? hourSeries(data) : []), [data]);
  const dist = useMemo(() => (data ? distBuckets(data.summary, hour) : []), [data, hour]);
  const inout = useMemo(() => (data ? inoutShare(data.summary, hour) : []), [data, hour]);
  const nats = useMemo(() => (data ? nationalityTop(data.summary, 5, true, hour) : []), [data, hour]);
  const currentTotal = useMemo(() => byDest.reduce((s, d) => s + d.value, 0), [byDest]);

  const handlePickDest = (d) => {
    if (d.dest_lat != null) mapRef.current?.setView([d.dest_lat, d.dest_lon], 14);
  };

  if (!data) return <div className="loading">데이터 불러오는 중…</div>;

  const hourLabel = hour < 0 ? '전체' : `${String(hour).padStart(2, '0')}:00`;
  const monthLabel = month === 'jan' ? '1월' : '4월';

  return (
    <>
      <CursorGlow color="#ffffff" size={260} opacity={0.32} />
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <h1>황학동 생활이동</h1>
        <span className="sub">서울시 중구 황학동 출발 · 2026</span>
        <span className="spacer" />
        <SegToggle options={MONTHS} value={month} onChange={setMonth} layoutId="month-pill" />
        <SegToggle options={DAYS} value={day} onChange={setDay} layoutId="day-pill" />
      </motion.header>

      <div className="layout">
        {/* 지도 래퍼: opacity 애니메이션 제거 — 애니 완료 시 stacking 재계산으로
            패널이 뒤로 들어가던 버그 방지. isolate로 Leaflet z-index도 격리. */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }}>
          <MapView byDest={byDest} originName={data.meta.origin.name} onPickDest={handlePickDest} mapRef={mapRef} />
        </div>

        <motion.div className="panel" style={{ opacity: 1 }} variants={SECTIONS} initial="hidden" animate="show">
          {/* 요약 카드 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">{data.meta.label} 요약 <span className="sub">(일평균)</span></div>
            <div className="summary-cards">
              <Glow className="card" glowColor="#58a6ff" glowSize="180px" glowOpacity={0.22}>
                <div className="k">총 이동인구</div>
                <div className="v"><CountUp value={currentTotal} /> <small>명</small></div>
              </Glow>
              <Glow className="card" glowColor="#4ecdc4" glowSize="180px" glowOpacity={0.22}>
                <div className="k">도착지 수</div>
                <div className="v"><CountUp value={byDest.length} /> <small>곳</small></div>
              </Glow>
              <Glow className="card" glowColor="#ffe66d" glowSize="180px" glowOpacity={0.2}>
                <div className="k">평균 이동거리</div>
                <div className="v"><CountUp value={data.summary.avg_dist / 1000} decimals={1} /> <small>km</small></div>
              </Glow>
              <Glow className="card" glowColor="#a78bfa" glowSize="180px" glowOpacity={0.2}>
                <div className="k">평균 이동시간</div>
                <div className="v"><CountUp value={data.summary.avg_time} /> <small>분</small></div>
              </Glow>
            </div>
          </motion.div>

          {/* 시간대 슬라이더 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">시간대 필터</div>
            <div className="time-head">
              <div id="time-display">{hourLabel}</div>
              <div className="time-total">이동인구 <CountUp value={currentTotal} />명</div>
            </div>
            <div className="slider-row">
              <input type="range" min="0" max="23" value={hour < 0 ? 0 : hour} onChange={(e) => setHour(Number(e.target.value))} />
              <button className={`btn-all ${hour < 0 ? 'active' : ''}`} onClick={() => setHour(-1)}>전체</button>
            </div>
            <div className="slider-legend"><span>← 0시</span><span>23시 →</span></div>
          </motion.div>

          {/* 시간대별 차트 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">시간대별 이동인구</div>
            <TimeChart series={series} activeHour={hour} onPickHour={setHour} />
          </motion.div>

          {/* 이동수단 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">이동수단 분포 <span className="sub">({hourLabel})</span></div>
            <ModeChart modes={modes} />
          </motion.div>

          {/* 이동거리 분포 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">이동거리 분포 <span className="sub">({hourLabel})</span></div>
            <DistChart buckets={dist} />
          </motion.div>

          {/* 내·외국인 / 국적 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">내·외국인 구성 <span className="sub">({hourLabel})</span></div>
            <NationalityPanel inout={inout} nationalities={nats} />
          </motion.div>

          {/* 도착지 TOP10 + 집중도 배지 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">
              도착지 TOP 10 <span className="sub">({hourLabel})</span>
              {hour < 0 && <span className="badge">TOP3 {data.summary.top3_share}% 집중</span>}
            </div>
            <DestTop10 byDest={byDest} onPick={handlePickDest} />
          </motion.div>

          {/* 일별 추이 (맨 아래) */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">2026 일별 이동인구 추이 <span className="sub">({monthLabel} 강조)</span></div>
            {daily && <DailyTrend days={daily.days} activeMonth={monthLabel} />}
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

        {/* 유리 표면 노이즈 (패널 위에 고정) */}
        <div className="noise-overlay" aria-hidden />
      </div>
    </>
  );
}
