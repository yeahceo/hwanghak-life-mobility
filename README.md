# 황학동 생활이동 대시보드

서울시 중구 **황학동**을 출발지로 한 수도권 생활이동(출도착 행정동별 수단)
데이터를 인터랙티브하게 탐색하는 대시보드. 다크테마 지도 위에 흐름선·도착지
랭킹·시간대/이동수단 분포를 보여주고, **평일 vs 주말**을 비교한다.

React(Vite) + Leaflet + Recharts + framer-motion. GitHub → Vercel 배포용.

## 기능

- 🗺 **흐름 지도** — 황학동에서 각 도착지로 베지어 곡선 흐름선, 서울/경기·인천 색 구분
- ⏱ **시간대 필터** — 0~23시 슬라이더 또는 차트 클릭으로 시간대 선택
- 🚇 **이동수단 분포** — 도보·지하철·버스·차량 등 9개 수단 도넛 차트 (공식 코드표 기준)
- 🏆 **도착지 TOP10** — 시간대 변경 시 순위가 부드럽게 재정렬(layout 애니메이션)
- 📅 **평일/주말 토글** — 4/17(금) vs 4/19(일), 숫자 카운트업 전환

## 데이터

원본은 수도권 생활이동 CSV(파일당 ~850MB, ~650만 행). 레포에는 올리지 않고,
`data/preprocess.mjs`로 **황학동 출발분만** 추출·집계한 작은 JSON만 커밋한다.

```
public/data/
  hwanghak_weekday.json   # 2026-04-17 (금)
  hwanghak_weekend.json   # 2026-04-19 (일)
```

각 JSON 스키마:
```jsonc
{
  "meta":    { "origin", "date", "label", "mode_labels", "hours[24]" },
  "summary": { "total_pop", "dest_count", "hour_totals[24]", "mode_totals" },
  "destinations": [
    { "dest_code", "dest_name", "dest_lat", "dest_lon",
      "total", "byHour[24]", "byMode": { "<modeCode>": cnt } }
  ]
}
```

### 데이터 재생성

원본 zip이 있는 환경에서:
```bash
npm run preprocess   # data/preprocess.mjs 실행 → public/data/*.json
```
`preprocess.mjs`의 `SRC_DIR`를 원본 zip 폴더 경로에 맞게 수정. `unzip` CLI 필요
(zip을 압축해제하지 않고 스트리밍 파싱).

## 이동수단 코드 (공식 레이아웃 기준)

| 코드 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| 수단 | 항공 | 기차 | 고속버스 | 광역버스 | 일반버스 | 지하철 | 도보 | 차량 | 기타 |

## 시간코드 처리

원본 시간코드는 두 체계가 섞여 있다:
- `0~23` : 시 단위 (비피크 시간대)
- `700~940`, `1700~1940` : 출퇴근 피크(7~9시, 17~19시)의 20분 단위 `HHMM`

전처리에서 피크 묶음코드를 `Math.floor(code/100)`로 시 단위로 통합 → 24시간
완전한 시계열을 만든다.

## 로컬 실행

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/ 정적 빌드
```

## 배포 (Vercel)

Vite 프로젝트라 Vercel이 프리셋을 자동 인식한다.
- Build Command: `npm run build`
- Output Directory: `dist`
- GitHub 레포를 Vercel에 import하면 끝.
