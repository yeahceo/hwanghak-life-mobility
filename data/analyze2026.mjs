// 2026년 황학동 출발 데이터 6일치 종합 분석 (인사이트용)
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'c:/Users/yejib/OneDrive/2026-1/07 삼우/15 생활이동/수도권 생활이동 (출도착 행정동별 수단 데이터)';
const ORIGIN = '11140670';

const DAYS = [
  { date: '20260112', dow: '월', month: '1월', type: '평일' },
  { date: '20260116', dow: '금', month: '1월', type: '평일' },
  { date: '20260118', dow: '일', month: '1월', type: '주말' },
  { date: '20260413', dow: '월', month: '4월', type: '평일' },
  { date: '20260417', dow: '금', month: '4월', type: '평일' },
  { date: '20260419', dow: '일', month: '4월', type: '주말' },
];

const MODE = { 1:'항공',2:'기차',3:'고속버스',4:'광역버스',5:'일반버스',6:'지하철',7:'도보',8:'차량',9:'기타' };
const codeToHour = (c) => { const n=parseInt(c,10); if(Number.isNaN(n))return null; return n<=23?n:Math.floor(n/100); };

// 누적 구조
const perDay = {};            // date -> {total, rows}
const destAgg = {};           // destCode -> {name, total, lat, lon, seoul}
const hourAgg = {};           // hour -> total (전체 평균용, 평일/주말 분리)
const hourByType = { 평일:new Array(24).fill(0), 주말:new Array(24).fill(0) };
const modeByType = { 평일:{}, 주말:{} };
const modeTotal = {};
const inoutTotal = {};        // 내외국인 -> total
const natTotal = {};          // 국적 -> total
const destByType = { 평일:{}, 주말:{} };
const monthTotal = { '1월':0, '4월':0 };
let distSum = 0, distW = 0;   // 가중 평균 거리
let timeSum = 0, timeW = 0;   // 가중 평균 이동시간
const distBuckets = {};       // 거리대(km) -> 인구

async function processDay(day) {
  const zip = path.join(SRC, `seoul_trans_admdong3_final_${day.date}.zip`);
  const proc = spawn('unzip', ['-p', zip], { stdio: ['ignore','pipe','inherit'] });
  const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
  let first = true, dTotal = 0, dRows = 0;
  for await (const line of rl) {
    if (first) { first = false; continue; }
    if (!line.startsWith(ORIGIN + ',')) continue;
    const c = line.split(',');
    if (c[0] !== ORIGIN) continue;
    const destCode = c[4], destLat = parseFloat(c[5]), destLon = parseFloat(c[6]), destName = c[7];
    const hour = codeToHour(c[8]);
    const inout = c[10], nat = c[11], mode = parseInt(c[12],10);
    const dist = parseFloat(c[13]), tmin = parseFloat(c[14]), pop = parseFloat(c[15]);
    if (hour === null || Number.isNaN(pop)) continue;
    if (destCode === ORIGIN) continue;

    dTotal += pop; dRows++;
    const t = day.type;
    monthTotal[day.month] += pop;

    if (!destAgg[destCode]) destAgg[destCode] = { name: destName, total:0, lat:Number.isNaN(destLat)?null:destLat, lon:Number.isNaN(destLon)?null:destLon, seoul: destName.startsWith('서울') };
    destAgg[destCode].total += pop;

    hourByType[t][hour] += pop;
    modeByType[t][mode] = (modeByType[t][mode]||0) + pop;
    modeTotal[mode] = (modeTotal[mode]||0) + pop;
    inoutTotal[inout] = (inoutTotal[inout]||0) + pop;
    natTotal[nat] = (natTotal[nat]||0) + pop;
    destByType[t][destCode] = destByType[t][destCode] || { name: destName, total:0, seoul: destName.startsWith('서울') };
    destByType[t][destCode].total += pop;

    if (!Number.isNaN(dist)) { distSum += dist*pop; distW += pop;
      const km = Math.floor(dist/1000);
      const bucket = km<1?'0-1':km<3?'1-3':km<5?'3-5':km<10?'5-10':km<20?'10-20':'20+';
      distBuckets[bucket] = (distBuckets[bucket]||0) + pop;
    }
    if (!Number.isNaN(tmin)) { timeSum += tmin*pop; timeW += pop; }
  }
  perDay[day.date] = { total: dTotal, rows: dRows, ...day };
  console.error(`  ${day.date}(${day.dow}) 완료: ${Math.round(dTotal).toLocaleString()}명`);
}

for (const d of DAYS) { console.error(`처리: ${d.date}…`); await processDay(d); }

// 출력
const round = (x)=>Math.round(x*10)/10;
const out = { perDay, destAgg, hourByType, modeByType, modeTotal, inoutTotal, natTotal, destByType, monthTotal,
  avgDist: round(distSum/distW), avgTime: round(timeSum/timeW), distBuckets, MODE };
fs.writeFileSync(path.join(import.meta.dirname,'analysis2026.json'), JSON.stringify(out));
console.error('저장 완료: analysis2026.json');
