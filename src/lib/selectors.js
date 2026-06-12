// ═══════════════════════════════════════════════════════════
//  데이터 셀렉터: 시간대/수단 필터 → 도착지 집계
//  전처리 JSON 스키마:
//    destinations[].{ dest_code, dest_name, dest_lat, dest_lon,
//                     total, byHour[24], byMode{code:cnt} }
// ═══════════════════════════════════════════════════════════

export const ORIGIN = { lat: 37.56853537429577, lon: 127.02084550975484 };

// 수단 색상 (지하철/도보/버스 계열 구분)
// 2026 데이터는 숫자 코드, 2023/2024 cleaned 데이터는 텍스트 키 — 둘 다 지원
export const MODE_COLORS = {
  1: '#a78bfa', 항공: '#a78bfa',
  2: '#f472b6', 기차: '#f472b6',
  3: '#fb923c', 고속버스: '#fb923c',
  4: '#fbbf24', 광역버스: '#fbbf24',
  5: '#34d399', 일반버스: '#34d399',
  6: '#58a6ff', 지하철: '#58a6ff',
  7: '#4ecdc4', 도보: '#4ecdc4',
  8: '#f87171', 차량: '#f87171',
  9: '#8b949e', 기타: '#8b949e',
};

// idx: -1 = 전체, 0~23 = 해당 시
// 도착지별로 선택 시간대의 인구수를 뽑아 정렬
export function aggregateByDest(destinations, hourIdx) {
  const rows = destinations
    .map((d) => ({
      ...d,
      value: hourIdx < 0 ? d.total : d.byHour[hourIdx] || 0,
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  return rows;
}

// 선택 시간대 기준 수단별 합계 (정확: summary.hour_mode 사용)
export function modeBreakdown(summary, hourIdx, modeLabels) {
  // hourIdx < 0 → 전체(mode_totals), 그 외 → 해당 시간대(hour_mode[hourIdx])
  const totals =
    hourIdx < 0
      ? { ...summary.mode_totals }
      : { ...(summary.hour_mode?.[hourIdx] || {}) };

  const arr = Object.entries(totals)
    .map(([code, value]) => ({
      code,
      label: modeLabels[code] || code,
      value: Math.round(value * 10) / 10,
      color: MODE_COLORS[code] || '#8b949e',
    }))
    .sort((a, b) => b.value - a.value);
  const sum = arr.reduce((s, x) => s + x.value, 0) || 1;
  return arr.map((x) => ({ ...x, pct: (x.value / sum) * 100 }));
}

// 시간대별 전체 이동인구 (차트용)
export function hourSeries(data) {
  return data.meta.hours.map((label, h) => ({
    hour: h,
    label,
    value: Math.round((data.summary.hour_totals[h] || 0) * 10) / 10,
  }));
}

// 시간대별 유출+유입 듀얼 (value=현재 방향, value2=반대 방향)
// — "18시 유입 역전" 인사이트의 시각적 증거
export function hourSeriesDual(data, oppData) {
  return data.meta.hours.map((label, h) => ({
    hour: h,
    label,
    value: Math.round((data.summary.hour_totals[h] || 0) * 10) / 10,
    value2: oppData ? Math.round((oppData.summary.hour_totals[h] || 0) * 10) / 10 : null,
  }));
}

export function shortName(name) {
  return name
    .replace('서울특별시 ', '')
    .replace('서울시 ', '')
    .replace('경기도 ', '경기 ')
    .replace('인천광역시 ', '인천 ');
}

// 행정동코드 앞 2자리로 지역 판정 (도착지명은 동명만 있어 이름 판정 불가)
//  서울=11, 경기=41, 인천=28
export function regionOf(destCode) {
  const p = String(destCode).slice(0, 2);
  if (p === '11') return 'seoul';
  if (p === '41') return 'gyeonggi';
  if (p === '28') return 'incheon';
  return 'etc';
}
export function isSeoul(destCode) {
  return regionOf(destCode) === 'seoul';
}

// ── 신규 셀렉터: summary 필드 → 차트용 배열 ──

// 거리대 분포 (고정 순서). hourIdx<0 → 전체, 그 외 → 해당 시간대
const DIST_ORDER = ['0-1', '1-3', '3-5', '5-10', '10-20', '20+'];
const DIST_LABEL = { '0-1': '0~1km', '1-3': '1~3km', '3-5': '3~5km', '5-10': '5~10km', '10-20': '10~20km', '20+': '20km+' };
export function distBuckets(summary, hourIdx = -1) {
  const b = hourIdx < 0 ? (summary.dist_buckets || {}) : (summary.hour_dist?.[hourIdx] || {});
  const sum = DIST_ORDER.reduce((s, k) => s + (b[k] || 0), 0) || 1;
  return DIST_ORDER.map((k) => ({
    key: k,
    label: DIST_LABEL[k],
    value: Math.round(b[k] || 0),
    pct: ((b[k] || 0) / sum) * 100,
  }));
}

// 내·외국인 비율. hourIdx<0 → 전체, 그 외 → 해당 시간대
const INOUT_COLOR = { 내국인: '#58a6ff', 단기외국인: '#f4b400', 장기외국인: '#4ecdc4' };
export function inoutShare(summary, hourIdx = -1) {
  const o = hourIdx < 0 ? (summary.inout || {}) : (summary.hour_inout?.[hourIdx] || {});
  const sum = Object.values(o).reduce((s, v) => s + v, 0) || 1;
  return ['내국인', '단기외국인', '장기외국인']
    .filter((k) => o[k])
    .map((k) => ({ label: k, value: Math.round(o[k]), pct: (o[k] / sum) * 100, color: INOUT_COLOR[k] }));
}

// 국적 TOP n (한국·미상 제외 — 외국인 구성 강조). hourIdx<0 → 전체
export function nationalityTop(summary, n = 5, excludeKorea = true, hourIdx = -1) {
  const o = { ...(hourIdx < 0 ? (summary.nationality || {}) : (summary.hour_nat?.[hourIdx] || {})) };
  if (excludeKorea) delete o['한국'];
  delete o['기타'];       // 국적 미상 — 국적 비교에서 제외
  delete o['기타국가'];   // 하위 합산 버킷 제외
  const sum = Object.values(o).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value: Math.round(value), pct: (value / sum) * 100 }));
}
