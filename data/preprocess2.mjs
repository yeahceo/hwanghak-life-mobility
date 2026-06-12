// ═══════════════════════════════════════════════════════════════
//  황학동 생활이동 전처리 v2 — 2023/2024 cleaned 데이터, 유출+유입 양방향
//  입력: c:/temp/hwanghak-data/hh_YYYYMMDD.csv (황학동 출발/도착 행 추출본)
//        컬럼: 0출발코드 1출발위도 2출발경도 3출발명 4도착코드 5도착위도 6도착경도
//              7도착명 8출발시간(HH:MM) 9도착시간 10내외국인 11국적 12수단(텍스트)
//              13거리m 14시간분 15인구수
//  출력: public/data/hwanghak_{year}_{month}_{day}_{dir}.json × 24
//        public/data/hwanghak_daily2.json (2023~2024 18일 + 2026 6일 통합)
//
//  기준 통일(기존 2026과 동일): 동 내부 이동(황학동→황학학동)은 destinations에서
//  제외하되 summary.self_total로 별도 집계 (보행 생활권 카드용)
// ═══════════════════════════════════════════════════════════════
import { createReadStream, readFileSync, writeFileSync, statSync } from 'node:fs';
import { createInterface } from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');
const SRC_DIR = 'c:/temp/hwanghak-data';

const HH = '11140670';
const ORIGIN = { lat: 37.56853537429577, lon: 127.02084550975484, name: '서울시 중구 황학동' };

// 12개 데이터셋 (한글날 20231009는 평일 집계에서 제외 — 일별 추이에만 표시)
const DATASETS = [
  { year: '2023', month: 'jan', monthLabel: '1월',  dayType: 'weekday', dayLabel: '평일', dates: ['20230109', '20230113'] },
  { year: '2023', month: 'jan', monthLabel: '1월',  dayType: 'weekend', dayLabel: '주말', dates: ['20230108'] },
  { year: '2023', month: 'apr', monthLabel: '4월',  dayType: 'weekday', dayLabel: '평일', dates: ['20230410', '20230414'] },
  { year: '2023', month: 'apr', monthLabel: '4월',  dayType: 'weekend', dayLabel: '주말', dates: ['20230409'] },
  { year: '2023', month: 'jul', monthLabel: '7월',  dayType: 'weekday', dayLabel: '평일', dates: ['20230710', '20230714'] },
  { year: '2023', month: 'jul', monthLabel: '7월',  dayType: 'weekend', dayLabel: '주말', dates: ['20230709'] },
  { year: '2023', month: 'oct', monthLabel: '10월', dayType: 'weekday', dayLabel: '평일', dates: ['20231013'], note: '한글날(10/9) 제외' },
  { year: '2023', month: 'oct', monthLabel: '10월', dayType: 'weekend', dayLabel: '주말', dates: ['20231008'] },
  { year: '2024', month: 'jan', monthLabel: '1월',  dayType: 'weekday', dayLabel: '평일', dates: ['20240108', '20240112'] },
  { year: '2024', month: 'jan', monthLabel: '1월',  dayType: 'weekend', dayLabel: '주말', dates: ['20240114'] },
  { year: '2024', month: 'apr', monthLabel: '4월',  dayType: 'weekday', dayLabel: '평일', dates: ['20240408', '20240412'] },
  { year: '2024', month: 'apr', monthLabel: '4월',  dayType: 'weekend', dayLabel: '주말', dates: ['20240414'] },
];

const DAILY_META = {
  '20230108': '일', '20230109': '월', '20230113': '금',
  '20230409': '일', '20230410': '월', '20230414': '금',
  '20230709': '일', '20230710': '월', '20230714': '금',
  '20231008': '일', '20231009': '월', '20231013': '금',
  '20240108': '월', '20240112': '금', '20240114': '일',
  '20240408': '월', '20240412': '금', '20240414': '일',
};
const HOLIDAYS = { '20231009': '한글날' };

const round1 = (x) => Math.round(x * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');

function distBucket(m) {
  const km = m / 1000;
  if (km < 1) return '0-1';
  if (km < 3) return '1-3';
  if (km < 5) return '3-5';
  if (km < 10) return '5-10';
  if (km < 20) return '10-20';
  return '20+';
}

function emptyAcc() {
  return {
    dests: new Map(),
    hourMode: Array.from({ length: 24 }, () => ({})),
    hourDist: Array.from({ length: 24 }, () => ({})),
    hourInout: Array.from({ length: 24 }, () => ({})),
    hourNat: Array.from({ length: 24 }, () => ({})),
    modeTotals: {}, inout: {}, nat: {}, distBuckets: {},
    distSum: 0, distW: 0, timeSum: 0, timeW: 0, selfTotal: 0,
  };
}

// 한 날짜 파일을 양방향 누적기에 더함. 반환: { out, in, self } 일 총량
async function accumulate(date, accOut, accIn) {
  const file = path.join(SRC_DIR, `hh_${date}.csv`);
  const rl = createInterface({ input: createReadStream(file, 'utf8'), crlfDelay: Infinity });
  const day = { out: 0, in: 0, self: 0 };

  for await (const line of rl) {
    const c = line.split(',');
    if (c.length < 16) continue;
    const pop = parseFloat(c[15]);
    if (!pop || Number.isNaN(pop)) continue;
    const isOut = c[0] === HH;
    const isIn = c[4] === HH;
    const hour = parseInt(c[8].slice(0, 2), 10);
    if (Number.isNaN(hour)) continue;

    if (isOut && isIn) {
      // 동 내부 이동: destinations 제외, self만 집계
      day.self += pop;
      if (accOut) accOut.selfTotal += pop;
      if (accIn) accIn.selfTotal += pop;
      continue;
    }

    const acc = isOut ? accOut : accIn;
    const dayKey = isOut ? 'out' : 'in';
    if (!acc) continue;
    day[dayKey] += pop;

    // 원격 끝점: 유출이면 도착지(4~7), 유입이면 출발지(0~3)
    const [code, lat, lon, name] = isOut
      ? [c[4], parseFloat(c[5]), parseFloat(c[6]), c[7]]
      : [c[0], parseFloat(c[1]), parseFloat(c[2]), c[3]];

    let d = acc.dests.get(code);
    if (!d) {
      d = {
        dest_code: code, dest_name: name,
        dest_lat: Number.isNaN(lat) ? null : lat,
        dest_lon: Number.isNaN(lon) ? null : lon,
        total: 0, byHour: new Array(24).fill(0), byMode: {},
      };
      acc.dests.set(code, d);
    }
    d.total += pop;
    d.byHour[hour] += pop;
    const mode = c[12];
    d.byMode[mode] = (d.byMode[mode] || 0) + pop;

    acc.hourMode[hour][mode] = (acc.hourMode[hour][mode] || 0) + pop;
    acc.modeTotals[mode] = (acc.modeTotals[mode] || 0) + pop;
    acc.inout[c[10]] = (acc.inout[c[10]] || 0) + pop;
    acc.nat[c[11]] = (acc.nat[c[11]] || 0) + pop;
    acc.hourInout[hour][c[10]] = (acc.hourInout[hour][c[10]] || 0) + pop;
    acc.hourNat[hour][c[11]] = (acc.hourNat[hour][c[11]] || 0) + pop;
    const dist = parseFloat(c[13]);
    if (!Number.isNaN(dist) && dist > 0) {
      const bk = distBucket(dist);
      acc.distBuckets[bk] = (acc.distBuckets[bk] || 0) + pop;
      acc.hourDist[hour][bk] = (acc.hourDist[hour][bk] || 0) + pop;
      acc.distSum += dist * pop; acc.distW += pop;
    }
    const tmin = parseFloat(c[14]);
    if (!Number.isNaN(tmin)) { acc.timeSum += tmin * pop; acc.timeW += pop; }
  }
  return day;
}

function topNationalities(natObj, n = 8) {
  const entries = Object.entries(natObj).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, n);
  const rest = entries.slice(n).reduce((s, [, v]) => s + v, 0);
  const out = Object.fromEntries(top.map(([k, v]) => [k, round1(v)]));
  if (rest > 0) out['기타국가'] = round1((out['기타국가'] || 0) + rest);
  return out;
}

function buildJSON(ds, dir, acc, n) {
  const avg = (x) => round1(x / n);
  const destinations = [...acc.dests.values()]
    .map((d) => ({
      dest_code: d.dest_code, dest_name: d.dest_name,
      dest_lat: d.dest_lat, dest_lon: d.dest_lon,
      total: avg(d.total),
      byHour: d.byHour.map(avg),
      byMode: Object.fromEntries(Object.entries(d.byMode).map(([k, v]) => [k, avg(v)])),
    }))
    .sort((a, b) => b.total - a.total);

  const hourTotals = new Array(24).fill(0);
  for (const d of destinations) d.byHour.forEach((v, h) => (hourTotals[h] += v));
  const grand = destinations.reduce((s, d) => s + d.total, 0) || 1;
  const top3 = destinations.slice(0, 3).reduce((s, d) => s + d.total, 0);
  const top10 = destinations.slice(0, 10).reduce((s, d) => s + d.total, 0);

  return {
    meta: {
      origin: ORIGIN, origin_code: HH,
      year: ds.year, month: ds.monthLabel, day_type: ds.dayLabel,
      direction: dir, // 'out' | 'in'
      label: `${ds.year} ${ds.monthLabel} ${ds.dayLabel}`,
      dataset_key: `${ds.year}_${ds.month}_${ds.dayType}_${dir}`,
      dates: ds.dates, days_count: n, note: ds.note || null,
      mode_labels: {}, // 수단이 텍스트 그대로 — modeBreakdown이 code 그대로 라벨 사용
      hours: Array.from({ length: 24 }, (_, h) => `${pad(h)}:00`),
      generated_at: new Date().toISOString(),
    },
    summary: {
      total_pop: round1(grand),
      dest_count: destinations.length,
      self_total: avg(acc.selfTotal),
      hour_totals: hourTotals.map(round1),
      mode_totals: Object.fromEntries(Object.entries(acc.modeTotals).map(([k, v]) => [k, avg(v)])),
      hour_mode: acc.hourMode.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, avg(v)]))),
      dist_buckets: Object.fromEntries(Object.entries(acc.distBuckets).map(([k, v]) => [k, avg(v)])),
      inout: Object.fromEntries(Object.entries(acc.inout).map(([k, v]) => [k, avg(v)])),
      nationality: topNationalities(Object.fromEntries(Object.entries(acc.nat).map(([k, v]) => [k, v / n]))),
      hour_dist: acc.hourDist.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, avg(v)]))),
      hour_inout: acc.hourInout.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, avg(v)]))),
      hour_nat: acc.hourNat.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, avg(v)]))),
      avg_dist: round1(acc.distSum / (acc.distW || 1)),
      avg_time: round1(acc.timeSum / (acc.timeW || 1)),
      top3_share: round1((top3 / grand) * 100),
      top10_share: round1((top10 / grand) * 100),
    },
    destinations,
  };
}

// ── 데이터셋 빌드 ──
const dailyRows = []; // 일별 추이 (전 날짜)
const dailyDone = new Set();

for (const ds of DATASETS) {
  const accOut = emptyAcc();
  const accIn = emptyAcc();
  for (const date of ds.dates) {
    const day = await accumulate(date, accOut, accIn);
    if (!dailyDone.has(date)) {
      dailyDone.add(date);
      dailyRows.push({
        date, year: ds.year, month: ds.monthLabel, dow: DAILY_META[date],
        total: round1(day.out), in_total: round1(day.in), self: round1(day.self),
        holiday: HOLIDAYS[date] || null,
      });
    }
  }
  const n = ds.dates.length;
  for (const dir of ['out', 'in']) {
    const json = buildJSON(ds, dir, dir === 'out' ? accOut : accIn, n);
    const file = `hwanghak_${ds.year}_${ds.month}_${ds.dayType}_${dir}.json`;
    writeFileSync(path.join(OUT_DIR, file), JSON.stringify(json));
    console.log(
      `[${json.meta.dataset_key}] ${json.meta.label} 총:${Math.round(json.summary.total_pop).toLocaleString()} ` +
      `내부:${Math.round(json.summary.self_total).toLocaleString()} 끝점:${json.summary.dest_count} ` +
      `(${(statSync(path.join(OUT_DIR, file)).size / 1024).toFixed(0)}KB)`
    );
  }
}

// ── 한글날(집계 제외일)도 일별 추이에 포함 ──
for (const [date, name] of Object.entries(HOLIDAYS)) {
  if (dailyDone.has(date)) continue;
  const accOut = emptyAcc();
  const accIn = emptyAcc();
  const day = await accumulate(date, accOut, accIn);
  dailyRows.push({
    date, year: date.slice(0, 4), month: `${parseInt(date.slice(4, 6), 10)}월`, dow: DAILY_META[date],
    total: round1(day.out), in_total: round1(day.in), self: round1(day.self), holiday: name,
  });
  console.log(`daily(공휴일) ${date} ${name}: out ${Math.round(day.out)}`);
}

// ── 2026 기존 daily 병합 ──
try {
  const old = JSON.parse(readFileSync(path.join(OUT_DIR, 'hwanghak_daily.json'), 'utf8'));
  for (const d of old.days) {
    dailyRows.push({ ...d, year: '2026', in_total: null, self: null, holiday: null });
  }
  console.log(`2026 daily ${old.days.length}일 병합`);
} catch (e) {
  console.warn('2026 daily 병합 실패:', e.message);
}

dailyRows.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(path.join(OUT_DIR, 'hwanghak_daily2.json'), JSON.stringify({ days: dailyRows }));
console.log(`완료 — daily2: ${dailyRows.length}일, JSON 위치: ${OUT_DIR}`);
