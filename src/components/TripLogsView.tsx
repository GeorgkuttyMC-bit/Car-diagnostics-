import React, { useState } from 'react';
import { Save, Trash2, Download, Search } from 'lucide-react';
import { TripSummary, UnitSystem } from '../types/obd';

interface TripLogsViewProps {
  trips: TripSummary[];
  currentSession: {
    durationSec: number;
    distanceKm: number;
    fuelUsedLiters: number;
    avgL100km: number;
    avgMpg: number;
    avgEfficiencyScore: number;
    idleTimeSec: number;
    isActive: boolean;
  };
  unitSystem: UnitSystem;
  onSaveCurrentTrip: () => void;
  onDeleteTrip: (id: string) => void;
  onExportTripsCsv: () => void;
}

export const TripLogsView: React.FC<TripLogsViewProps> = ({
  trips,
  currentSession,
  unitSystem,
  onSaveCurrentTrip,
  onDeleteTrip,
  onExportTripsCsv,
}) => {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'bluetooth' | 'simulator'>('all');
  const [query, setQuery] = useState('');

  const filteredTrips = trips.filter((trip) => {
    const matchesSource = sourceFilter === 'all' || trip.source === sourceFilter;
    const matchesQuery =
      !query.trim() ||
      trip.vehicleName.toLowerCase().includes(query.toLowerCase()) ||
      new Date(trip.startedAt).toLocaleDateString().includes(query);
    return matchesSource && matchesQuery;
  });

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="space-y-6">
      {/* Active Session Accumulator */}
      <div className="bg-[#0D1117] border border-slate-800 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 flex-1">
          <div>
            <p className="text-xs font-mono uppercase text-slate-400">Active Duration</p>
            <p className="mt-1 text-lg font-mono font-semibold text-slate-100 tabular-nums">
              {formatDuration(currentSession.durationSec)}
            </p>
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-slate-400">Distance</p>
            <p className="mt-1 text-lg font-mono font-semibold text-slate-100 tabular-nums">
              {unitSystem === UnitSystem.Metric
                ? `${currentSession.distanceKm.toFixed(2)} km`
                : `${(currentSession.distanceKm * 0.621371).toFixed(2)} mi`}
            </p>
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-slate-400">Avg Economy</p>
            <p className="mt-1 text-lg font-mono font-semibold text-cyan-400 tabular-nums">
              {currentSession.avgL100km > 0
                ? unitSystem === UnitSystem.Metric
                  ? `${currentSession.avgL100km.toFixed(1)} L/100km`
                  : `${currentSession.avgMpg.toFixed(1)} MPG`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-slate-400">Fuel Used</p>
            <p className="mt-1 text-lg font-mono font-semibold text-slate-100 tabular-nums">
              {unitSystem === UnitSystem.Metric
                ? `${currentSession.fuelUsedLiters.toFixed(3)} L`
                : `${(currentSession.fuelUsedLiters * 0.264172).toFixed(3)} gal`}
            </p>
          </div>
          <div>
            <p className="text-xs font-mono uppercase text-slate-400">Avg Efficiency</p>
            <p className="mt-1 text-lg font-mono font-semibold text-emerald-400 tabular-nums">
              {currentSession.avgEfficiencyScore > 0 ? `${currentSession.avgEfficiencyScore}/100` : '—'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSaveCurrentTrip}
          disabled={currentSession.durationSec < 3}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <Save className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Save Session to Log</span>
        </button>
      </div>

      {/* Saved Trips Table */}
      <div className="bg-[#0D1117] border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Recorded Trip Logs</h2>
            <p className="text-xs text-slate-400">
              Stored locally in browser storage ({trips.length} sessions)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vehicle or date..."
                aria-label="Search trip logs"
                className="bg-[#07090E] border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center p-0.5 bg-[#07090E] border border-slate-800 rounded-md">
              {(['all', 'bluetooth', 'simulator'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  className={`px-2.5 py-1 text-xs font-medium capitalize rounded transition-colors ${
                    sourceFilter === src
                      ? 'bg-slate-800 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onExportTripsCsv}
              disabled={trips.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#111827] hover:bg-slate-800 disabled:opacity-40 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export All CSV</span>
            </button>
          </div>
        </div>

        {filteredTrips.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No saved driving sessions match this filter. Drive or run a simulated session and click
            &quot;Save Session to Log&quot; to record efficiency benchmarks.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 bg-[#0B0F17]">
                  <th className="py-2.5 px-4">Date &amp; Vehicle</th>
                  <th className="py-2.5 px-4">Source</th>
                  <th className="py-2.5 px-4 text-right">Duration</th>
                  <th className="py-2.5 px-4 text-right">Distance</th>
                  <th className="py-2.5 px-4 text-right">Avg Economy</th>
                  <th className="py-2.5 px-4 text-right">Fuel Used</th>
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-4 text-right">DTCs</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{trip.vehicleName}</div>
                      <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                        {new Date(trip.startedAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 capitalize">{trip.source}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      {formatDuration(trip.durationSec)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                      {unitSystem === UnitSystem.Metric
                        ? `${trip.distanceKm.toFixed(2)} km`
                        : `${(trip.distanceKm * 0.621371).toFixed(2)} mi`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-cyan-400 font-semibold">
                      {unitSystem === UnitSystem.Metric
                        ? `${trip.avgL100km.toFixed(1)} L/100km`
                        : `${trip.avgMpg.toFixed(1)} MPG`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      {unitSystem === UnitSystem.Metric
                        ? `${trip.fuelUsedLiters.toFixed(2)} L`
                        : `${(trip.fuelUsedLiters * 0.264172).toFixed(2)} gal`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span
                        className={
                          trip.avgEfficiencyScore >= 78
                            ? 'text-emerald-400'
                            : trip.avgEfficiencyScore >= 58
                              ? 'text-amber-400'
                              : 'text-rose-400'
                        }
                      >
                        {trip.avgEfficiencyScore}/100
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300">
                      {trip.dtcCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteTrip(trip.id)}
                        aria-label={`Delete trip from ${new Date(trip.startedAt).toLocaleString()}`}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
