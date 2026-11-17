import React from 'react';
import { Download, Play, SlidersHorizontal } from 'lucide-react';
import { ConnectionState, UnitSystem, VehicleMeta } from '../types/obd';

interface TelemetryRibbonProps {
  connectionState: ConnectionState;
  vehicleMeta: VehicleMeta;
  unitSystem: UnitSystem;
  onChangeUnitSystem: (unit: UnitSystem) => void;
  onStartSimulator: () => void;
  onExportCsv: () => void;
  sampleCount: number;
  displacementL: number;
  fuelType: 'gasoline' | 'diesel';
  onChangeVehicleProfile: (displacementL: number, fuelType: 'gasoline' | 'diesel') => void;
}

export const TelemetryRibbon: React.FC<TelemetryRibbonProps> = ({
  connectionState,
  vehicleMeta,
  unitSystem,
  onChangeUnitSystem,
  onStartSimulator,
  onExportCsv,
  sampleCount,
  displacementL,
  fuelType,
  onChangeVehicleProfile,
}) => {
  const renderStreamState = () => {
    switch (connectionState) {
      case ConnectionState.ConnectedBluetooth:
        return (
          <span className="inline-flex items-center gap-2 text-emerald-400 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>LIVE BLE STREAM · {vehicleMeta.deviceName}</span>
          </span>
        );
      case ConnectionState.Simulating:
        return (
          <span className="inline-flex items-center gap-2 text-cyan-400 font-mono text-xs">
            <span className="w-2 h-2 rounded-full bg-cyan-400" aria-hidden="true" />
            <span>SIMULATED DRIVE · {vehicleMeta.protocol}</span>
          </span>
        );
      case ConnectionState.Connecting:
      case ConnectionState.Initializing:
        return (
          <span className="inline-flex items-center gap-2 text-amber-400 font-mono text-xs">
            <span aria-hidden="true">▲</span>
            <span>HANDSHAKING ELM327 GATT</span>
          </span>
        );
      case ConnectionState.Error:
        return (
          <span className="inline-flex items-center gap-2 text-rose-400 font-mono text-xs">
            <span aria-hidden="true">✖</span>
            <span>ADAPTER LINK ERROR</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 text-slate-400 font-mono text-xs">
            <span aria-hidden="true">○</span>
            <span>STANDBY · NO ACTIVE OBD-II LINK</span>
          </span>
        );
    }
  };

  return (
    <div className="border-b border-slate-800/80 bg-[#0B0F17]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {renderStreamState()}
          {(connectionState === ConnectionState.ConnectedBluetooth ||
            connectionState === ConnectionState.Simulating) && (
            <span className="hidden lg:inline text-xs font-mono text-slate-400">
              {vehicleMeta.protocol} · VIN {vehicleMeta.vin}
            </span>
          )}
          {connectionState === ConnectionState.Disconnected && (
            <button
              type="button"
              onClick={onStartSimulator}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
            >
              <Play className="w-3 h-3" aria-hidden="true" />
              <span>Run Simulated Drive</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Engine profile for MAP speed-density fallback & fuel density */}
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            <label htmlFor="engine-disp" className="sr-only">
              Engine Displacement
            </label>
            <select
              id="engine-disp"
              value={displacementL}
              onChange={(e) => onChangeVehicleProfile(parseFloat(e.target.value), fuelType)}
              className="bg-[#111827] border border-slate-800 text-slate-200 text-xs font-mono rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="1.2">1.2 L</option>
              <option value="1.5">1.5 L</option>
              <option value="1.8">1.8 L</option>
              <option value="2.0">2.0 L</option>
              <option value="2.5">2.5 L</option>
              <option value="3.0">3.0 L</option>
              <option value="3.5">3.5 L</option>
              <option value="5.0">5.0 L</option>
            </select>

            <label htmlFor="fuel-type" className="sr-only">
              Fuel Type
            </label>
            <select
              id="fuel-type"
              value={fuelType}
              onChange={(e) => onChangeVehicleProfile(displacementL, e.target.value as 'gasoline' | 'diesel')}
              className="bg-[#111827] border border-slate-800 text-slate-200 text-xs font-mono rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
            >
              <option value="gasoline">Gasoline</option>
              <option value="diesel">Diesel</option>
            </select>
          </div>

          {/* Unit toggle */}
          <div className="flex items-center p-0.5 bg-[#111827] border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => onChangeUnitSystem(UnitSystem.Metric)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                unitSystem === UnitSystem.Metric
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Metric
            </button>
            <button
              type="button"
              onClick={() => onChangeUnitSystem(UnitSystem.Imperial)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                unitSystem === UnitSystem.Imperial
                  ? 'bg-slate-800 text-cyan-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Imperial
            </button>
          </div>

          {/* Export telemetry CSV */}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={sampleCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#111827] hover:bg-slate-800 disabled:opacity-40 border border-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
};
