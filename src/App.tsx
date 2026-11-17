/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DiagnosticsView } from './components/DiagnosticsView';
import { FuelCoachView } from './components/FuelCoachView';
import { LiveTelemetryView } from './components/LiveTelemetryView';
import { TelemetryRibbon } from './components/TelemetryRibbon';
import { TopBar } from './components/TopBar';
import { TripLogsView } from './components/TripLogsView';
import { lookupDtcDefinition } from './data/dtcDatabase';
import { isWebBluetoothSupported, ObdBluetoothClient } from './services/obdBluetooth';
import { cleanElmResponse, decodeMode01Pid, extractMode01Bytes } from './services/obdProtocol';
import { ObdSimulator } from './services/obdSimulator';
import {
  ActiveDtc,
  ConnectionState,
  DrivingScenario,
  ReadinessMonitor,
  TelemetryFrame,
  TelemetrySample,
  TerminalLogEntry,
  TripSummary,
  UnitSystem,
  VehicleMeta,
  WorkspaceTab,
} from './types/obd';
import { evaluateFuelEfficiency } from './utils/fuelCoach';

const TRIPS_STORAGE_KEY = 'vektor_obd_trips_v1';

const DEFAULT_META: VehicleMeta = {
  deviceName: 'ELM327 Adapter',
  protocol: 'ISO 15765-4 CAN (11-bit 500 kbaud)',
  vin: '1HGCM82633A004352',
  displacementL: 2.0,
  fuelType: 'gasoline',
  milOn: false,
  dtcCountFromMil: 0,
};

function loadSavedTrips(): TripSummary[] {
  try {
    const raw = localStorage.getItem(TRIPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(WorkspaceTab.Telemetry);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(UnitSystem.Metric);
  const [scenario, setScenario] = useState<DrivingScenario>(DrivingScenario.EcoCruise);

  const [vehicleMeta, setVehicleMeta] = useState<VehicleMeta>(DEFAULT_META);
  const [currentFrame, setCurrentFrame] = useState<TelemetryFrame | null>(null);
  const [samples, setSamples] = useState<TelemetrySample[]>([]);
  const [dtcs, setDtcs] = useState<ActiveDtc[]>([]);
  const [monitors, setMonitors] = useState<ReadinessMonitor[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const [trips, setTrips] = useState<TripSummary[]>(loadSavedTrips);

  // Session accumulators
  const [sessionStats, setSessionStats] = useState({
    startedAt: Date.now(),
    durationSec: 0,
    distanceKm: 0,
    fuelUsedLiters: 0,
    idleTimeSec: 0,
    peakCoolantC: 0,
    peakRpm: 0,
    efficiencySum: 0,
    efficiencyCount: 0,
  });

  const bluetoothClientRef = useRef<ObdBluetoothClient | null>(null);
  const simulatorRef = useRef<ObdSimulator>(new ObdSimulator());
  const simTimerRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const latestFrameRef = useRef<TelemetryFrame | null>(null);

  const bluetoothSupported = useMemo(() => isWebBluetoothSupported(), []);

  useEffect(() => {
    try {
      localStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(trips));
    } catch {
      // Ignore storage quota errors
    }
  }, [trips]);

  const appendLog = useCallback(
    (direction: TerminalLogEntry['direction'], message: string, decoded?: string) => {
      setTerminalLogs((prev) => [
        ...prev.slice(-80),
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
          direction,
          message,
          decoded,
        },
      ]);
    },
    []
  );

  const ingestFrame = useCallback((frame: TelemetryFrame) => {
    const now = frame.timestamp;
    const prevTime = lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const dtSec = prevTime ? Math.min(3, Math.max(0.05, (now - prevTime) / 1000)) : 0.45;
    const dtHours = dtSec / 3600;

    latestFrameRef.current = frame;
    setCurrentFrame(frame);

    setSamples((prevSamples) => {
      const elapsedSec = Math.round((now - sessionStartRef.current) / 1000);
      const idleRatio =
        prevSamples.length > 0
          ? prevSamples.filter((s) => s.speedKmh < 3).length / prevSamples.length
          : 0;
      const eff = evaluateFuelEfficiency(frame, prevSamples, idleRatio);

      const nextSample: TelemetrySample = {
        timestamp: now,
        elapsedSec,
        rpm: frame.rpm,
        speedKmh: frame.speedKmh,
        instantL100km: frame.instantL100km,
        instantMpg: frame.instantMpg,
        engineLoadPct: frame.engineLoadPct,
        throttlePct: frame.throttlePct,
        efficiencyScore: eff.overallScore,
      };

      setSessionStats((prev) => ({
        ...prev,
        durationSec: prev.durationSec + dtSec,
        distanceKm: prev.distanceKm + frame.speedKmh * dtHours,
        fuelUsedLiters: prev.fuelUsedLiters + frame.fuelFlowLh * dtHours,
        idleTimeSec: prev.idleTimeSec + (frame.speedKmh < 3 && frame.rpm > 300 ? dtSec : 0),
        peakCoolantC: Math.max(prev.peakCoolantC, frame.coolantTempC),
        peakRpm: Math.max(prev.peakRpm, frame.rpm),
        efficiencySum: prev.efficiencySum + eff.overallScore,
        efficiencyCount: prev.efficiencyCount + 1,
      }));

      return [...prevSamples.slice(-149), nextSample];
    });
  }, []);

  const resetSession = useCallback(() => {
    const now = Date.now();
    sessionStartRef.current = now;
    lastFrameTimeRef.current = null;
    setSamples([]);
    setCurrentFrame(null);
    setSessionStats({
      startedAt: now,
      durationSec: 0,
      distanceKm: 0,
      fuelUsedLiters: 0,
      idleTimeSec: 0,
      peakCoolantC: 0,
      peakRpm: 0,
      efficiencySum: 0,
      efficiencyCount: 0,
    });
  }, []);

  const stopSimulator = useCallback(() => {
    if (simTimerRef.current !== null) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    stopSimulator();
    if (bluetoothClientRef.current) {
      bluetoothClientRef.current.disconnect();
      bluetoothClientRef.current = null;
    }
    setConnectionState(ConnectionState.Disconnected);
    appendLog('info', 'Telemetry session closed.');
  }, [appendLog, stopSimulator]);

  const applyDiagnosticCodes = useCallback(
    (stored: string[], pending: string[], frameSnapshot: TelemetryFrame | null) => {
      const freeze = frameSnapshot
        ? {
            rpm: frameSnapshot.rpm,
            speedKmh: frameSnapshot.speedKmh,
            coolantTempC: frameSnapshot.coolantTempC,
            engineLoadPct: frameSnapshot.engineLoadPct,
            stftPct: frameSnapshot.stftPct,
            ltftPct: frameSnapshot.ltftPct,
          }
        : undefined;

      const combined: ActiveDtc[] = [
        ...stored.map((code) => ({
          ...lookupDtcDefinition(code),
          status: 'stored' as const,
          detectedAt: Date.now(),
          freezeFrame: freeze,
        })),
        ...pending.map((code) => ({
          ...lookupDtcDefinition(code),
          status: 'pending' as const,
          detectedAt: Date.now(),
          freezeFrame: freeze,
        })),
      ];
      setDtcs(combined);
    },
    []
  );

  const handleConnectBluetooth = useCallback(
    async (acceptAll = false) => {
      stopSimulator();
      setConnectionError(null);
      resetSession();

      if (!bluetoothSupported) {
        setConnectionError(
          'Web Bluetooth API is unavailable in this browser/context. Use Google Chrome or Microsoft Edge over HTTPS, or click "Launch Live Drive Simulator".'
        );
        return;
      }

      const client = new ObdBluetoothClient({
        onLog: appendLog,
        onFrame: ingestFrame,
        onMetaUpdate: (partial) => setVehicleMeta((prev) => ({ ...prev, ...partial })),
        onDisconnect: (reason) => {
          setConnectionState(ConnectionState.Disconnected);
          if (reason) setConnectionError(reason);
        },
      });

      client.setVehicleProfile(vehicleMeta.displacementL, vehicleMeta.fuelType);
      bluetoothClientRef.current = client;
      setConnectionState(ConnectionState.Connecting);

      try {
        await client.connect(acceptAll);
        setConnectionState(ConnectionState.Initializing);

        const diag = await client.scanDiagnostics();
        setMonitors(diag.monitors);
        applyDiagnosticCodes(diag.storedCodes, diag.pendingCodes, null);

        setConnectionState(ConnectionState.ConnectedBluetooth);
        client.startPolling();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        client.disconnect();
        bluetoothClientRef.current = null;
        if (msg.toLowerCase().includes('cancelled') || msg.toLowerCase().includes('canceled')) {
          setConnectionState(ConnectionState.Disconnected);
          setConnectionError('Bluetooth pairing dialog was cancelled.');
        } else {
          setConnectionState(ConnectionState.Error);
          setConnectionError(msg);
        }
        appendLog('error', msg);
      }
    },
    [
      appendLog,
      applyDiagnosticCodes,
      bluetoothSupported,
      ingestFrame,
      resetSession,
      stopSimulator,
      vehicleMeta.displacementL,
      vehicleMeta.fuelType,
    ]
  );

  const handleStartSimulator = useCallback(() => {
    if (bluetoothClientRef.current) {
      bluetoothClientRef.current.disconnect();
      bluetoothClientRef.current = null;
    }
    stopSimulator();
    setConnectionError(null);
    resetSession();

    const sim = simulatorRef.current;
    sim.setScenario(scenario);
    sim.setVehicleProfile(vehicleMeta.displacementL, vehicleMeta.fuelType);

    setVehicleMeta((prev) => ({
      ...prev,
      deviceName: 'Simulated OBD-II ECU',
      protocol: 'ISO 15765-4 CAN (Simulated)',
      milOn: scenario === DrivingScenario.FaultCondition,
    }));

    setConnectionState(ConnectionState.Simulating);
    appendLog('info', `Started simulated OBD-II drive stream (${scenario}).`);

    const initialFrame = sim.nextFrame();
    ingestFrame(initialFrame);

    const simCodes = sim.getSimulatedDtcCodes();
    applyDiagnosticCodes(simCodes.stored, simCodes.pending, initialFrame);
    setMonitors(sim.getSimulatedMonitors());

    simTimerRef.current = window.setInterval(() => {
      const next = sim.nextFrame();
      ingestFrame(next);
    }, 450);
  }, [
    appendLog,
    applyDiagnosticCodes,
    ingestFrame,
    resetSession,
    scenario,
    stopSimulator,
    vehicleMeta.displacementL,
    vehicleMeta.fuelType,
  ]);

  useEffect(() => {
    return () => {
      stopSimulator();
      bluetoothClientRef.current?.disconnect();
    };
  }, [stopSimulator]);

  const handleChangeScenario = useCallback(
    (nextScenario: DrivingScenario) => {
      setScenario(nextScenario);
      simulatorRef.current.setScenario(nextScenario);
      if (connectionState === ConnectionState.Simulating) {
        const simCodes = simulatorRef.current.getSimulatedDtcCodes();
        applyDiagnosticCodes(simCodes.stored, simCodes.pending, latestFrameRef.current);
        setMonitors(simulatorRef.current.getSimulatedMonitors());
        setVehicleMeta((prev) => ({
          ...prev,
          milOn: nextScenario === DrivingScenario.FaultCondition,
        }));
        appendLog('info', `Switched drive profile to ${nextScenario}.`);
      }
    },
    [appendLog, applyDiagnosticCodes, connectionState]
  );

  const handleChangeVehicleProfile = useCallback(
    (displacementL: number, fuelType: 'gasoline' | 'diesel') => {
      setVehicleMeta((prev) => ({ ...prev, displacementL, fuelType }));
      simulatorRef.current.setVehicleProfile(displacementL, fuelType);
      bluetoothClientRef.current?.setVehicleProfile(displacementL, fuelType);
    },
    []
  );

  const handleScanDiagnostics = useCallback(async () => {
    setIsScanning(true);
    try {
      if (connectionState === ConnectionState.ConnectedBluetooth && bluetoothClientRef.current) {
        const result = await bluetoothClientRef.current.scanDiagnostics();
        setMonitors(result.monitors);
        applyDiagnosticCodes(result.storedCodes, result.pendingCodes, latestFrameRef.current);
        appendLog(
          'info',
          `ECU scan complete: ${result.storedCodes.length} stored, ${result.pendingCodes.length} pending.`
        );
      } else if (connectionState === ConnectionState.Simulating) {
        await new Promise((r) => setTimeout(r, 450));
        const simCodes = simulatorRef.current.getSimulatedDtcCodes();
        applyDiagnosticCodes(simCodes.stored, simCodes.pending, latestFrameRef.current);
        setMonitors(simulatorRef.current.getSimulatedMonitors());
        appendLog(
          'info',
          `Simulated Mode 03/07 scan: ${simCodes.stored.length} stored, ${simCodes.pending.length} pending.`
        );
      }
    } finally {
      setIsScanning(false);
    }
  }, [appendLog, applyDiagnosticCodes, connectionState]);

  const handleClearDtcs = useCallback(async () => {
    if (connectionState === ConnectionState.ConnectedBluetooth && bluetoothClientRef.current) {
      try {
        await bluetoothClientRef.current.clearDtcs();
        setDtcs([]);
        setVehicleMeta((prev) => ({ ...prev, milOn: false, dtcCountFromMil: 0 }));
        appendLog('info', 'Mode 04 sent: DTCs & MIL cleared.');
      } catch (err) {
        appendLog('error', err instanceof Error ? err.message : String(err));
      }
    } else if (connectionState === ConnectionState.Simulating) {
      setDtcs([]);
      setVehicleMeta((prev) => ({ ...prev, milOn: false, dtcCountFromMil: 0 }));
      appendLog('tx', '04');
      appendLog('rx', '44', 'DTCs & MIL cleared');
    }
  }, [appendLog, connectionState]);

  const handleSendRawCommand = useCallback(
    async (rawCmd: string) => {
      const cmd = rawCmd.trim().toUpperCase();
      if (!cmd) return;

      if (connectionState === ConnectionState.ConnectedBluetooth && bluetoothClientRef.current) {
        try {
          const resp = await bluetoothClientRef.current.sendCommand(cmd);
          if (cmd.startsWith('01') && cmd.length === 4) {
            const pid = cmd.slice(2, 4);
            for (const line of cleanElmResponse(resp)) {
              const bytes = extractMode01Bytes(line, pid);
              if (bytes) {
                const decoded = decodeMode01Pid(pid, bytes);
                if (decoded) {
                  appendLog('info', `Decoded ${decoded.name}: ${decoded.value} ${decoded.unit}`);
                }
              }
            }
          }
        } catch (err) {
          appendLog('error', err instanceof Error ? err.message : String(err));
        }
        return;
      }

      if (connectionState === ConnectionState.Simulating && latestFrameRef.current) {
        const f = latestFrameRef.current;
        appendLog('tx', cmd);

        if (cmd === '010C') {
          const val = Math.round(f.rpm * 4);
          const a = ((val >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase();
          const b = (val & 0xff).toString(16).padStart(2, '0').toUpperCase();
          appendLog('rx', `41 0C ${a} ${b}`, `${f.rpm} RPM`);
        } else if (cmd === '010D') {
          const a = Math.min(255, Math.round(f.speedKmh)).toString(16).padStart(2, '0').toUpperCase();
          appendLog('rx', `41 0D ${a}`, `${f.speedKmh} km/h`);
        } else if (cmd === '0105') {
          const a = Math.min(255, Math.max(0, f.coolantTempC + 40))
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
          appendLog('rx', `41 05 ${a}`, `${f.coolantTempC} °C`);
        } else if (cmd === '0110') {
          const val = Math.round(f.mafGs * 100);
          const a = ((val >> 8) & 0xff).toString(16).padStart(2, '0').toUpperCase();
          const b = (val & 0xff).toString(16).padStart(2, '0').toUpperCase();
          appendLog('rx', `41 10 ${a} ${b}`, `${f.mafGs} g/s`);
        } else if (cmd === 'ATRV') {
          appendLog('rx', `${f.voltageV.toFixed(1)}V`, 'Control module voltage');
        } else if (cmd === 'ATDP') {
          appendLog('rx', vehicleMeta.protocol);
        } else if (cmd === '03') {
          const simCodes = simulatorRef.current.getSimulatedDtcCodes().stored;
          appendLog(
            'rx',
            simCodes.length ? `43 ${simCodes.join(' ')}` : '43 00',
            simCodes.length ? `${simCodes.length} stored DTC(s)` : 'No stored faults'
          );
        } else if (cmd === '04') {
          handleClearDtcs();
        } else {
          appendLog('rx', 'OK');
        }
      }
    },
    [appendLog, connectionState, handleClearDtcs, vehicleMeta.protocol]
  );

  const idleRatio = useMemo(() => {
    if (samples.length === 0) return 0;
    return samples.filter((s) => s.speedKmh < 3).length / samples.length;
  }, [samples]);

  const currentEfficiency = useMemo(() => {
    if (!currentFrame) return null;
    return evaluateFuelEfficiency(currentFrame, samples, idleRatio);
  }, [currentFrame, idleRatio, samples]);

  const avgL100km = useMemo(() => {
    if (sessionStats.distanceKm <= 0.01) {
      return currentFrame?.instantL100km ?? 0;
    }
    return +((sessionStats.fuelUsedLiters / sessionStats.distanceKm) * 100).toFixed(1);
  }, [currentFrame?.instantL100km, sessionStats.distanceKm, sessionStats.fuelUsedLiters]);

  const avgMpg = useMemo(() => {
    return avgL100km > 0.1 ? +(235.215 / avgL100km).toFixed(1) : 0;
  }, [avgL100km]);

  const avgEfficiencyScore = useMemo(() => {
    if (sessionStats.efficiencyCount === 0) return currentEfficiency?.overallScore ?? 0;
    return Math.round(sessionStats.efficiencySum / sessionStats.efficiencyCount);
  }, [currentEfficiency?.overallScore, sessionStats.efficiencyCount, sessionStats.efficiencySum]);

  const handleSaveCurrentTrip = useCallback(() => {
    const newTrip: TripSummary = {
      id: `trip-${Date.now()}`,
      startedAt: sessionStats.startedAt,
      endedAt: Date.now(),
      durationSec: Math.round(sessionStats.durationSec),
      distanceKm: +sessionStats.distanceKm.toFixed(2),
      fuelUsedLiters: +sessionStats.fuelUsedLiters.toFixed(3),
      avgL100km: avgL100km || 7.2,
      avgMpg: avgMpg || 32.7,
      avgEfficiencyScore: avgEfficiencyScore || 80,
      peakCoolantC: sessionStats.peakCoolantC,
      peakRpm: sessionStats.peakRpm,
      idleTimeSec: Math.round(sessionStats.idleTimeSec),
      dtcCount: dtcs.length,
      source: connectionState === ConnectionState.ConnectedBluetooth ? 'bluetooth' : 'simulator',
      vehicleName: vehicleMeta.deviceName,
    };
    setTrips((prev) => [newTrip, ...prev]);
  }, [
    avgEfficiencyScore,
    avgL100km,
    avgMpg,
    connectionState,
    dtcs.length,
    sessionStats,
    vehicleMeta.deviceName,
  ]);

  const handleDeleteTrip = useCallback((id: string) => {
    setTrips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const triggerCsvDownload = (filename: string, csvText: string) => {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSamplesCsv = useCallback(() => {
    if (samples.length === 0) return;
    const header = 'timestamp_iso,elapsed_sec,speed_kmh,rpm,instant_l100km,instant_mpg,engine_load_pct,throttle_pct,efficiency_score';
    const rows = samples.map((s) =>
      [
        new Date(s.timestamp).toISOString(),
        s.elapsedSec,
        s.speedKmh,
        s.rpm,
        s.instantL100km,
        s.instantMpg,
        s.engineLoadPct,
        s.throttlePct,
        s.efficiencyScore,
      ].join(',')
    );
    triggerCsvDownload(`vektor-obd-telemetry-${Date.now()}.csv`, [header, ...rows].join('\n'));
  }, [samples]);

  const handleExportTripsCsv = useCallback(() => {
    if (trips.length === 0) return;
    const header = 'started_iso,vehicle,source,duration_sec,distance_km,fuel_liters,avg_l100km,avg_mpg,efficiency_score,dtc_count';
    const rows = trips.map((t) =>
      [
        new Date(t.startedAt).toISOString(),
        `"${t.vehicleName.replace(/"/g, '""')}"`,
        t.source,
        t.durationSec,
        t.distanceKm,
        t.fuelUsedLiters,
        t.avgL100km,
        t.avgMpg,
        t.avgEfficiencyScore,
        t.dtcCount,
      ].join(',')
    );
    triggerCsvDownload(`vektor-obd-trips-${Date.now()}.csv`, [header, ...rows].join('\n'));
  }, [trips]);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connectionState={connectionState}
        onConnectBluetooth={() => handleConnectBluetooth(false)}
        onDisconnect={handleDisconnect}
        dtcAlertCount={dtcs.length}
      />

      <TelemetryRibbon
        connectionState={connectionState}
        vehicleMeta={vehicleMeta}
        unitSystem={unitSystem}
        onChangeUnitSystem={setUnitSystem}
        onStartSimulator={handleStartSimulator}
        onExportCsv={handleExportSamplesCsv}
        sampleCount={samples.length}
        displacementL={vehicleMeta.displacementL}
        fuelType={vehicleMeta.fuelType}
        onChangeVehicleProfile={handleChangeVehicleProfile}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === WorkspaceTab.Telemetry && (
          <LiveTelemetryView
            connectionState={connectionState}
            bluetoothSupported={bluetoothSupported}
            connectionError={connectionError}
            frame={currentFrame}
            samples={samples}
            efficiency={currentEfficiency}
            unitSystem={unitSystem}
            scenario={scenario}
            onChangeScenario={handleChangeScenario}
            onConnectBluetooth={handleConnectBluetooth}
            onStartSimulator={handleStartSimulator}
          />
        )}

        {activeTab === WorkspaceTab.FuelCoach && (
          <FuelCoachView
            connectionState={connectionState}
            frame={currentFrame}
            efficiency={currentEfficiency}
            unitSystem={unitSystem}
            avgL100km={avgL100km}
            distanceKm={sessionStats.distanceKm}
            fuelUsedLiters={sessionStats.fuelUsedLiters}
            scenario={scenario}
            onChangeScenario={handleChangeScenario}
            onStartSimulator={handleStartSimulator}
          />
        )}

        {activeTab === WorkspaceTab.Diagnostics && (
          <DiagnosticsView
            connectionState={connectionState}
            vehicleMeta={vehicleMeta}
            dtcs={dtcs}
            monitors={monitors}
            terminalLogs={terminalLogs}
            unitSystem={unitSystem}
            isScanning={isScanning}
            onScanDiagnostics={handleScanDiagnostics}
            onClearDtcs={handleClearDtcs}
            onSendRawCommand={handleSendRawCommand}
            onStartSimulator={handleStartSimulator}
          />
        )}

        {activeTab === WorkspaceTab.TripLogs && (
          <TripLogsView
            trips={trips}
            currentSession={{
              durationSec: sessionStats.durationSec,
              distanceKm: sessionStats.distanceKm,
              fuelUsedLiters: sessionStats.fuelUsedLiters,
              avgL100km,
              avgMpg,
              avgEfficiencyScore,
              idleTimeSec: sessionStats.idleTimeSec,
              isActive:
                connectionState === ConnectionState.ConnectedBluetooth ||
                connectionState === ConnectionState.Simulating,
            }}
            unitSystem={unitSystem}
            onSaveCurrentTrip={handleSaveCurrentTrip}
            onDeleteTrip={handleDeleteTrip}
            onExportTripsCsv={handleExportTripsCsv}
          />
        )}
      </main>
    </div>
  );
}
