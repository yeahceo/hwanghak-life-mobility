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
  aggregateByDest, modeBreakdown, hourSeriesDual,
  distBuckets, inoutShare, nationalityTop,
} from './lib/selectors';

const EASE = [0.25, 0.46, 0.45, 0.94];
const SECTIONS = { hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.1 } } };
// filter:blur는 부모 backdrop-filter(유리)와 충돌해 깜빡임을 유발 → opacity+y만 사용
const ITEM = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 1.1, ease: EASE } },
};

const YEARS = [
  { key: '2023', label: '2023' },
  { key: '2024', label: '2024' },
  { key: '2026', label: '2026' },
];
// 연도별 가용 월 (2023은 4개 분기 전부)
const MONTHS_BY_YEAR = {
  2023: [
    { key: 'jan', label: '1월' }, { key: 'apr', label: '4월' },
    { key: 'jul', label: '7월' }, { key: 'oct', label: '10월' },
  ],
  2024: [{ key: 'jan', label: '1월' }, { key: 'apr', label: '4월' }],
  2026: [{ key: 'jan', label: '1월' }, { key: 'apr', label: '4월' }],
};
const DAYS = [{ key: 'weekday', label: '평일' }, { key: 'weekend', label: '주말' }];
const DIRS = [{ key: 'out', label: '유출 ↗' }, { key: 'in', label: '유입 ↘' }];

// 데이터 파일 경로: 2026은 기존 파일(유출만), 2023/2024는 양방향 신규 파일
const fileFor = (year, month, day, dir) =>
  year === '2026'
    ? `data/hwanghak_${month}_${day}.json`
    : `data/hwanghak_${year}_${month}_${day}_${dir}.json`;

export default function App() {
  const [cache, setCache] = useState({});
  const [daily, setDaily] = useState(null);
  const [year, setYear] = useState('2024');
  const [month, setMonth] = useState('apr');
  const [day, setDay] = useState('weekday');
  const [dir, setDir] = useState('out');
  const [hour, setHour] = useState(-1);
  const mapRef = useRef(null);

  // 2026은 유입 데이터 없음 → 유출 강제. 연도 변경 시 가용 월로 클램프.
  const months = MONTHS_BY_YEAR[year];
  useEffect(() => {
    if (year === '2026' && dir === 'in') setDir('out');
    if (!months.some((m) => m.key === month)) setMonth(months[0].key);
  }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const key = `${year}_${month}_${day}_${dir}`;
  const oppDir = dir === 'out' ? 'in' : 'out';
  const oppKey = `${year}_${month}_${day}_${oppDir}`;

  // 레이지 로드 + 캐시 (현재 방향 + 듀얼 차트용 반대 방향)
  useEffect(() => {
    const need = [[key, fileFor(year, month, day, dir)]];
    if (year !== '2026') need.push([oppKey, fileFor(year, month, day, oppDir)]);
    need.forEach(([k, url]) => {
      setCache((c) => {
        if (c[k]) return c;
        fetch(url).then((r) => r.json()).then((j) => setCache((c2) => ({ ...c2, [k]: j })));
        return c;
      });
    });
  }, [key, oppKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch('data/hwanghak_daily2.json').then((r) => r.json()).then(setDaily);
  }, []);

  const data = cache[key];
  const oppData = year !== '2026' ? cache[oppKey] : null;

  const byDest = useMemo(() => (data ? aggregateByDest(data.destinations, hour) : []), [data, hour]);
  const modes = useMemo(() => (data ? modeBreakdown(data.summary, hour, data.meta.mode_labels) : []), [data, hour]);
  const series = useMemo(() => (data ? hourSeriesDual(data, oppData) : []), [data, oppData]);
  const dist = useMemo(() => (data ? distBuckets(data.summary, hour) : []), [data, hour]);
  const inout = useMemo(() => (data ? inoutShare(data.summary, hour) : []), [data, hour]);
  const nats = useMemo(() => (data ? nationalityTop(data.summary, 5, true, hour) : []), [data, hour]);
  const currentTotal = useMemo(() => byDest.reduce((s, d) => s + d.value, 0), [byDest]);

  const handlePickDest = (d) => {
    if (d.dest_lat != null) mapRef.current?.setView([d.dest_lat, d.dest_lon], 14);
  };

  if (!data) return <div className="loading">데이터 불러오는 중…</div>;

  const hourLabel = hour < 0 ? '전체' : `${String(hour).padStart(2, '0')}:00`;
  const monthLabel = months.find((m) => m.key === month)?.label || '';
  const isOut = dir === 'out';
  const endpointWord = isOut ? '도착지' : '출발지';
  const dirWord = isOut ? '유출' : '유입';
  // 동 내부 이동: 2023/2024만 보유 (2026 전처리는 미집계)
  const selfTotal = data.summary.self_total ?? null;
  const selfPct = selfTotal != null ? (selfTotal / (selfTotal + data.summary.total_pop)) * 100 : null;

  return (
    <>
      <CursorGlow color="#ffffff" size={120} opacity={0.45} />
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE }}
      >
        <h1>황학동 생활이동</h1>
        <span className="sub">서울시 중구 황학동 · 2023–2026</span>
        <span className="spacer" />
        <SegToggle options={YEARS} value={year} onChange={setYear} layoutId="year-pill" />
        <SegToggle options={months} value={month} onChange={setMonth} layoutId="month-pill" />
        <SegToggle options={DAYS} value={day} onChange={setDay} layoutId="day-pill" />
        {year !== '2026' && (
          <SegToggle options={DIRS} value={dir} onChange={setDir} layoutId="dir-pill" />
        )}
      </motion.header>

      <div className="layout">
        {/* 지도 래퍼: opacity 애니메이션 제거 — 애니 완료 시 stacking 재계산으로
            패널이 뒤로 들어가던 버그 방지. isolate로 Leaflet z-index도 격리. */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }}>
          <MapView byDest={byDest} originName={data.meta.origin.name} direction={dir} onPickDest={handlePickDest} mapRef={mapRef} />
        </div>

        <motion.div className="panel" style={{ opacity: 1 }} variants={SECTIONS} initial="hidden" animate="show">
          {/* 요약 카드 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">{data.meta.label || `${monthLabel} ${day === 'weekday' ? '평일' : '주말'}`} {dirWord} 요약 <span className="sub">(일평균)</span></div>
            <div className="summary-cards">
              <Glow className="card" glowColor="#58a6ff" glowSize="180px" glowOpacity={0.22}>
                <div className="k">{dirWord} 이동인구</div>
                <div className="v"><CountUp value={currentTotal} /> <small>명</small></div>
              </Glow>
              <Glow className="card" glowColor="#4ecdc4" glowSize="180px" glowOpacity={0.22}>
                <div className="k">동 내부 이동</div>
                {selfPct != null ? (
                  <div className="v"><CountUp value={selfPct} decimals={1} /> <small>%</small></div>
                ) : (
                  <div className="v">— <small>미집계</small></div>
                )}
              </Glow>
              <Glow className="card" glowColor="#ffe66d" glowSize="180px" glowOpacity={0.2}>
                <div className="k">평균 이동거리</div>
                <div className="v"><CountUp value={data.summary.avg_dist / 1000} decimals={1} /> <small>km</small></div>
              </Glow>
              <Glow className="card" glowColor="#a78bfa" glowSize="180px" glowOpacity={0.2}>
                <div className="k">{endpointWord} 수</div>
                <div className="v"><CountUp value={byDest.length} /> <small>곳</small></div>
              </Glow>
            </div>
            {selfPct != null && (
              <div className="insight-note">이동의 {selfPct.toFixed(0)}%가 동을 벗어나지 않는 도보 생활권 — 2024년 들어 더 강해지는 중</div>
            )}
          </motion.div>

          {/* 시간대 슬라이더 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">시간대 필터</div>
            <div className="time-head">
              <div id="time-display">{hourLabel}</div>
              <div className="time-total">{dirWord} <CountUp value={currentTotal} />명</div>
            </div>
            <div className="slider-row">
              <input type="range" min="0" max="23" value={hour < 0 ? 0 : hour} onChange={(e) => setHour(Number(e.target.value))} />
              <button className={`btn-all ${hour < 0 ? 'active' : ''}`} onClick={() => setHour(-1)}>전체</button>
            </div>
            <div className="slider-legend"><span>← 0시</span><span>23시 →</span></div>
          </motion.div>

          {/* 시간대별 차트: 유출 막대 + 유입 라인 듀얼 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">
              시간대별 이동인구
              {oppData && <span className="sub">막대 {dirWord} · 선 {isOut ? '유입' : '유출'}</span>}
            </div>
            <TimeChart
              series={series}
              activeHour={hour}
              onPickHour={setHour}
              barName={dirWord}
              lineName={oppData ? (isOut ? '유입' : '유출') : null}
            />
            {oppData && day === 'weekday' && (
              <div className="insight-note">유입의 피크는 8시가 아닌 18시 — 아침에 비워지고 저녁에 채워지는 동네</div>
            )}
          </motion.div>

          {/* 이동수단 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">이동수단 분포 <span className="sub">({hourLabel})</span></div>
            <ModeChart modes={modes} />
            <div className="insight-note">
              {isOut
                ? '도보가 18일 내내 1위(최대 40%) — 시장 골목 보행 생활권'
                : day === 'weekend'
                  ? '주말 유입은 차량이 도보를 추월 — 차 타고 오는 광역 손님'
                  : '평일 유입도 도보·지하철 중심 — 근거리 생활권 방문'}
            </div>
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
            {year !== '2026' && (
              <div className="insight-note">2023→2024 단기외국인 -28% · 장기(정주)외국인 +48% — 정주 커뮤니티로 구조 전환 중</div>
            )}
          </motion.div>

          {/* 도착지/출발지 TOP10 + 집중도 배지 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">
              {endpointWord} TOP 10 <span className="sub">({hourLabel})</span>
              {hour < 0 && <span className="badge">TOP3 {data.summary.top3_share}% 집중</span>}
            </div>
            <DestTop10 byDest={byDest} onPick={handlePickDest} />
            <div className="insight-note">왕십리도선동·신당동과 양방향 1·2위 — 행정동 경계를 넘는 생활권 트라이앵글</div>
          </motion.div>

          {/* 일별 추이 (맨 아래) — 2023~2026 24일 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="section-title">일별 이동인구 추이 <span className="sub">(2023–2026 · ◆ 공휴일)</span></div>
            {daily && <DailyTrend days={daily.days} activeYear={year} activeMonth={monthLabel} />}
            <div className="insight-note">봄·가을 일요일이 가장 붐비고, 한글날(23.10.9)은 오후 피크 최고치의 '슈퍼 일요일'</div>
          </motion.div>

          {/* 범례 */}
          <motion.div className="panel-section" variants={ITEM}>
            <div className="legend">
              <div className="legend-item"><span className="legend-dot" style={{ background: '#ff6b6b' }} /> 황학동</div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: isOut ? '#4ecdc4' : '#a78bfa' }} />
                서울 {isOut ? '도착' : '출발'}
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: isOut ? '#ffe66d' : '#fb923c' }} />
                경기·인천 {isOut ? '도착' : '출발'}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* 유리 표면 노이즈 (패널 위에 고정) */}
        <div className="noise-overlay" aria-hidden />
      </div>
    </>
  );
}
