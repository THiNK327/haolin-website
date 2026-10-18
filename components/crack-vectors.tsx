import type { Vector } from '@/lib/crasdi-summary';

/** Render stored per-vertex widths in image coordinates (millimeters / mm per pixel). */
export function CrackVectors({ map, pixelSize = 4 }: { map: Vector; pixelSize?: number }) {
 const scale = Number.isFinite(pixelSize) && pixelSize > 0 ? pixelSize : 4;
 return <>{map.features.map((feature, index) => {
  const points = feature.geometry.coordinates;
  const widths = (feature.properties as { width_mm?: unknown } | undefined)?.width_mm;
  if (!Array.isArray(widths) || widths.length !== points.length || !widths.every(w => typeof w === 'number' && Number.isFinite(w) && w >= 0)) {
   return <polyline key={index} points={points.map(p => `${p[1]},${p[0]}`).join(' ')} fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>;
  }
  return <g key={index} fill="white">
   {points.slice(1).map((b, i) => {
    const a = points[i], dx = b[1] - a[1], dy = b[0] - a[0], length = Math.hypot(dx, dy);
    if (!length) return null;
    const nx = -dy / length, ny = dx / length, ra = widths[i] / scale / 2, rb = widths[i + 1] / scale / 2;
    return <polygon key={i} points={`${a[1]+nx*ra},${a[0]+ny*ra} ${b[1]+nx*rb},${b[0]+ny*rb} ${b[1]-nx*rb},${b[0]-ny*rb} ${a[1]-nx*ra},${a[0]-ny*ra}`}/>;
   })}
   {points.map((p, i) => widths[i] > 0 ? <circle key={i} cx={p[1]} cy={p[0]} r={widths[i] / scale / 2}/> : null)}
  </g>;
 })}</>;
}
