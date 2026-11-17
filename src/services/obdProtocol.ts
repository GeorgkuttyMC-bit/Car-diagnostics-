import { ReadinessMonitor, TelemetryFrame } from '../types/obd';

export interface ParsedPidValue {
  pid: string;
  name: string;
  value: number | string;
  unit: string;
}

/**
 * Normalizes raw ELM327 ASCII lines into clean hex tokens.
 */
export function cleanElmResponse(raw: string): string[] {
  return raw
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim().toUpperCase())
    .filter(
      (line) =>
        line.length > 0 &&
        line !== '>' &&
        !line.startsWith('SEARCHING') &&
        !line.startsWith('BUS INIT') &&
        line !== 'OK'
    );
}

/**
 * Extracts byte array from an OBD-II Mode 01 response line (e.g. "41 0C 1A F8" or "410C1AF8").
 */
export function extractMode01Bytes(line: string, expectedPid: string): number[] | null {
  const compact = line.replace(/\s+/g, '');
  const prefix = `41${expectedPid.toUpperCase()}`;
  const idx = compact.indexOf(prefix);
  if (idx === -1) return null;

  const dataHex = compact.slice(idx + prefix.length);
  if (dataHex.length < 2) return null;

  const bytes: number[] = [];
  for (let i = 0; i + 1 < dataHex.length; i += 2) {
    const parsed = parseInt(dataHex.slice(i, i + 2), 16);
    if (!Number.isNaN(parsed)) {
      bytes.push(parsed);
    }
  }
  return bytes;
}

/**
 * Decodes a single Mode 01 PID hex payload into engineering units.
 */
export function decodeMode01Pid(pid: string, bytes: number[]): ParsedPidValue | null {
  const p = pid.toUpperCase();
  const A = bytes[0] ?? 0;
  const B = bytes[1] ?? 0;

  switch (p) {
    case '04':
      return { pid: p, name: 'Calculated Engine Load', value: +(A * (100 / 255)).toFixed(1), unit: '%' };
    case '05':
      return { pid: p, name: 'Engine Coolant Temp', value: A - 40, unit: '°C' };
    case '06':
      return { pid: p, name: 'Short Term Fuel Trim B1', value: +(((A - 128) * 100) / 128).toFixed(1), unit: '%' };
    case '07':
      return { pid: p, name: 'Long Term Fuel Trim B1', value: +(((A - 128) * 100) / 128).toFixed(1), unit: '%' };
    case '0B':
      return { pid: p, name: 'Intake Manifold Pressure', value: A, unit: 'kPa' };
    case '0C':
      return { pid: p, name: 'Engine RPM', value: Math.round(((A * 256) + B) / 4), unit: 'RPM' };
    case '0D':
      return { pid: p, name: 'Vehicle Speed', value: A, unit: 'km/h' };
    case '0F':
      return { pid: p, name: 'Intake Air Temp', value: A - 40, unit: '°C' };
    case '10':
      return { pid: p, name: 'Mass Air Flow Rate', value: +(((A * 256) + B) / 100).toFixed(2), unit: 'g/s' };
    case '11':
      return { pid: p, name: 'Throttle Position', value: +(A * (100 / 255)).toFixed(1), unit: '%' };
    case '2F':
      return { pid: p, name: 'Fuel Tank Level', value: +(A * (100 / 255)).toFixed(1), unit: '%' };
    case '42':
      return { pid: p, name: 'Control Module Voltage', value: +(((A * 256) + B) / 1000).toFixed(2), unit: 'V' };
    default:
      return null;
  }
}

/**
 * Decodes SAE J1979 Mode 03 (Stored) or Mode 07 (Pending) DTC hex responses.
 */
export function decodeDtcResponse(raw: string, expectedHeader: '43' | '47'): string[] {
  const lines = cleanElmResponse(raw);
  const codes = new Set<string>();
  const prefixChars = ['P', 'C', 'B', 'U'];

  for (const line of lines) {
    const compact = line.replace(/\s+/g, '');
    const headerIdx = compact.indexOf(expectedHeader);
    if (headerIdx === -1) continue;

    // CAN responses may include a DTC count byte after 43/47, or direct 2-byte pairs.
    let hexPayload = compact.slice(headerIdx + 2);
    // If odd number of bytes (e.g. 1-byte count + N*2 bytes), drop the leading count byte
    if ((hexPayload.length / 2) % 2 === 1 && hexPayload.length >= 2) {
      hexPayload = hexPayload.slice(2);
    }

    for (let i = 0; i + 3 < hexPayload.length; i += 4) {
      const word = hexPayload.slice(i, i + 4);
      if (word === '0000') continue;

      const firstByte = parseInt(word.slice(0, 2), 16);
      const secondByte = parseInt(word.slice(2, 4), 16);
      if (Number.isNaN(firstByte) || Number.isNaN(secondByte)) continue;

      const systemIdx = (firstByte >> 6) & 0x03;
      const secondDigit = (firstByte >> 4) & 0x03;
      const thirdDigit = firstByte & 0x0f;
      const fourthDigit = (secondByte >> 4) & 0x0f;
      const fifthDigit = secondByte & 0x0f;

      const dtc =
        prefixChars[systemIdx] +
        secondDigit.toString(10) +
        thirdDigit.toString(16).toUpperCase() +
        fourthDigit.toString(16).toUpperCase() +
        fifthDigit.toString(16).toUpperCase();

      codes.add(dtc);
    }
  }

  return Array.from(codes);
}

/**
 * Decodes Mode 01 PID 01 MIL status, DTC count, and I/M readiness monitors.
 */
export function decodePid01Status(bytes: number[]): {
  milOn: boolean;
  dtcCount: number;
  monitors: ReadinessMonitor[];
} {
  const A = bytes[0] ?? 0;
  const B = bytes[1] ?? 0;
  const C = bytes[2] ?? 0;
  const D = bytes[3] ?? 0;

  const milOn = (A & 0x80) !== 0;
  const dtcCount = A & 0x7f;

  // Common spark-ignition monitors (B: bits 0-2 support, bits 4-6 incomplete; C: support, D: incomplete)
  const monitors: ReadinessMonitor[] = [
    { id: 'misfire', name: 'Misfire Monitor', supported: (B & 0x01) !== 0, complete: (B & 0x10) === 0 },
    { id: 'fuel', name: 'Fuel System', supported: (B & 0x02) !== 0, complete: (B & 0x20) === 0 },
    { id: 'components', name: 'Comprehensive Components', supported: (B & 0x04) !== 0, complete: (B & 0x40) === 0 },
    { id: 'catalyst', name: 'Catalyst', supported: (C & 0x01) !== 0, complete: (D & 0x01) === 0 },
    { id: 'heated_cat', name: 'Heated Catalyst', supported: (C & 0x02) !== 0, complete: (D & 0x02) === 0 },
    { id: 'evap', name: 'EVAP System', supported: (C & 0x04) !== 0, complete: (D & 0x04) === 0 },
    { id: 'o2', name: 'O2 Sensor', supported: (C & 0x20) !== 0, complete: (D & 0x20) === 0 },
    { id: 'o2_heater', name: 'O2 Sensor Heater', supported: (C & 0x40) !== 0, complete: (D & 0x40) === 0 },
    { id: 'egr', name: 'EGR / VVT System', supported: (C & 0x80) !== 0, complete: (D & 0x80) === 0 },
  ];

  return { milOn, dtcCount, monitors };
}

/**
 * Calculates instantaneous fuel flow (L/h), L/100km, MPG, and CO2 g/km from MAF or MAP speed-density.
 */
export function computeFuelMetrics(params: {
  rpm: number;
  speedKmh: number;
  mafGs: number;
  mapKpa: number;
  intakeTempC: number;
  stftPct: number;
  ltftPct: number;
  displacementL: number;
  fuelType: 'gasoline' | 'diesel';
}): Pick<TelemetryFrame, 'fuelFlowLh' | 'instantL100km' | 'instantMpg' | 'co2Gkm'> {
  const { rpm, speedKmh, mafGs, mapKpa, intakeTempC, stftPct, ltftPct, displacementL, fuelType } = params;

  const afr = fuelType === 'diesel' ? 18.0 : 14.7;
  const fuelDensityGPerL = fuelType === 'diesel' ? 832 : 745;
  const co2GPerLiter = fuelType === 'diesel' ? 2640 : 2310;

  let effectiveMafGs = mafGs;

  // Speed-density fallback if MAF sensor is absent or 0 during running engine
  if (effectiveMafGs <= 0.1 && rpm > 250 && mapKpa > 10) {
    const tempK = Math.max(233, intakeTempC + 273.15);
    const ve = 0.82;
    const airMassPerIntakeG = (mapKpa * displacementL * ve) / ((8.314 / 28.97) * tempK);
    effectiveMafGs = (airMassPerIntakeG * (rpm / 60)) / 2;
  }

  // Account for ECU fuel trim enrichment/enleanment
  const trimFactor = 1 + (stftPct + ltftPct) / 100;
  const rawFuelFlowLh = ((effectiveMafGs / afr) * 3600 * Math.max(0.75, trimFactor)) / fuelDensityGPerL;
  const fuelFlowLh = rpm < 250 ? 0 : Math.max(0.25, +rawFuelFlowLh.toFixed(2));

  let instantL100km = 0;
  let instantMpg = 0;
  let co2Gkm = 0;

  if (speedKmh >= 4) {
    instantL100km = Math.min(45, +((fuelFlowLh / speedKmh) * 100).toFixed(1));
    instantMpg = instantL100km > 0.1 ? +(235.215 / instantL100km).toFixed(1) : 99.9;
    co2Gkm = Math.round((instantL100km / 100) * co2GPerLiter);
  }

  return {
    fuelFlowLh,
    instantL100km,
    instantMpg,
    co2Gkm,
  };
}
