import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { ORIGIN, isSeoul } from '../lib/selectors';

// 베지어 곡선 아크 (친구 drawArc 이식)
function arcPoints(lat1, lon1, lat2, lon2, steps = 30) {
  const pts = [];
  const midLat = (lat1 + lat2) / 2 + (lon2 - lon1) * 0.15;
  const midLon = (lon1 + lon2) / 2 - (lat2 - lat1) * 0.15;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
    const lon = (1 - t) * (1 - t) * lon1 + 2 * (1 - t) * t * midLon + t * t * lon2;
    pts.push([lat, lon]);
  }
  return pts;
}

export default function MapView({ byDest, originName, onPickDest, mapRef }) {
  const layersRef = useRef([]);
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

  // byDest 변경 시 흐름선·마커 다시 그림
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    layersRef.current.forEach((l) => map.removeLayer(l));
    layersRef.current = [];

    const max = byDest[0]?.value || 1;
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
    });
  }, [byDest, onPickDest]);

  return <div id="map" ref={containerRef} />;
}
