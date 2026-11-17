import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, Play } from 'lucide-react';
import {
  ConnectionState,
  DrivingScenario,
  EfficiencyBreakdown,
  TelemetryFrame,
  UnitSystem,
} from '../types/obd';
import { EfficiencyRadarChart } from './EfficiencyRadarChart';

interface FuelCoachViewProps {
  connectionState: ConnectionState;
  frame: TelemetryFrame | null;
  efficiency: EfficiencyBreakdown | null;
  unitSystem: UnitSystem;
  avgL100km: number;
  distanceKm: number;
  fuelUsedLiters: number;
  scenario: DrivingScenario;
  onChangeScenario: (scenario: DrivingScenario) => void;
  onStartSimulator: () => void;
}

export const FuelCoachView: React.FC<FuelCoachViewProps> = ({
  connectionState,
  frame,
  efficiency,
  unitSystem,
  avgL100km,
  distanceKm,
  fuelUsedLiters,
  scenario,
  onChangeScenario,
  onStartSimulator,
}) => {
  const [fuelPricePerLiter, setFuelPricePerLiter] = useState<number>(1.65);
  const [weeklyDistanceKm, setWeeklyDistanceKm] = useState<number>(320);

  if (!frame || !efficiency) {
    return (
      <section className="max-w-3xl mx-auto py-10 px-4">
        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Fuel Efficiency Coach</h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Connect your Bluetooth OBD-II adapter or start the simulated drive cycle to evaluate
            real-time throttle discipline, aerodynamic drag, idle waste, and savings potential.
          </p>
          <button
            type="button"
            onClick={onStartSimulator}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>Start Simulated Drive</span>
          </button>
        </div>
      </section>
    );
  }

  const totalFlow = Math.max(0.01, frame.fuelFlowLh);
  const shares = [
    {
      label: 'Optimal Propulsion',
      litersH: efficiency.fuelShareLiters.cruiseOptimal,
      pct: Math.round((efficiency.fuelShareLiters.cruiseOptimal / totalFlow) * 100),
      barClass: 'bg-cyan-400',
    },
    {
      label: 'Acceleration Surge',
      litersH: efficiency.fuelShareLiters.accelerationSurge,
      pct: Math.round((efficiency.fuelShareLiters.accelerationSurge / totalFlow) * 100),
      barClass: 'bg-amber-400',
    },
    {
      label: 'Aerodynamic Drag',
      litersH: efficiency.fuelShareLiters.aeroDrag,
      pct: Math.round((efficiency.fuelShareLiters.aeroDrag / totalFlow) * 100),
      barClass: 'bg-sky-400',
    },
    {
      label: 'Stationary Idle Waste',
      litersH: efficiency.fuelShareLiters.idleWaste,
      pct: Math.round((efficiency.fuelShareLiters.idleWaste / totalFlow) * 100),
      barClass: 'bg-rose-400',
    },
  ];

  // Calculate baseline & potential monthly fuel cost savings
  const effectiveAvgL100 = avgL100km > 0.5 ? avgL100km : frame.instantL100km || 7.8;
  const potentialImprovementRatio = Math.max(0.03, (100 - efficiency.overallScore) * 0.0028);
  const monthlyDistanceKm = weeklyDistanceKm * 4.33;
  const currentMonthlyLiters = (monthlyDistanceKm / 100) * effectiveAvgL100;
  const monthlySavingsCurrency = currentMonthlyLiters * potentialImprovementRatio * fuelPricePerLiter;

  return (
    <div className="space-y-6">
      {connectionState === ConnectionState.Simulating && (
        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-300">
            Test how driving style alters your 5-axis efficiency radar &amp; coaching directives:
          </span>
          <div className="flex flex-wrap items-center gap-1 bg-[#07090E] p-1 rounded-md border border-slate-800">
            {[
              { id: DrivingScenario.EcoCruise, label: 'Eco Cruise' },
              { id: DrivingScenario.CityTraffic, label: 'City Stop & Go' },
              { id: DrivingScenario.HighwayFast, label: 'High-Speed Highway' },
              { id: DrivingScenario.SteepAscent, label: 'Steep Ascent' },
              { id: DrivingScenario.FaultCondition, label: 'Fault Injection' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChangeScenario(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  scenario === opt.id
                    ? 'bg-slate-800 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 5-Axis Calibration Radar & Fuel Burn Attribution */}
        <div className="lg:col-span-5 bg-[#0D1117] border border-slate-800 rounded-lg p-5 flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-100">Efficiency Calibration</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Live OBD-II driving behavior telemetry
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-cyan-400 tabular-nums">
                {efficiency.overallScore}
                <span className="text-xs text-slate-400 font-normal ml-1">/100</span>
              </div>
            </div>
          </div>

          <EfficiencyRadarChart breakdown={efficiency} />

          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Instantaneous Fuel Attribution</span>
              <span className="font-mono text-slate-400 tabular-nums">
                {frame.fuelFlowLh.toFixed(2)} L/h total
              </span>
            </div>

            {shares.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span className="text-slate-300 font-sans">{item.label}</span>
                  <span className="text-slate-400">
                    {item.litersH.toFixed(2)} L/h ({item.pct}%)
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.barClass} transition-transform duration-200 origin-left`}
                    style={{ transform: `scaleX(${Math.min(1, item.pct / 100)})` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Live Coaching Directives + Trip Cost & Savings Estimator */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Real-Time Coaching Directives
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Triggered from live RPM, throttle delta, fuel trims, and thermal status
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400 tabular-nums">
                {efficiency.directives.length} active
              </span>
            </div>

            <div className="divide-y divide-slate-800/80 border-t border-slate-800">
              {efficiency.directives.map((dir) => {
                const icon =
                  dir.severity === 'optimal' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : dir.severity === 'caution' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  );

                return (
                  <div key={dir.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {icon}
                      <div>
                        <p className="text-sm font-medium text-slate-100">{dir.title}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{dir.detail}</p>
                      </div>
                    </div>
                    {dir.estimatedSavingsPct > 0 && (
                      <span className="text-xs font-mono text-cyan-400 whitespace-nowrap shrink-0 tabular-nums">
                        Save ~{dir.estimatedSavingsPct}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fuel Cost & Savings Calculator */}
          <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Session Burn &amp; Projected Monthly Savings
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjust local fuel price and weekly commute distance to quantify optimization impact
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="fuel-price-input"
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                >
                  Fuel Price ($ / Liter)
                </label>
                <input
                  id="fuel-price-input"
                  type="number"
                  step="0.05"
                  min="0.3"
                  max="5.0"
                  value={fuelPricePerLiter}
                  onChange={(e) => setFuelPricePerLiter(Math.max(0.1, parseFloat(e.target.value) || 0))}
                  className="w-full bg-[#07090E] border border-slate-800 rounded-md px-3 py-2 text-sm font-mono text-slate-100 tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label
                  htmlFor="weekly-dist-input"
                  className="block text-xs font-medium text-slate-400 mb-1.5"
                >
                  Weekly Driving ({unitSystem === UnitSystem.Metric ? 'km' : 'mi'})
                </label>
                <input
                  id="weekly-dist-input"
                  type="number"
                  step="20"
                  min="20"
                  max="3000"
                  value={
                    unitSystem === UnitSystem.Metric
                      ? weeklyDistanceKm
                      : Math.round(weeklyDistanceKm * 0.621371)
                  }
                  onChange={(e) => {
                    const val = Math.max(10, parseFloat(e.target.value) || 0);
                    setWeeklyDistanceKm(
                      unitSystem === UnitSystem.Metric ? val : Math.round(val / 0.621371)
                    );
                  }}
                  className="w-full bg-[#07090E] border border-slate-800 rounded-md px-3 py-2 text-sm font-mono text-slate-100 tabular-nums focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-800">
              <div>
                <p className="text-xs text-slate-400">Session Distance</p>
                <p className="text-lg font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
                  {unitSystem === UnitSystem.Metric
                    ? `${distanceKm.toFixed(2)} km`
                    : `${(distanceKm * 0.621371).toFixed(2)} mi`}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Session Fuel Cost</p>
                <p className="text-lg font-mono font-semibold text-slate-100 tabular-nums mt-0.5">
                  ${(fuelUsedLiters * fuelPricePerLiter).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Est. Monthly Savings</p>
                <p className="text-lg font-mono font-semibold text-emerald-400 tabular-nums mt-0.5">
                  ${monthlySavingsCurrency.toFixed(2)}/mo
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
