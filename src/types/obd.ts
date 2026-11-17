export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Initializing = 'initializing',
  ConnectedBluetooth = 'connected_bluetooth',
  Simulating = 'simulating',
  Error = 'error',
}

export enum DrivingScenario {
  EcoCruise = 'eco_cruise',
  CityTraffic = 'city_traffic',
  HighwayFast = 'highway_fast',
  SteepAscent = 'steep_ascent',
  FaultCondition = 'fault_condition',
}

export enum UnitSystem {
  Metric = 'metric',
  Imperial = 'imperial',
}

export enum WorkspaceTab {
  Telemetry = 'telemetry',
  FuelCoach = 'fuel_coach',
  Diagnostics = 'diagnostics',
  TripLogs = 'trip_logs',
}

export interface TelemetryFrame {
  timestamp: number;
  rpm: number;
  speedKmh: number;
  coolantTempC: number;
  intakeTempC: number;
  engineLoadPct: number;
  throttlePct: number;
  mafGs: number;
  mapKpa: number;
  stftPct: number;
  ltftPct: number;
  voltageV: number;
  fuelLevelPct: number;
  fuelFlowLh: number;
  instantL100km: number;
  instantMpg: number;
  co2Gkm: number;
  gearEstimate: number;
}

export interface TelemetrySample {
  timestamp: number;
  elapsedSec: number;
  rpm: number;
  speedKmh: number;
  instantL100km: number;
  instantMpg: number;
  engineLoadPct: number;
  throttlePct: number;
  efficiencyScore: number;
}

export type DtcSeverity = 'critical' | 'warning' | 'advisory';
export type DtcStatus = 'stored' | 'pending';

export interface DtcDefinition {
  code: string;
  title: string;
  subsystem: string;
  severity: DtcSeverity;
  fuelImpactPct: string;
  description: string;
  causes: string[];
  recommendedAction: string;
}

export interface ActiveDtc extends DtcDefinition {
  status: DtcStatus;
  detectedAt: number;
  freezeFrame?: {
    rpm: number;
    speedKmh: number;
    coolantTempC: number;
    engineLoadPct: number;
    stftPct: number;
    ltftPct: number;
  };
}

export interface ReadinessMonitor {
  id: string;
  name: string;
  supported: boolean;
  complete: boolean;
}

export interface CoachingDirective {
  id: string;
  severity: 'optimal' | 'caution' | 'alert';
  title: string;
  detail: string;
  estimatedSavingsPct: number;
}

export interface EfficiencyBreakdown {
  overallScore: number;
  throttleSmoothness: number;
  rpmDiscipline: number;
  cruiseEconomy: number;
  idleDiscipline: number;
  thermalReadiness: number;
  fuelShareLiters: {
    cruiseOptimal: number;
    idleWaste: number;
    accelerationSurge: number;
    aeroDrag: number;
  };
  directives: CoachingDirective[];
}

export interface TripSummary {
  id: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  distanceKm: number;
  fuelUsedLiters: number;
  avgL100km: number;
  avgMpg: number;
  avgEfficiencyScore: number;
  peakCoolantC: number;
  peakRpm: number;
  idleTimeSec: number;
  dtcCount: number;
  source: 'bluetooth' | 'simulator';
  vehicleName: string;
}

export interface TerminalLogEntry {
  id: string;
  timestamp: number;
  direction: 'tx' | 'rx' | 'info' | 'error';
  message: string;
  decoded?: string;
}

export interface VehicleMeta {
  deviceName: string;
  protocol: string;
  vin: string;
  displacementL: number;
  fuelType: 'gasoline' | 'diesel';
  milOn: boolean;
  dtcCountFromMil: number;
}
