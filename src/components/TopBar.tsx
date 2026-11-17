import React from 'react';
import { Bluetooth, BluetoothConnected, Loader2, Power } from 'lucide-react';
import { ConnectionState, WorkspaceTab } from '../types/obd';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  connectionState: ConnectionState;
  onConnectBluetooth: () => void;
  onDisconnect: () => void;
  dtcAlertCount: number;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: WorkspaceTab.Telemetry, label: 'Live Telemetry' },
  { id: WorkspaceTab.FuelCoach, label: 'Fuel Coach' },
  { id: WorkspaceTab.Diagnostics, label: 'Diagnostics' },
  { id: WorkspaceTab.TripLogs, label: 'Trip Logs' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  connectionState,
  onConnectBluetooth,
  onDisconnect,
  dtcAlertCount,
}) => {
  const isConnected =
    connectionState === ConnectionState.ConnectedBluetooth ||
    connectionState === ConnectionState.Simulating;
  const isBusy =
    connectionState === ConnectionState.Connecting ||
    connectionState === ConnectionState.Initializing;

  return (
    <header className="border-b border-slate-800/90 bg-[#07090E]/95 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab(WorkspaceTab.Telemetry)}
            className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded px-1"
          >
            Vektor OBD
          </button>
        </div>

        {/* Zone 2: 4 single-line workspace navigation links */}
        <nav aria-label="Primary workspace" className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-sm ${
                  isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <span>{item.label}</span>
                {item.id === WorkspaceTab.Diagnostics && dtcAlertCount > 0 && (
                  <span className="ml-1.5 font-mono text-xs text-amber-400 tabular-nums">
                    ({dtcAlertCount})
                  </span>
                )}
                {isActive && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 bg-cyan-400" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {isConnected ? (
            <button
              type="button"
              onClick={onDisconnect}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {connectionState === ConnectionState.ConnectedBluetooth ? (
                <BluetoothConnected className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              ) : (
                <Power className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              )}
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectBluetooth}
              disabled={isBusy}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090E]"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Bluetooth className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{isBusy ? 'Pairing...' : 'Connect Bluetooth'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation strip */}
      <nav
        aria-label="Mobile workspace"
        className="flex md:hidden items-center justify-between border-t border-slate-800/80 px-3 overflow-x-auto"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-2.5 px-2.5 text-xs font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                isActive
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
              {item.id === WorkspaceTab.Diagnostics && dtcAlertCount > 0 ? ` (${dtcAlertCount})` : ''}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
