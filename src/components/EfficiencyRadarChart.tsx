import React from 'react';
import { EfficiencyBreakdown } from '../types/obd';

interface EfficiencyRadarChartProps {
  breakdown: EfficiencyBreakdown;
}

export const EfficiencyRadarChart: React.FC<EfficiencyRadarChartProps> = ({ breakdown }) => {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 92;

  const axes = [
    { label: 'THROTTLE', value: breakdown.throttleSmoothness },
    { label: 'RPM BAND', value: breakdown.rpmDiscipline },
    { label: 'CRUISE SPD', value: breakdown.cruiseEconomy },
    { label: 'IDLE CTRL', value: breakdown.idleDiscipline },
    { label: 'THERMAL', value: breakdown.thermalReadiness },
  ];

  const angleFor = (idx: number) => -Math.PI / 2 + (idx * 2 * Math.PI) / axes.length;

  const polygonPoints = (scale: number) =>
    axes
      .map((_, i) => {
        const a = angleFor(i);
        const r = radius * scale;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
      })
      .join(' ');

  const dataPoints = axes
    .map((axis, i) => {
      const a = angleFor(i);
      const r = radius * (Math.max(10, axis.value) / 100);
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[280px] h-auto"
        role="img"
        aria-label="5-axis driving efficiency calibration chart"
      >
        {/* Concentric calibration polygons */}
        {[0.25, 0.5, 0.75, 1].map((scale) => (
          <polygon
            key={scale}
            points={polygonPoints(scale)}
            fill="none"
            stroke="#1E293B"
            strokeWidth="1"
          />
        ))}

        {/* Radial spoke lines & vertex labels */}
        {axes.map((axis, i) => {
          const a = angleFor(i);
          const x2 = cx + radius * Math.cos(a);
          const y2 = cy + radius * Math.sin(a);
          const lx = cx + (radius + 24) * Math.cos(a);
          const ly = cy + (radius + 20) * Math.sin(a);

          return (
            <g key={axis.label}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#1E293B" strokeWidth="1" />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-400 text-[9px] font-mono tracking-wider"
              >
                {axis.label}
              </text>
              <text
                x={lx}
                y={ly + 11}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-cyan-400 text-[10px] font-mono font-semibold tabular-nums"
              >
                {axis.value}
              </text>
            </g>
          );
        })}

        {/* Active calibration fill */}
        <polygon
          points={dataPoints}
          fill="rgba(6, 182, 212, 0.2)"
          stroke="#06B6D4"
          strokeWidth="2"
        />

        {/* Data vertex markers */}
        {axes.map((axis, i) => {
          const a = angleFor(i);
          const r = radius * (Math.max(10, axis.value) / 100);
          const vx = cx + r * Math.cos(a);
          const vy = cy + r * Math.sin(a);
          return (
            <circle
              key={axis.label}
              cx={vx}
              cy={vy}
              r="3.5"
              fill="#06B6D4"
              stroke="#07090E"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>
    </div>
  );
};
