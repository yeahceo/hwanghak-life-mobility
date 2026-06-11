// ═══════════════════════════════════════════════════════════════
//  황학동 생활이동 전처리 (2026 전체: 1·4월 × 평일/주말)
//  원본 zip(거대 CSV)에서 황학동(11140670) 출발분만 뽑아
//  도착지 × 시간대 × 이동수단 + 거리/국적/내외국인/집중도 집계
//
//  실행:  node data/preprocess.mjs   (unzip CLI 필요)
//  출력:  public/data/hwanghak_{jan|apr}_{weekday|weekend}.json + hwanghak_daily.json
// ═══════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'data');

const SRC_DIR =
  'c:/Users/yejib/OneDrive/2026-1/07 삼우/15 생활이동/수도권 생활이동 (출도착 행정동별 수단 데이터)';

const ORIGIN_CODE = '11140670'; // 황학동
const ORIGIN = { lat: 37.56853537429577, lon: 127.02084550975484, name: '서울시 중구 황학동' };

// 4개 데이터셋: 월 × 요일. 평일은 월·금 2일, 주말은 일 1일.
const DATASETS = [
  { key: 'jan_weekday', month: '1월', dayType: '평일', label: '1월 평일', dates: ['20260112', '20260116'] },
  { key: 'jan_weekend', month: '1월', dayType: '주말', label: '1월 주말', dates: ['20260118'] },
  { key: 'apr_weekday', month: '4월', dayType: '평일', label: '4월 평일', dates: ['20260413', '20260417'] },
  { key: 'apr_weekend', month: '4월', dayType: '주말', label: '4월 주말', dates: ['20260419'] },
];

// 일별 추이용 6일 (요일 라벨 포함)
const DAILY = [
  { date: '20260112', dow: '월', month: '1월' },
  { date: '20260116', dow: '금', month: '1월' },
  { date: '20260118', dow: '일', month: '1월' },
  { date: '20260413', dow: '월', month: '4월' },
  { date: '20260417', dow: '금', month: '4월' },
  { date: '20260419', dow: '일', month: '4월' },
];

const MODE_LABELS = {
  1: '항공', 2: '기차', 3: '고속버스', 4: '광역버스', 5: '일반버스',
  6: '지하철', 7: '도보', 8: '차량', 9: '기타',
};

// 시간코드 → 시(0~23): 0~23 그대로, HHMM 묶음(700~) → /100
function codeToHour(code) {
  const n = parseInt(code, 10);
  if (Number.isNaN(n)) return null;
  return n <= 23 ? n : Math.floor(n / 100);
}
const pad = (n) => String(n).padStart(2, '0');
const round1 = (x) => Math.round(x * 100) / 100;

// 거리(m) → km 버킷
function distBucket(m) {
  const km = m / 1000;
  if (km < 1) return '0-1';
  if (km < 3) return '1-3';
  if (km < 5) return '3-5';
  if (km < 10) return '5-10';
  if (km < 20) return '10-20';
  return '20+';
}

// 한 날짜의 황학동 출발 행을 누적기(acc)에 더함
async function accumulate(date, acc) {
  const zip = path.join(SRC_DIR, `seoul_trans_admdong3_final_${date}.zip`);
  if (!fs.existsSync(zip)) throw new Error(`zip 없음: ${zip}`);
  const proc = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });

  let first = true;
  let dayTotal = 0;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    if (!line.startsWith(ORIGIN_CODE + ',')) continue;
    const c = line.split(',');
    if (c[0] !== ORIGIN_CODE) continue;

    const destCode = c[4];
    if (destCode === ORIGIN_CODE) continue;
    const hour = codeToHour(c[8]);
    const pop = parseFloat(c[15]);
    if (hour === null || Number.isNaN(pop)) continue;

    const destLat = parseFloat(c[5]);
    const destLon = parseFloat(c[6]);
    const destName = c[7];
    const inout = c[10];
    const nat = c[11];
    const mode = parseInt(c[12], 10);
    const dist = parseFloat(c[13]);
    const tmin = parseFloat(c[14]);

    dayTotal += pop;

    // 도착지
    let d = acc.dests.get(destCode);
    if (!d) {
      d = {
        dest_code: destCode, dest_name: destName,
        dest_lat: Number.isNaN(destLat) ? null : destLat,
        dest_lon: Number.isNaN(destLon) ? null : destLon,
        total: 0, byHour: new Array(24).fill(0), byMode: {},
      };
      acc.dests.set(destCode, d);
    }
    d.total += pop;
    d.byHour[hour] += pop;
    d.byMode[mode] = (d.byMode[mode] || 0) + pop;

    // summary 집계
    acc.hourMode[hour][mode] = (acc.hourMode[hour][mode] || 0) + pop;
    acc.modeTotals[mode] = (acc.modeTotals[mode] || 0) + pop;
    acc.inout[inout] = (acc.inout[inout] || 0) + pop;
    acc.nat[nat] = (acc.nat[nat] || 0) + pop;
    if (!Number.isNaN(dist)) {
      acc.distBuckets[distBucket(dist)] = (acc.distBuckets[distBucket(dist)] || 0) + pop;
      acc.distSum += dist * pop; acc.distW += pop;
    }
    if (!Number.isNaN(tmin)) { acc.timeSum += tmin * pop; acc.timeW += pop; }
  }
  return dayTotal;
}

function emptyAcc() {
  return {
    dests: new Map(),
    hourMode: Array.from({ length: 24 }, () => ({})),
    modeTotals: {}, inout: {}, nat: {}, distBuckets: {},
    distSum: 0, distW: 0, timeSum: 0, timeW: 0,
  };
}

// 국적: 상위 8개 + 나머지 '기타국가'로 합침 (단 '한국','기타'는 원래대로)
function topNationalities(natObj, n = 8) {
  const entries = Object.entries(natObj).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, n);
  const rest = entries.slice(n).reduce((s, [, v]) => s + v, 0);
  const out = Object.fromEntries(top.map(([k, v]) => [k, round1(v)]));
  if (rest > 0) out['기타국가'] = round1((out['기타국가'] || 0) + rest);
  return out;
}

async function buildDataset(ds) {
  const acc = emptyAcc();
  for (const date of ds.dates) await accumulate(date, acc);

  const n = ds.dates.length; // 일평균을 위한 일수
  const avg = (x) => round1(x / n);

  // 도착지: 일평균으로
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

  const out = {
    meta: {
      origin: ORIGIN, origin_code: ORIGIN_CODE,
      month: ds.month, day_type: ds.dayType, label: ds.label,
      dataset_key: ds.key, dates: ds.dates, days_count: n,
      mode_labels: MODE_LABELS,
      hours: Array.from({ length: 24 }, (_, h) => `${pad(h)}:00`),
      generated_at: new Date().toISOString(),
    },
    summary: {
      total_pop: round1(grand),
      dest_count: destinations.length,
      hour_totals: hourTotals.map(round1),
      mode_totals: Object.fromEntries(Object.entries(acc.modeTotals).map(([k, v]) => [k, avg(v)])),
      hour_mode: acc.hourMode.map((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, avg(v)]))),
      dist_buckets: Object.fromEntries(Object.entries(acc.distBuckets).map(([k, v]) => [k, avg(v)])),
      inout: Object.fromEntries(Object.entries(acc.inout).map(([k, v]) => [k, avg(v)])),
      nationality: topNationalities(Object.fromEntries(Object.entries(acc.nat).map(([k, v]) => [k, v / n]))),
      avg_dist: round1(acc.distSum / acc.distW),
      avg_time: round1(acc.timeSum / acc.timeW),
      top3_share: round1((top3 / grand) * 100),
      top10_share: round1((top10 / grand) * 100),
    },
    destinations,
  };

  const outPath = path.join(OUT_DIR, `hwanghak_${ds.key}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(
    `[${ds.key}] ${ds.label} (${ds.dates.join(',')})  일평균 이동인구:${round1(grand).toLocaleString()}  ` +
    `도착지:${destinations.length}  거리avg:${out.summary.avg_dist}m  TOP3:${out.summary.top3_share}%  ` +
    `→ ${path.basename(outPath)} (${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`
  );
}

// 일별 추이: 각 날짜 총 이동인구
async function buildDaily() {
  const rows = [];
  for (const d of DAILY) {
    const acc = emptyAcc();
    const total = await accumulate(d.date, acc);
    rows.push({ date: d.date, dow: d.dow, month: d.month, total: round1(total) });
    console.log(`  daily ${d.date}(${d.dow}): ${round1(total).toLocaleString()}명`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'hwanghak_daily.json'), JSON.stringify({ days: rows }));
}

for (const ds of DATASETS) {
  console.log(`처리: ${ds.label} …`);
  await buildDataset(ds);
}
console.log('일별 추이 …');
await buildDaily();
console.log('완료. JSON 위치:', OUT_DIR);
