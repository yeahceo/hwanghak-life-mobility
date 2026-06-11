import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ORIGIN, isSeoul, shortName } from '../lib/selectors';

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

export default function MapView({ byDest, originName, onPickDest, mapRef }) {
  const layersRef = useRef([]);
  const dotsRef = useRef([]);      // 흐르는 점 마커들
  const animRef = useRef(null);    // requestAnimationFrame id
  const containerRef = useRef(null);

  // 지도 1회 초기화
  useEffect(() => {
    const map = L.map(containerRef.current, {
      center: [37.5665, 127.0],
      zoom: 12,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · © CARTO',
      maxZoom: 18,
    }).addTo(map);

    // 서울 자치구 경계 + 구명 라벨 (흐름선보다 아래에 깔림)
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
        // 구 이름 라벨 (폴리곤 중심)
        geo.features.forEach((f) => {
          const c = L.geoJSON(f).getBounds().getCenter();
          L.marker(c, {
            interactive: false,
            icon: L.divIcon({
              className: '',
              html: `<span style="color:#7d8ba3;font-size:10px;font-weight:600;text-shadow:0 0 4px #0d1117,0 0 4px #0d1117;white-space:nowrap;">${f.properties.name}</span>`,
              iconAnchor: [0, 0],
            }),
          }).addTo(map);
        });
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
    // TOP10 도착지 코드 (라벨 표시 대상)
    const top10 = new Set(byDest.slice(0, 10).map((d) => d.dest_code));

    byDest.slice(0, 40).forEach((d) => {
      if (d.dest_lat == null || d.dest_lon == null) return;
      const ratio = d.value / max;
      const seoul = isSeoul(d.dest_name);
      const color = seoul ? '#4ecdc4' : '#ffe66d';
      const weight = Math.max(1, ratio * 6);
      const opacity = 0.3 + ratio * 0.6;

      const line = L.polyline(
        arcPoints(ORIGIN.lat, ORIGIN.lon, d.dest_lat, d.dest_lon),
        { color, weight, opacity, smoothFactor: 1 }
      ).addTo(map);
      layersRef.current.push(line);

      const r = Math.max(4, ratio * 14);
      const icon = L.divIcon({
        html: `<div style="width:${r * 2}px;height:${r * 2}px;background:${color};opacity:0.85;border-radius:50%;margin:${-r}px 0 0 ${-r}px;border:1px solid rgba(255,255,255,0.35);"></div>`,
        className: '', iconAnchor: [0, 0],
      });
      const marker = L.marker([d.dest_lat, d.dest_lon], { icon })
        .addTo(map)
        .bindPopup(`<b>${d.dest_name}</b><br>이동인구: <b>${d.value.toLocaleString()}명</b>`);
      marker.on('click', () => onPickDest?.(d));
      layersRef.current.push(marker);

      // TOP10만 동 이름 라벨 (점 옆에 표시)
      if (top10.has(d.dest_code)) {
        const label = L.marker([d.dest_lat, d.dest_lon], {
          interactive: false,
          icon: L.divIcon({
            className: '',
            html: `<span style="display:inline-block;margin-left:${r + 4}px;color:${color};font-size:11px;font-weight:700;text-shadow:0 0 4px #0d1117,0 0 4px #0d1117,0 0 4px #0d1117;white-space:nowrap;">${shortName(d.dest_name)}</span>`,
            iconAnchor: [0, 8],
          }),
        }).addTo(map);
        layersRef.current.push(label);
      }

      // 흐르는 점: 상위 30개 흐름선만 (성능), 인구 비례 점 개수
      if (ratio > 0.04) {
        const dotCount = Math.min(4, 1 + Math.floor(ratio * 4));
        for (let k = 0; k < dotCount; k++) {
          const m = L.marker([ORIGIN.lat, ORIGIN.lon], {
            interactive: false,
            icon: L.divIcon({
              className: '',
              html: `<div style="width:5px;height:5px;background:#fff;border-radius:50%;box-shadow:0 0 6px ${color},0 0 3px ${color};"></div>`,
              iconAnchor: [2.5, 2.5],
            }),
          }).addTo(map);
          dotsRef.current.push({
            marker: m,
            o: [ORIGIN.lat, ORIGIN.lon],
            dst: [d.dest_lat, d.dest_lon],
            t: k / dotCount,          // 시작 위치 분산
            speed: 0.0016 + ratio * 0.0014, // 인구 많을수록 약간 빠르게
          });
        }
      }
    });
  }, [byDest, onPickDest]);

  // 흐르는 점 애니메이션 루프 (마운트 시 1회 시작, 점은 dotsRef에서 읽음)
  useEffect(() => {
    const step = () => {
      for (const dot of dotsRef.current) {
        dot.t += dot.speed;
        if (dot.t > 1) dot.t -= 1;
        const [lat, lon] = bezierAt(dot.o[0], dot.o[1], dot.dst[0], dot.dst[1], dot.t);
        dot.marker.setLatLng([lat, lon]);
      }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return <div id="map" ref={containerRef} />;
}
