import React, { useMemo, useState } from 'react';
import { TelemetrySample, UnitSystem } from '../types/obd';

interface TelemetryChartProps {
  samples: TelemetrySample[];
  unitSystem: UnitSystem;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({ samples, unitSystem }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const width = 720;
  const height = 250;
  const pad = { top: 20, right: 56, bottom: 32, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const visibleSamples = useMemo(() => samples.slice(-70), [samples]);

  const { fuelPath, rpmPath, areaPath, maxFuel, maxRpm, points } = useMemo(() => {
    if (visibleSamples.length === 0) {
      return { fuelPath: '', rpmPath: '', areaPath: '', maxFuel: 20, maxRpm: 5000, points: [] };
    }

    const fuelVals = visibleSamples.map((s) =>
      unitSystem === UnitSystem.Metric ? s.instantL100km : s.instantMpg
    );
    const computedMaxFuel = Math.max(
      unitSystem === UnitSystem.Metric ? 18 : 50,
      Math.ceil(Math.max(...fuelVals) * 1.15)
    );
    const computedMaxRpm = Math.max(4500, Math.ceil(Math.max(...visibleSamples.map((s) => s.rpm)) / 500) * 500);

    const pts = visibleSamples.map((s, i) => {
      const x =
        visibleSamples.length === 1
          ? pad.left
          : pad.left + (i / (visibleSamples.length - 1)) * plotW;
      const fuelVal = unitSystem === UnitSystem.Metric ? s.instantL100km : s.instantMpg;
      const yFuel = pad.top + plotH - (Math.min(computedMaxFuel, fuelVal) / computedMaxFuel) * plotH;
      const yRpm = pad.top + plotH - (Math.min(computedMaxRpm, s.rpm) / computedMaxRpm) * plotH;
      return { x, yFuel, yRpm, sample: s, fuelVal };
    });

    const fPath = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yFuel.toFixed(1)}`).join(' ');
    const rPath = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.yRpm.toFixed(1)}`).join(' ');
    const aPath =
      pts.length > 1
        ? `${fPath} L ${pts[pts.length - 1].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
        : '';

    return {
      fuelPath: fPath,
      rpmPath: rPath,
      areaPath: aPath,
      maxFuel: computedMaxFuel,
      maxRpm: computedMaxRpm,
      points: pts,
    };
  }, [visibleSamples, unitSystem, plotW, plotH, pad.left, pad.top]);

  const activePoint =
    hoverIdx !== null && points[hoverIdx] ? points[hoverIdx] : points[points.length - 1] ?? null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    let closest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        closest = i;
      }
    }
    setHoverIdx(closest);
  };

  const fuelUnit = unitSystem === UnitSystem.Metric ? 'L/100km' : 'MPG';

  return (
    <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Fuel Economy &amp; Engine Speed Trace
          </h3>
          <p className="text-xs text-slate-400">
            Live dual-axis correlation ({visibleSamples.length} samples)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block" aria-hidden="true" />
            {fuelUnit}
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-400">
            <span className="w-3 h-0.5 border-t border-dashed border-amber-400 inline-block" aria-hidden="true" />
            RPM
          </span>
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
          role="img"
          aria-label="Dual axis chart showing fuel economy and engine RPM over time"
        >
          <defs>
            <linearGradient id="fuelAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines & Axis Ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = pad.top + t * plotH;
            const fuelTick = ((1 - t) * maxFuel).toFixed(0);
            const rpmTick = Math.round((1 - t) * maxRpm);
            return (
              <g key={t}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={width - pad.right}
                  y2={y}
                  stroke="#1E293B"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-cyan-400/80 text-[10px] font-mono tabular-nums"
                >
                  {fuelTick}
                </text>
                <text
                  x={width - pad.right + 8}
                  y={y + 4}
                  textAnchor="start"
                  className="fill-amber-400/80 text-[10px] font-mono tabular-nums"
                >
                  {rpmTick}
                </text>
              </g>
            );
          })}

          {/* Area & Line Series */}
          {areaPath && <path d={areaPath} fill="url(#fuelAreaGrad)" />}
          {rpmPath && (
            <path
              d={rpmPath}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.75"
              strokeDasharray="4 3"
              opacity="0.88"
            />
          )}
          {fuelPath && (
            <path d={fuelPath} fill="none" stroke="#06B6D4" strokeWidth="2.25" />
          )}

          {/* Crosshair & Active Point */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={pad.top}
                x2={activePoint.x}
                y2={pad.top + plotH}
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle cx={activePoint.x} cy={activePoint.yFuel} r="4" fill="#06B6D4" stroke="#07090E" strokeWidth="1.5" />
              <circle cx={activePoint.x} cy={activePoint.yRpm} r="3.5" fill="#F59E0B" stroke="#07090E" strokeWidth="1.5" />
            </g>
          )}

          {/* Bottom Axis Label */}
          <text
            x={pad.left}
            y={height - 8}
            className="fill-slate-500 text-[10px] font-mono"
          >
            {visibleSamples.length > 0 ? `T+${visibleSamples[0].elapsedSec}s` : 'T+0s'}
          </text>
          <text
            x={width - pad.right}
            y={height - 8}
            textAnchor="end"
            className="fill-slate-500 text-[10px] font-mono"
          >
            {activePoint ? `T+${activePoint.sample.elapsedSec}s` : 'Live'}
          </text>
        </svg>

        {/* Compact Monospace Crosshair HUD */}
        {activePoint && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-300">
            <span>
              Sample T+{activePoint.sample.elapsedSec}s · Speed{' '}
              <strong className="text-slate-100">
                {unitSystem === UnitSystem.Metric
                  ? `${activePoint.sample.speedKmh} km/h`
                  : `${Math.round(activePoint.sample.speedKmh * 0.621371)} mph`}
              </strong>
            </span>
            <div className="flex items-center gap-4">
              <span className="text-cyan-400">
                {activePoint.fuelVal.toFixed(1)} {fuelUnit}
              </span>
              <span className="text-amber-400">{activePoint.sample.rpm.toLocaleString()} RPM</span>
              <span className="text-slate-400">Load {activePoint.sample.engineLoadPct.toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
