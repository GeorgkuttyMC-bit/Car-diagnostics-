import React, { useState } from 'react';
import { RefreshCw, Trash2, Terminal, Play, Send, Search } from 'lucide-react';
import {
  ActiveDtc,
  ConnectionState,
  ReadinessMonitor,
  TerminalLogEntry,
  UnitSystem,
  VehicleMeta,
} from '../types/obd';

interface DiagnosticsViewProps {
  connectionState: ConnectionState;
  vehicleMeta: VehicleMeta;
  dtcs: ActiveDtc[];
  monitors: ReadinessMonitor[];
  terminalLogs: TerminalLogEntry[];
  unitSystem: UnitSystem;
  isScanning: boolean;
  onScanDiagnostics: () => void;
  onClearDtcs: () => void;
  onSendRawCommand: (cmd: string) => void;
  onStartSimulator: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  connectionState,
  vehicleMeta,
  dtcs,
  monitors,
  terminalLogs,
  unitSystem,
  isScanning,
  onScanDiagnostics,
  onClearDtcs,
  onSendRawCommand,
  onStartSimulator,
}) => {
  const [selectedCode, setSelectedCode] = useState<string | null>(dtcs[0]?.code ?? null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [commandInput, setCommandInput] = useState('010C');
  const [dtcFilter, setDtcFilter] = useState('');

  const isConnected =
    connectionState === ConnectionState.ConnectedBluetooth ||
    connectionState === ConnectionState.Simulating;

  const filteredDtcs = dtcs.filter(
    (d) =>
      d.code.toLowerCase().includes(dtcFilter.toLowerCase()) ||
      d.title.toLowerCase().includes(dtcFilter.toLowerCase()) ||
      d.subsystem.toLowerCase().includes(dtcFilter.toLowerCase())
  );

  const activeDtc =
    filteredDtcs.find((d) => d.code === selectedCode) ?? filteredDtcs[0] ?? null;

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || !isConnected) return;
    onSendRawCommand(commandInput.trim());
    setCommandInput('');
  };

  if (!isConnected) {
    return (
      <section className="max-w-3xl mx-auto py-10 px-4">
        <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-6 text-center space-y-4">
          <h2 className="text-xl font-semibold text-slate-100">Real-Time Vehicle Diagnostics</h2>
          <p className="text-sm text-slate-400 max-w-lg mx-auto">
            Connect your Bluetooth ELM327 adapter or start Simulated Drive mode to read Mode 03
            stored DTCs, Mode 07 pending codes, I/M emissions readiness, and send raw OBD-II commands.
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

  return (
    <div className="space-y-6">
      {/* Top Diagnostic Action & MIL Status Bar */}
      <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Check Engine (MIL)
            </p>
            <p className="mt-1 text-sm font-semibold font-mono">
              {vehicleMeta.milOn || dtcs.some((d) => d.status === 'stored') ? (
                <span className="text-rose-400">✖ MIL ILLUMINATED · {dtcs.length} CODE(S)</span>
              ) : dtcs.length > 0 ? (
                <span className="text-amber-400">▲ MIL OFF · {dtcs.length} PENDING</span>
              ) : (
                <span className="text-emerald-400">● MIL OFF · NO STORED FAULTS</span>
              )}
            </p>
          </div>

          <div className="hidden sm:block h-8 w-px bg-slate-800" aria-hidden="true" />

          <div>
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
              ECU Protocol &amp; VIN
            </p>
            <p className="mt-1 text-xs font-mono text-slate-200">
              {vehicleMeta.protocol} · {vehicleMeta.vin}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onScanDiagnostics}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isScanning ? 'Scanning ECU...' : 'Scan Fault Codes'}</span>
          </button>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              disabled={dtcs.length === 0 && !vehicleMeta.milOn}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-rose-300 bg-[#111827] hover:bg-rose-950/40 disabled:opacity-40 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear DTCs (Mode 04)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-rose-950/30 border border-rose-500/40 rounded-md px-3 py-1.5">
              <span className="text-xs text-rose-200">Reset MIL &amp; readiness monitors?</span>
              <button
                type="button"
                onClick={() => {
                  onClearDtcs();
                  setConfirmClear(false);
                }}
                className="px-2.5 py-1 text-xs font-semibold bg-rose-500 hover:bg-rose-400 text-slate-950 rounded"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DTC List + Selected Fault Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#0D1117] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-100">Detected Trouble Codes</h3>
            <div className="relative w-44">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={dtcFilter}
                onChange={(e) => setDtcFilter(e.target.value)}
                placeholder="Filter codes..."
                aria-label="Filter diagnostic trouble codes"
                className="w-full bg-[#07090E] border border-slate-800 rounded pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {filteredDtcs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              {dtcs.length === 0
                ? 'No stored or pending DTCs reported by the ECU. Click "Scan Fault Codes" or switch to Fault Injection in simulator mode to test code analysis.'
                : 'No trouble codes match your filter query.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {filteredDtcs.map((dtc) => {
                const isSelected = activeDtc?.code === dtc.code;
                const severityLabel =
                  dtc.severity === 'critical'
                    ? '✖ Critical'
                    : dtc.severity === 'warning'
                      ? '▲ Warning'
                      : '● Advisory';
                const severityColor =
                  dtc.severity === 'critical'
                    ? 'text-rose-400'
                    : dtc.severity === 'warning'
                      ? 'text-amber-400'
                      : 'text-cyan-400';

                return (
                  <button
                    key={`${dtc.code}-${dtc.status}`}
                    type="button"
                    onClick={() => setSelectedCode(dtc.code)}
                    className={`w-full text-left p-4 transition-colors ${
                      isSelected ? 'bg-slate-800/60' : 'hover:bg-slate-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-bold text-slate-100">
                        {dtc.code}
                        <span className="ml-2 text-[11px] font-normal text-slate-400 uppercase">
                          {dtc.status}
                        </span>
                      </span>
                      <span className={`text-xs font-mono ${severityColor}`}>{severityLabel}</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-200">{dtc.title}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {dtc.subsystem} · Fuel impact: {dtc.fuelImpactPct}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected DTC Deep-Dive Inspector */}
        <div className="lg:col-span-7 bg-[#0D1117] border border-slate-800 rounded-lg p-5">
          {activeDtc ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>{activeDtc.subsystem}</span>
                    <span aria-hidden="true">·</span>
                    <span className="uppercase">{activeDtc.status} DTC</span>
                  </div>
                  <h3 className="mt-1 text-lg font-bold text-slate-50">
                    <span className="font-mono text-cyan-400 mr-2">{activeDtc.code}</span>
                    {activeDtc.title}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-mono uppercase text-slate-400">Fuel Penalty</p>
                  <p className="text-xs font-mono font-semibold text-amber-400 mt-0.5">
                    {activeDtc.fuelImpactPct}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Technical Analysis
                </h4>
                <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
                  {activeDtc.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Probable Root Causes
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                    {activeDtc.causes.map((cause) => (
                      <li key={cause} className="leading-relaxed">
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Recommended Inspection
                  </h4>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {activeDtc.recommendedAction}
                  </p>

                  {activeDtc.freezeFrame && (
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                        Freeze-Frame Snapshot
                      </p>
                      <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs font-mono tabular-nums text-slate-300">
                        <span>{activeDtc.freezeFrame.rpm} RPM</span>
                        <span>
                          {unitSystem === UnitSystem.Metric
                            ? `${activeDtc.freezeFrame.speedKmh} km/h`
                            : `${Math.round(activeDtc.freezeFrame.speedKmh * 0.621371)} mph`}
                        </span>
                        <span>Load {activeDtc.freezeFrame.engineLoadPct.toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-medium text-emerald-400">● All Monitored Subsystems Clear</p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                No active diagnostic trouble codes are currently selected. Run a full Mode 03/07 ECU
                scan anytime to verify emissions and ignition health.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Emissions I/M Readiness + Raw OBD-II Command Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-[#0D1117] border border-slate-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-100">I/M Emissions Readiness</h3>
            <span className="text-xs font-mono text-slate-400">Mode 01 PID 01</span>
          </div>

          {monitors.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              Click &quot;Scan Fault Codes&quot; to query ECU readiness monitors.
            </p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {monitors.map((mon) => (
                <div key={mon.id} className="py-2 flex items-center justify-between text-xs">
                  <span className="text-slate-300">{mon.name}</span>
                  {!mon.supported ? (
                    <span className="font-mono text-slate-500">N/A</span>
                  ) : mon.complete ? (
                    <span className="font-mono text-emerald-400">● Ready</span>
                  ) : (
                    <span className="font-mono text-amber-400">▲ Incomplete</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-7 bg-[#0D1117] border border-slate-800 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-slate-100">ELM327 / OBD-II Command Console</h3>
            </div>
            <div className="flex items-center gap-1.5">
              {['010C', '0105', '0110', '03', 'ATRV'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onSendRawCommand(preset)}
                  className="px-2 py-1 text-[11px] font-mono bg-[#07090E] hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-[#07090E] border border-slate-800 rounded-md p-3 h-48 overflow-y-auto font-mono text-xs space-y-1.5">
            {terminalLogs.length === 0 ? (
              <p className="text-slate-500">Waiting for ELM327 TX/RX traffic...</p>
            ) : (
              terminalLogs.slice(-30).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-slate-600 shrink-0 tabular-nums">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour12: false,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                  <span
                    className={`uppercase shrink-0 w-7 ${
                      entry.direction === 'tx'
                        ? 'text-cyan-400'
                        : entry.direction === 'rx'
                          ? 'text-emerald-400'
                          : entry.direction === 'error'
                            ? 'text-rose-400'
                            : 'text-slate-400'
                    }`}
                  >
                    {entry.direction}
                  </span>
                  <span className="text-slate-200 break-all">
                    {entry.message}
                    {entry.decoded && (
                      <span className="text-slate-400 ml-2">({entry.decoded})</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommandSubmit} className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Enter OBD PID or AT command (e.g. 010C, 010D, ATRV, 03)..."
              aria-label="OBD-II command input"
              className="flex-1 bg-[#07090E] border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
