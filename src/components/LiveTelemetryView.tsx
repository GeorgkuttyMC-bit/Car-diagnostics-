import React from 'react';
import { Bluetooth, Play, AlertTriangle } from 'lucide-react';
import {
  ConnectionState,
  DrivingScenario,
  EfficiencyBreakdown,
  TelemetryFrame,
  TelemetrySample,
  UnitSystem,
} from '../types/obd';
import { TelemetryChart } from './TelemetryChart';

interface LiveTelemetryViewProps {
  connectionState: ConnectionState;
  bluetoothSupported: boolean;
  connectionError: string | null;
  frame: TelemetryFrame | null;
  samples: TelemetrySample[];
  efficiency: EfficiencyBreakdown | null;
  unitSystem: UnitSystem;
  scenario: DrivingScenario;
  onChangeScenario: (scenario: DrivingScenario) => void;
  onConnectBluetooth: (acceptAll?: boolean) => void;
  onStartSimulator: () => void;
}

const SCENARIO_OPTIONS: Array<{ id: DrivingScenario; label: string }> = [
  { id: DrivingScenario.EcoCruise, label: 'Eco Cruise' },
  { id: DrivingScenario.CityTraffic, label: 'City Stop & Go' },
  { id: DrivingScenario.HighwayFast, label: 'High-Speed Highway' },
  { id: DrivingScenario.SteepAscent, label: 'Steep Ascent' },
  { id: DrivingScenario.FaultCondition, label: 'Fault Injection' },
];

export const LiveTelemetryView: React.FC<LiveTelemetryViewProps> = ({
  connectionState,
  bluetoothSupported,
  connectionError,
  frame,
  samples,
  efficiency,
  unitSystem,
  scenario,
  onChangeScenario,
  onConnectBluetooth,
  onStartSimulator,
}) => {
  const isDisconnected =
    connectionState === ConnectionState.Disconnected ||
    connectionState === ConnectionState.Error;

  if (isDisconnected || !frame) {
    return (
      <section className="max-w-4xl mx-auto py-10 px-4">
        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-50 text-balance">
                Connect your vehicle OBD-II Bluetooth adapter
              </h1>
              <p className="mt-2 text-sm sm:text-base text-slate-400 max-w-2xl leading-relaxed">
                Pair an ELM327 Bluetooth Low Energy (BLE 4.0+) adapter plugged into your vehicle&apos;s
                16-pin OBD-II diagnostic port to stream live engine PIDs, track instantaneous fuel
                economy, and scan diagnostic trouble codes.
              </p>
            </div>

            {connectionError && (
              <div className="border border-rose-500/40 bg-rose-950/20 rounded-md p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs sm:text-sm text-rose-200 leading-relaxed">
                  <p className="font-semibold text-rose-300">Bluetooth Connection Notice</p>
                  <p className="mt-0.5">{connectionError}</p>
                </div>
              </div>
            )}

            {!bluetoothSupported && (
              <div className="border border-amber-500/40 bg-amber-950/20 rounded-md p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-xs sm:text-sm text-amber-200 leading-relaxed">
                  <p className="font-semibold text-amber-300">Web Bluetooth Unavailable in This Browser Context</p>
                  <p className="mt-0.5">
                    Web Bluetooth requires Chrome, Edge, or Android Chrome over HTTPS (not inside
                    restricted iframes). You can still evaluate every telemetry gauge, fuel coach
                    directive, and DTC scanner using the Live Drive Simulator below.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onConnectBluetooth(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Bluetooth className="w-4 h-4" aria-hidden="true" />
                <span>Pair OBD-II Adapter</span>
              </button>

              <button
                type="button"
                onClick={() => onConnectBluetooth(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-[#111827] hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <span>Scan All BLE Devices</span>
              </button>

              <button
                type="button"
                onClick={onStartSimulator}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-cyan-300 bg-cyan-950/30 hover:bg-cyan-950/50 border border-cyan-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4" aria-hidden="true" />
                <span>Launch Live Drive Simulator</span>
              </button>
            </div>

            <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-400">
              <div>
                <p className="font-mono text-slate-200 font-semibold">01. Supported Hardware</p>
                <p className="mt-1 leading-relaxed">
                  Veepeak OBDCheck BLE, Vgate iCar Pro BLE 4.0, OBDLink CX, and standard ELM327 GATT UART dongles.
                </p>
              </div>
              <div>
                <p className="font-mono text-slate-200 font-semibold">02. Real-Time Fuel Math</p>
                <p className="mt-1 leading-relaxed">
                  Decodes MAF (PID 0110) or MAP Speed-Density (PID 010B) plus STFT/LTFT trims to compute L/100km &amp; MPG.
                </p>
              </div>
              <div>
                <p className="font-mono text-slate-200 font-semibold">03. SAE J1979 Diagnostics</p>
                <p className="mt-1 leading-relaxed">
                  Reads stored Mode 03 &amp; pending Mode 07 fault codes, I/M emissions readiness, and clears MIL via Mode 04.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const speedDisplay =
    unitSystem === UnitSystem.Metric ? frame.speedKmh : Math.round(frame.speedKmh * 0.621371);
  const speedUnit = unitSystem === UnitSystem.Metric ? 'km/h' : 'mph';

  const economyDisplay =
    frame.speedKmh < 4
      ? '—'
      : unitSystem === UnitSystem.Metric
        ? frame.instantL100km.toFixed(1)
        : frame.instantMpg.toFixed(1);
  const economyUnit = unitSystem === UnitSystem.Metric ? 'L/100km' : 'MPG';

  const fuelFlowDisplay =
    unitSystem === UnitSystem.Metric
      ? frame.fuelFlowLh.toFixed(2)
      : (frame.fuelFlowLh * 0.264172).toFixed(2);
  const fuelFlowUnit = unitSystem === UnitSystem.Metric ? 'L/h' : 'gal/h';

  const coolantDisplay =
    unitSystem === UnitSystem.Metric
      ? frame.coolantTempC
      : Math.round((frame.coolantTempC * 9) / 5 + 32);
  const intakeDisplay =
    unitSystem === UnitSystem.Metric
      ? frame.intakeTempC
      : Math.round((frame.intakeTempC * 9) / 5 + 32);
  const tempUnit = unitSystem === UnitSystem.Metric ? '°C' : '°F';

  // Gauge arc math for RPM (0 - 7000 RPM)
  const rpmPct = Math.min(1, frame.rpm / 7000);
  const arcRadius = 78;
  const arcCircumference = Math.PI * arcRadius; // semicircle
  const rpmDashOffset = arcCircumference * (1 - rpmPct);

  const combinedTrim = +(frame.stftPct + frame.ltftPct).toFixed(1);

  const pidChannels = [
    {
      label: 'Coolant Temp',
      pid: 'PID 0105',
      value: `${coolantDisplay}`,
      unit: tempUnit,
      state:
        frame.coolantTempC > 105
          ? { text: '✖ Overheat', cls: 'text-rose-400' }
          : frame.coolantTempC < 75
            ? { text: '▲ Cold Loop', cls: 'text-amber-400' }
            : { text: '● Nominal', cls: 'text-emerald-400' },
    },
    {
      label: 'Engine Load',
      pid: 'PID 0104',
      value: frame.engineLoadPct.toFixed(1),
      unit: '%',
      state:
        frame.engineLoadPct > 85
          ? { text: '▲ High Load', cls: 'text-amber-400' }
          : { text: '● Nominal', cls: 'text-emerald-400' },
    },
    {
      label: 'Throttle Position',
      pid: 'PID 0111',
      value: frame.throttlePct.toFixed(1),
      unit: '%',
      state:
        frame.throttlePct > 55
          ? { text: '▲ Enrichment', cls: 'text-amber-400' }
          : { text: '● Nominal', cls: 'text-emerald-400' },
    },
    {
      label: 'Mass Air Flow',
      pid: 'PID 0110',
      value: frame.mafGs.toFixed(2),
      unit: 'g/s',
      state: { text: '● Nominal', cls: 'text-emerald-400' },
    },
    {
      label: 'Manifold Pressure',
      pid: 'PID 010B',
      value: `${frame.mapKpa}`,
      unit: 'kPa',
      state: { text: '● Nominal', cls: 'text-emerald-400' },
    },
    {
      label: 'Fuel Trim (STFT+LTFT)',
      pid: 'PID 0106/07',
      value: `${combinedTrim >= 0 ? '+' : ''}${combinedTrim.toFixed(1)}`,
      unit: '%',
      state:
        Math.abs(combinedTrim) > 12
          ? { text: '✖ Trim Drift', cls: 'text-rose-400' }
          : Math.abs(combinedTrim) > 7
            ? { text: '▲ Watch', cls: 'text-amber-400' }
            : { text: '● Nominal', cls: 'text-emerald-400' },
    },
    {
      label: 'Control Voltage',
      pid: 'PID 0142',
      value: frame.voltageV.toFixed(2),
      unit: 'V',
      state:
        frame.voltageV < 12.4
          ? { text: '✖ Low Charge', cls: 'text-rose-400' }
          : frame.voltageV > 14.9
            ? { text: '▲ Overvolt', cls: 'text-amber-400' }
            : { text: '● Charging', cls: 'text-emerald-400' },
    },
    {
      label: 'Intake Air / Tank',
      pid: 'PID 010F/2F',
      value: `${intakeDisplay}${tempUnit} · ${frame.fuelLevelPct.toFixed(0)}`,
      unit: '%',
      state:
        frame.fuelLevelPct < 15
          ? { text: '▲ Low Fuel', cls: 'text-amber-400' }
          : { text: '● Nominal', cls: 'text-emerald-400' },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Simulator scenario switcher when running simulated drive */}
      {connectionState === ConnectionState.Simulating && (
        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-slate-100">Drive Cycle Profile:</span>{' '}
            <span className="text-slate-400">Switch vehicle load and fault states in real time</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-[#07090E] p-1 rounded-md border border-slate-800">
            {SCENARIO_OPTIONS.map((opt) => (
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

      {/* 4-Column Hero Numeric Telemetry Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">Vehicle Speed</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-slate-50 tabular-nums">
              {speedDisplay}
            </span>
            <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">{speedUnit}</span>
          </div>
          <p className="mt-1.5 text-xs font-mono text-slate-400 tabular-nums">
            Gear Est: {frame.gearEstimate === 0 ? 'Neutral / Idle' : `Gear ${frame.gearEstimate}`}
          </p>
        </div>

        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">Engine Speed</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-slate-50 tabular-nums">
              {frame.rpm.toLocaleString()}
            </span>
            <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">RPM</span>
          </div>
          <p className="mt-1.5 text-xs font-mono tabular-nums">
            {frame.rpm > 2800 ? (
              <span className="text-amber-400">▲ Above optimal shift point</span>
            ) : (
              <span className="text-emerald-400">● Optimal torque band</span>
            )}
          </p>
        </div>

        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">
            Instant Economy
          </p>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-cyan-400 tabular-nums">
              {economyDisplay}
            </span>
            <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">{economyUnit}</span>
          </div>
          <p className="mt-1.5 text-xs font-mono text-slate-400 tabular-nums">
            CO₂ {frame.co2Gkm} g/km
          </p>
        </div>

        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-4">
          <p className="text-xs font-mono tracking-wider uppercase text-slate-400">Fuel Flow Rate</p>
          <div className="mt-2 flex items-baseline">
            <span className="text-3xl sm:text-4xl font-mono font-bold text-slate-50 tabular-nums">
              {fuelFlowDisplay}
            </span>
            <span className="text-xs uppercase font-mono text-slate-400 ml-1.5">{fuelFlowUnit}</span>
          </div>
          <p className="mt-1.5 text-xs font-mono tabular-nums">
            {efficiency ? (
              <span className={efficiency.overallScore >= 75 ? 'text-emerald-400' : 'text-amber-400'}>
                Efficiency Index: {efficiency.overallScore}/100
              </span>
            ) : (
              <span className="text-slate-400">Calibrating...</span>
            )}
          </p>
        </div>
      </div>

      {/* Primary Asymmetric Telemetry Split: Tactile Tachometer Arc + Time-Series Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-4 bg-[#0D1117] border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Tachometer &amp; Load Band</h3>
            <p className="text-xs text-slate-400">Calibrated green zone 1,400–2,400 RPM</p>
          </div>

          <div className="flex flex-col items-center my-4">
            <svg viewBox="0 0 200 120" className="w-full max-w-[240px]" aria-label="Engine RPM gauge">
              {/* Background Track */}
              <path
                d="M 22 100 A 78 78 0 0 1 178 100"
                fill="none"
                stroke="#1E293B"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Active RPM Arc */}
              <path
                d="M 22 100 A 78 78 0 0 1 178 100"
                fill="none"
                stroke={frame.rpm > 3500 ? '#F59E0B' : '#06B6D4'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={arcCircumference}
                strokeDashoffset={rpmDashOffset}
              />
              <text
                x="100"
                y="84"
                textAnchor="middle"
                className="fill-slate-50 text-2xl font-mono font-bold tabular-nums"
              >
                {frame.rpm}
              </text>
              <text
                x="100"
                y="102"
                textAnchor="middle"
                className="fill-slate-400 text-[10px] font-mono uppercase tracking-widest"
              >
                RPM · LOAD {frame.engineLoadPct.toFixed(0)}%
              </text>
            </svg>
          </div>

          <div className="space-y-2 pt-3 border-t border-slate-800/80 text-xs font-mono tabular-nums">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Throttle Angle</span>
              <span className="text-slate-200">{frame.throttlePct.toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-transform duration-150 origin-left"
                style={{ transform: `scaleX(${Math.min(1, frame.throttlePct / 100)})` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <TelemetryChart samples={samples} unitSystem={unitSystem} />
        </div>
      </div>

      {/* 8-Channel OBD-II PID Sensor Matrix */}
      <div className="bg-[#0D1117] border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Live Engine &amp; Emissions PIDs</h3>
          <span className="text-xs font-mono text-slate-400">SAE J1979 Mode 01</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:gap-px bg-slate-800/70">
          {pidChannels.map((ch) => (
            <div key={ch.label} className="bg-[#0D1117] p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 font-medium">{ch.label}</span>
                <span className="text-[11px] font-mono text-slate-500">{ch.pid}</span>
              </div>
              <div className="flex items-baseline">
                <span className="text-xl font-mono font-semibold text-slate-100 tabular-nums">
                  {ch.value}
                </span>
                <span className="text-xs font-mono text-slate-400 ml-1">{ch.unit}</span>
              </div>
              <div className={`text-xs font-mono ${ch.state.cls}`}>{ch.state.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
