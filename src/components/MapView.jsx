import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ORIGIN, isSeoul } from '../lib/selectors';

// 베지어 곡선 한 점 평가 (t: 0~1)
function bezierAt(lat1, lon1, lat2, lon2, t) {
  const midLat = (lat1 + lat2) / 2 + (lon2 - lon1) * 0.15;
  const midLon = (lon1 + lon2) / 2 - (lat2 - lat1) * 0.15;
  const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
  const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * midLon + t * t * lon2;
  return [lat, lon];
}

// 곡선 폴리라인 좌표 (친구 drawArc 이식)
function arcPoints(lat1, lon1, lat2, lon2, steps = 30) {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push(bezierAt(lat1, lon1, lat2, lon2, i / steps));
  return pts;
}

export default function MapView({ byDest, originName, direction = 'out', onPickDest, mapRef }) {
  const layersRef = useRef([]);
  const dotsRef = useRef([]);      // 흐르는 점 마커들
  const animRef = useRef(null);    // requestAnimationFrame id
  const containerRef = useRef(null);

  // 지도 1회 초기화
  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: true,
      center: [37.56, 127.0],
      zoom: 11,
    });
    // 컨테이너 크기 확정 후 중심 설정
    const isMobile = window.innerWidth <= 768;
    map.whenReady(() => {
      if (isMobile) {
        // 모바일: 황학동 중심, 적당한 줌
        map.setView([ORIGIN.lat, ORIGIN.lon], 12, { animate: false });
      } else {
        // 데스크탑: 황학동을 좌측 빈 공간(전체 - 572px) 의 1/3 지점에 배치
        // 지도 중심을 황학동보다 오른쪽으로 이동 = 패널 절반(286px)만큼 경도 오프셋
        const zoom = 11;
        // 황학동 기준으로 패널 절반(286px)만큼 오른쪽으로 지도 중심 이동
        // → 황학동이 좌측 빈 공간(전체 - 572px)의 중앙에 위치
        map.setView([ORIGIN.lat, ORIGIN.lon], zoom, { animate: false });
        const originPx = map.latLngToContainerPoint([ORIGIN.lat, ORIGIN.lon]);
        const newCenterPx = [originPx.x + 286, originPx.y];
        const newCenter = map.containerPointToLatLng(newCenterPx);
        map.setView(newCenter, zoom, { animate: false });
      }
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · © CARTO',
      maxZoom: 18,
    }).addTo(map);

    // 서울 자치구 경계 (흐름선보다 아래에 깔림, 구 이름 라벨은 표시 안 함)
    fetch('seoul_gu.geojson')
      .then((r) => r.json())
      .then((geo) => {
        if (!mapRef.current) return;
        L.geoJSON(geo, {
          style: {
            color: '#3a4a63',
            weight: 1,
            opacity: 0.7,
            fillColor: '#4a5a78',
            fillOpacity: 0.04,
          },
        }).addTo(map);
      })
      .catch(() => {});

    // 출발지 마커
    const originIcon = L.divIcon({
      html: '<div style="width:16px;height:16px;background:#ff6b6b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 12px #ff6b6b;"></div>',
      className: '', iconAnchor: [8, 8],
    });
    L.marker([ORIGIN.lat, ORIGIN.lon], { icon: originIcon })
      .addTo(map)
      .bindPopup(`<b>${originName} (출발지)</b>`);

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [originName]);

  // byDest 변경 시 흐름선·마커·라벨·흐르는 점 다시 그림
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];
    dotsRef.current.forEach((d) => map.removeLayer(d.marker));
    dotsRef.current = [];

    const max = byDest[0]?.value || 1;
    const inbound = direction === 'in';

    byDest.slice(0, 40).forEach((d) => {
      if (d.dest_lat == null || d.dest_lon == null) return;
      const ratio = d.value / max;
      const seoul = isSeoul(d.dest_code);
      // 유출: 청록/노랑, 유입: 보라/주황 — 방향이 색으로도 구분되게
      const color = inbound ? (seoul ? '#a78bfa' : '#fb923c') : (seoul ? '#4ecdc4' : '#ffe66d');
      const weight = Math.max(1, ratio * 6);
      const opacity = 0.3 + ratio * 0.6;
      // 유입이면 원격지 → 황학동 방향으로 곡선·점 흐름 역전
      const [aLat, aLon, bLat, bLon] = inbound
        ? [d.dest_lat, d.dest_lon, ORIGIN.lat, ORIGIN.lon]
        : [ORIGIN.lat, ORIGIN.lon, d.dest_lat, d.dest_lon];
      const pts = arcPoints(aLat, aLon, bLat, bLon);

      // 글로우용 굵고 흐린 선 (아래에 깔림)
      const glowLine = L.polyline(pts, {
        color,
        weight: weight + 6,
        opacity: opacity * 0.25,
        smoothFactor: 1,
        interactive: false,
      }).addTo(map);
      layersRef.current.push(glowLine);

      // 본선 (클릭 가능 — 도착지 정보 팝업)
      const line = L.polyline(pts, { color, weight, opacity, smoothFactor: 1 })
        .addTo(map)
        .bindPopup(`<b>${d.dest_name}</b><br>이동인구: <b>${d.value.toLocaleString()}명</b>`);
      line.on('click', () => onPickDest?.(d));
      layersRef.current.push(line);

      // 흐르는 점: 상위 흐름선만 (성능), 인구 비례 점 개수
      if (ratio > 0.04) {
        const dotCount = Math.min(4, 1 + Math.floor(ratio * 4));
        for (let k = 0; k < dotCount; k++) {
          const el = document.createElement('div');
          el.style.cssText = `width:5px;height:5px;background:#fff;border-radius:50%;box-shadow:0 0 6px ${color},0 0 3px ${color};`;
          const m = L.marker([aLat, aLon], {
            interactive: false,
            icon: L.divIcon({ className: '', html: el.outerHTML, iconAnchor: [2.5, 2.5] }),
          }).addTo(map);
          dotsRef.current.push({
            marker: m,
            o: [aLat, aLon],                 // 유입이면 원격지에서 출발해 황학동으로
            dst: [bLat, bLon],
            t: k / dotCount,                 // 시작 위치 분산
            speed: 0.10 + ratio * 0.06,      // 초당 진행률 (느리고 부드럽게)
          });
        }
      }
    });
  }, [byDest, onPickDest, direction]);

  // 흐르는 점 애니메이션 루프 — delta time 기반(프레임률 무관, 부드러움)
  useEffect(() => {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); // 초 단위, 탭 비활성 시 점프 방지
      last = now;
      for (const dot of dotsRef.current) {
        dot.t += dot.speed * dt;
        if (dot.t > 1) dot.t -= 1;
        const [lat, lon] = bezierAt(dot.o[0], dot.o[1], dot.dst[0], dot.dst[1], dot.t);
        dot.marker.setLatLng([lat, lon]);
        // 시작·끝 근처에서 부드럽게 페이드 (꼬리처럼)
        const fade = Math.sin(dot.t * Math.PI); // 0→1→0
        const elDot = dot.marker.getElement();
        if (elDot) elDot.style.opacity = (0.35 + fade * 0.65).toFixed(2);
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <div id="map" ref={containerRef} />;
}
