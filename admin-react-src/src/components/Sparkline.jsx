import { useEffect, useRef, useState } from 'react';
import { mvComputeCoords, mvSmoothPathFromCoords } from '../lib/marketValuationHelpers';

export default function Sparkline({ seriesArr, rows, aspectW = 300, aspectH = 70 }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(aspectW);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const height = Math.round(width * aspectH / aspectW);
  const axisH = rows && rows.length ? 14 : 0;
  const chartH = height - axisH;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
        <line x1="4" y1={chartH - 2} x2={width - 4} y2={chartH - 2} stroke="var(--border)" strokeWidth="1" />
        {seriesArr.map((s, si) => {
          const coords = mvComputeCoords(s.values, width, chartH, 4, 10, 4);
          const d = mvSmoothPathFromCoords(coords);
          return (
            <g key={si}>
              {d && <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
              {coords.map((c, ci) => {
                const monthLabel = rows && rows[c.i] ? `${rows[c.i].month}-р сар` : '';
                const tipText = `${monthLabel}: ${Math.round(c.v).toLocaleString()}₮`;
                return (
                  <g key={ci}>
                    <circle cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="2" fill={s.color} />
                    <circle cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="7" fill="transparent" style={{ cursor: 'pointer' }}>
                      <title>{tipText}</title>
                    </circle>
                  </g>
                );
              })}
            </g>
          );
        })}
        {rows && rows.length > 0 && rows.map((r, i) => {
          const n = rows.length;
          const x = 4 + (i / Math.max(n - 1, 1)) * (width - 8);
          return <text key={i} x={x.toFixed(1)} y={height - 2} fontSize="7" fill="var(--text-muted)" textAnchor="middle">{r.month}</text>;
        })}
      </svg>
    </div>
  );
}
