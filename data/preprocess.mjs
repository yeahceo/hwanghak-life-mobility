// ═══════════════════════════════════════════════════════════════
//  황학동 생활이동 전처리
//  원본 zip(거대 CSV)에서 황학동(11140670) 출발분만 뽑아
//  도착지 × 시간대 × 이동수단으로 집계 → 작은 JSON 출력
//
//  실행:  node data/preprocess.mjs
//  zip은 `unzip -p`로 스트리밍(전체 압축해제 안 함)
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

// 평일(금) / 주말(일)
const DAYS = [
  { key: 'weekday', date: '20260417', label: '평일 (4/17 금)' },
  { key: 'weekend', date: '20260419', label: '주말 (4/19 일)' },
];

// 이동수단 코드 → 라벨 (공식 레이아웃: MOVE_TRANS)
//  수도권 생활이동(수단별) 레이아웃.xlsx 기준
const MODE_LABELS = {
  1: '항공',
  2: '기차',
  3: '고속버스',
  4: '광역버스',
  5: '일반버스',
  6: '지하철',
  7: '도보',
  8: '차량',
  9: '기타',
};

// 시간코드 → 시(0~23) 정규화
//  0~23        : 그대로 (시 단위)
//  700~940     : HHMM 20분 묶음 (피크) → Math.floor(/100)
//  1700~1940   : 동일
function codeToHour(code) {
  const n = parseInt(code, 10);
  if (Number.isNaN(n)) return null;
  if (n <= 23) return n;          // 시 단위
  return Math.floor(n / 100);     // HHMM 묶음 → 시
}

const pad = (n) => String(n).padStart(2, '0');

// 컬럼 인덱스 (헤더 기준)
//  0 출발코드 4 도착코드 5 도착위도 6 도착경도 7 도착명 8 출발시간 12 이동수단 15 이동인구수
async function processDay(day) {
  const zip = path.join(SRC_DIR, `seoul_trans_admdong3_final_${day.date}.zip`);
  if (!fs.existsSync(zip)) throw new Error(`zip 없음: ${zip}`);

  // dest_code -> { name, lat, lon, byHour:Map, byMode:Map, total }
  const dests = new Map();
  // 시간대 × 수단 매트릭스 (정확한 시간대별 수단 분포용): hourMode[hour][modeCode]
  const hourMode = Array.from({ length: 24 }, () => ({}));
  // 검증용 총합
  let grandTotal = 0;
  let rowCount = 0;

  const proc = spawn('unzip', ['-p', zip], { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });

  let first = true;
  for await (const line of rl) {
    if (first) { first = false; continue; } // 헤더 스킵
    if (!line) continue;
    // 빠른 프리필터: 출발코드로 시작하지 않으면 스킵
    if (!line.startsWith(ORIGIN_CODE + ',')) continue;

    const c = line.split(',');
    if (c[0] !== ORIGIN_CODE) continue;

    const destCode = c[4];
    const destLat = parseFloat(c[5]);
    const destLon = parseFloat(c[6]);
    const destName = c[7];
    const hour = codeToHour(c[8]);
    const mode = parseInt(c[12], 10);
    const pop = parseFloat(c[15]);

    if (hour === null || Number.isNaN(pop)) continue;
    if (destCode === ORIGIN_CODE) continue; // 자기 자신 제외

    rowCount++;
    grandTotal += pop;

    let d = dests.get(destCode);
    if (!d) {
      d = {
        dest_code: destCode,
        dest_name: destName,
        dest_lat: Number.isNaN(destLat) ? null : destLat,
        dest_lon: Number.isNaN(destLon) ? null : destLon,
        total: 0,
        byHour: new Array(24).fill(0),
        byMode: {},
      };
      dests.set(destCode, d);
    }
    d.total += pop;
    d.byHour[hour] += pop;
    d.byMode[mode] = (d.byMode[mode] || 0) + pop;
    hourMode[hour][mode] = (hourMode[hour][mode] || 0) + pop;
  }

  // 정리: 도착지별 배열, byHour 반올림
  const round1 = (x) => Math.round(x * 100) / 100;
  const destinations = [...dests.values()]
    .map((d) => ({
      dest_code: d.dest_code,
      dest_name: d.dest_name,
      dest_lat: d.dest_lat,
      dest_lon: d.dest_lon,
      total: round1(d.total),
      byHour: d.byHour.map(round1),
      byMode: Object.fromEntries(
        Object.entries(d.byMode).map(([k, v]) => [k, round1(v)])
      ),
    }))
    .sort((a, b) => b.total - a.total);

  // 전체 시간대별 합계
  const hourTotals = new Array(24).fill(0);
  // 전체 수단별 합계
  const modeTotals = {};
  for (const d of destinations) {
    d.byHour.forEach((v, h) => (hourTotals[h] += v));
    for (const [m, v] of Object.entries(d.byMode)) {
      modeTotals[m] = (modeTotals[m] || 0) + v;
    }
  }

  const out = {
    meta: {
      origin: ORIGIN,
      origin_code: ORIGIN_CODE,
      date: day.date,
      label: day.label,
      day_type: day.key,
      mode_labels: MODE_LABELS,
      hours: Array.from({ length: 24 }, (_, h) => `${pad(h)}:00`),
      generated_at: new Date().toISOString(),
    },
    summary: {
      total_pop: round1(grandTotal),
      row_count: rowCount,
      dest_count: destinations.length,
      hour_totals: hourTotals.map(round1),
      mode_totals: Object.fromEntries(
        Object.entries(modeTotals).map(([k, v]) => [k, round1(v)])
      ),
      // 시간대별 정확한 수단 분포: hour_mode[hour] = { modeCode: cnt }
      hour_mode: hourMode.map((mObj) =>
        Object.fromEntries(Object.entries(mObj).map(([k, v]) => [k, round1(v)]))
      ),
    },
    destinations,
  };

  const outPath = path.join(OUT_DIR, `hwanghak_${day.key}.json`);
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(
    `[${day.key}] ${day.date}  행:${rowCount}  도착지:${destinations.length}  ` +
    `이동인구합:${round1(grandTotal).toLocaleString()}  → ${path.basename(outPath)} ` +
    `(${(fs.statSync(outPath).size / 1024).toFixed(0)}KB)`
  );
}

for (const day of DAYS) {
  console.log(`처리 시작: ${day.key} (${day.date}) …`);
  await processDay(day);
}
console.log('완료. JSON 위치:', OUT_DIR);
