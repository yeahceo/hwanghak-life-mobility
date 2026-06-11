// ═══════════════════════════════════════════════════════════
//  데이터 셀렉터: 시간대/수단 필터 → 도착지 집계
//  전처리 JSON 스키마:
//    destinations[].{ dest_code, dest_name, dest_lat, dest_lon,
//                     total, byHour[24], byMode{code:cnt} }
// ═══════════════════════════════════════════════════════════

export const ORIGIN = { lat: 37.56853537429577, lon: 127.02084550975484 };

// 수단 색상 (지하철/도보/버스 계열 구분)
export const MODE_COLORS = {
  1: '#a78bfa', // 항공
  2: '#f472b6', // 기차
  3: '#fb923c', // 고속버스
  4: '#fbbf24', // 광역버스
  5: '#34d399', // 일반버스
  6: '#58a6ff', // 지하철
  7: '#4ecdc4', // 도보
  8: '#f87171', // 차량
  9: '#8b949e', // 기타
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

export function shortName(name) {
  return name
    .replace('서울시 ', '')
    .replace('경기도 ', '경기 ')
    .replace('인천광역시 ', '인천 ');
}

export function isSeoul(name) {
  return name.startsWith('서울');
}
