import { DtcDefinition } from '../types/obd';

export const DTC_DATABASE: Record<string, DtcDefinition> = {
  P0171: {
    code: 'P0171',
    title: 'System Too Lean (Bank 1)',
    subsystem: 'Fuel & Air Metering',
    severity: 'warning',
    fuelImpactPct: '+8% to +15% consumption',
    description:
      'Long-term and short-term fuel trims indicate excess unmeasured air or insufficient fuel delivery on Bank 1, forcing the ECU to add positive fuel enrichment.',
    causes: [
      'Vacuum leak downstream of the Mass Air Flow (MAF) sensor',
      'Contaminated or drifting MAF sensor element',
      'Weak fuel pump or partially restricted fuel filter',
      'Exhaust leak upstream of the primary heated O2 sensor',
    ],
    recommendedAction:
      'Inspect intake ducting and PCV hoses for cracks, clean the MAF sensor with dedicated MAF cleaner, and verify fuel rail pressure under load.',
  },
  P0172: {
    code: 'P0172',
    title: 'System Too Rich (Bank 1)',
    subsystem: 'Fuel & Air Metering',
    severity: 'warning',
    fuelImpactPct: '+12% to +22% consumption',
    description:
      'The ECU is subtracting fuel aggressively because exhaust oxygen sensors detect excess unburned fuel in Bank 1.',
    causes: [
      'Leaking fuel injector or elevated fuel rail pressure',
      'Faulty coolant temperature sensor reporting cold engine',
      'Stuck-open EVAP purge solenoid valve',
      'Restricted air intake filter',
    ],
    recommendedAction:
      'Check engine air filter condition, verify coolant temp sensor plausibility against ambient, and test EVAP purge valve sealing.',
  },
  P0128: {
    code: 'P0128',
    title: 'Coolant Thermostat Temperature Below Regulating Threshold',
    subsystem: 'Thermal Management',
    severity: 'advisory',
    fuelImpactPct: '+6% to +12% consumption',
    description:
      'Engine coolant fails to reach closed-loop operating temperature within the calibrated warmup window, keeping enrichment active longer.',
    causes: [
      'Thermostat stuck partially or fully open',
      'Low engine coolant level',
      'Slow-responding Engine Coolant Temperature (ECT) sensor',
    ],
    recommendedAction:
      'Monitor live Coolant Temp during highway cruise; if it drops below 78 °C, replace the thermostat assembly.',
  },
  P0101: {
    code: 'P0101',
    title: 'Mass or Volume Air Flow Circuit Range/Performance',
    subsystem: 'Air Induction',
    severity: 'warning',
    fuelImpactPct: '+7% to +14% consumption',
    description:
      'Measured MAF airflow disagrees with expected volumetric efficiency calculated from RPM, throttle angle, and manifold pressure.',
    causes: [
      'Oil or dust fouling on MAF hot-wire element',
      'Torn intake boot between airbox and throttle body',
      'Clogged intake air filter',
    ],
    recommendedAction:
      'Compare idle MAF (typically 2.0–4.5 g/s for 2.0L engines) and inspect intake boot clamps.',
  },
  P0300: {
    code: 'P0300',
    title: 'Random/Multiple Cylinder Misfire Detected',
    subsystem: 'Ignition & Combustion',
    severity: 'critical',
    fuelImpactPct: '+15% to +30% consumption',
    description:
      'Unburned fuel from misfiring cylinders enters the exhaust catalyst, degrading economy and risking catalytic converter thermal damage.',
    causes: [
      'Worn spark plugs or degraded ignition coils',
      'Low fuel delivery pressure or contaminated fuel',
      'Significant intake manifold vacuum leak',
    ],
    recommendedAction:
      'Avoid high-load acceleration immediately. Inspect spark plug gaps, ignition coil boots, and fuel trim balance.',
  },
  P0302: {
    code: 'P0302',
    title: 'Cylinder 2 Misfire Detected',
    subsystem: 'Ignition & Combustion',
    severity: 'critical',
    fuelImpactPct: '+10% to +20% consumption',
    description:
      'Crankshaft velocity sensors detected repeated combustion loss specifically on Cylinder 2.',
    causes: [
      'Faulty Cylinder 2 ignition coil pack or fouled spark plug',
      'Clogged or electrically open Cylinder 2 fuel injector',
      'Low cylinder compression',
    ],
    recommendedAction:
      'Swap Cylinder 2 ignition coil with Cylinder 1 to verify if misfire follows the coil, and inspect spark plug electrode wear.',
  },
  P0420: {
    code: 'P0420',
    title: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    subsystem: 'Emissions & Exhaust',
    severity: 'warning',
    fuelImpactPct: '+2% to +5% consumption',
    description:
      'Downstream O2 sensor switching closely mirrors the upstream sensor, indicating reduced oxygen storage capacity in the catalytic converter.',
    causes: [
      'Aged or thermally damaged three-way catalytic converter',
      'Exhaust leak near the downstream O2 sensor flange',
      'Sluggish upstream wideband/O2 sensor skewing closed-loop control',
    ],
    recommendedAction:
      'Check for exhaust gasket leaks first and resolve any active fuel trim or misfire codes before replacing the catalyst.',
  },
  P0133: {
    code: 'P0133',
    title: 'O2 Sensor Circuit Slow Response (Bank 1 Sensor 1)',
    subsystem: 'Emissions & Closed-Loop Fuel',
    severity: 'warning',
    fuelImpactPct: '+5% to +10% consumption',
    description:
      'Upstream oxygen sensor response latency delays closed-loop air-fuel ratio correction during throttle transitions.',
    causes: [
      'Contaminated or aged upstream O2 sensor',
      'Corroded O2 sensor harness connector',
      'Small exhaust leak upstream of sensor',
    ],
    recommendedAction:
      'Inspect O2 sensor wiring for heat damage and replace upstream sensor if response remains sluggish.',
  },
  P0442: {
    code: 'P0442',
    title: 'Evaporative Emission System Leak Detected (Small Leak)',
    subsystem: 'EVAP Vapor Recovery',
    severity: 'advisory',
    fuelImpactPct: '+1% to +3% vapor loss',
    description:
      'Fuel tank vapor pressure decay exceeds tolerance during EVAP self-test.',
    causes: [
      'Loose or worn fuel filler cap seal',
      'Hairline crack in EVAP purge or vent hose',
      'Seeping purge solenoid valve',
    ],
    recommendedAction:
      'Inspect and tighten the fuel filler cap, verify rubber O-ring elasticity, and clear code after two drive cycles.',
  },
  P0505: {
    code: 'P0505',
    title: 'Idle Air Control System Malfunction',
    subsystem: 'Idle & Throttle Control',
    severity: 'warning',
    fuelImpactPct: '+4% to +9% idle waste',
    description:
      'Target idle RPM deviates significantly from commanded idle speed due to airflow restriction or throttle plate carbon buildup.',
    causes: [
      'Carbon deposits around electronic throttle body bore',
      'Vacuum hose leak downstream of throttle plate',
      'Sticking Idle Air Control (IAC) valve',
    ],
    recommendedAction:
      'Clean the throttle body bore and butterfly plate, then perform an idle air relearn procedure.',
  },
  U0100: {
    code: 'U0100',
    title: 'Lost Communication With ECM/PCM "A"',
    subsystem: 'CAN Bus Network',
    severity: 'critical',
    fuelImpactPct: 'Telemetry interrupted',
    description:
      'High-speed CAN bus module failed to receive periodic heartbeat frames from the primary engine control module.',
    causes: [
      'Low battery voltage (< 11.5 V) causing brownout resets',
      'Loose OBD-II port pin or corroded CAN_H / CAN_L splice',
      'Failing ECM power relay',
    ],
    recommendedAction:
      'Verify battery voltage at rest and alternator output, and reseat the Bluetooth OBD-II adapter firmly.',
  },
};

export function lookupDtcDefinition(rawCode: string): DtcDefinition {
  const code = rawCode.trim().toUpperCase();
  if (DTC_DATABASE[code]) {
    return DTC_DATABASE[code];
  }

  const prefix = code.charAt(0);
  const subsystemMap: Record<string, string> = {
    P: 'Powertrain (Engine & Transmission)',
    C: 'Chassis (ABS & Stability)',
    B: 'Body (Safety & Climate)',
    U: 'Network (CAN Communication)',
  };

  const isManufacturerSpecific = code.charAt(1) === '1' || code.charAt(1) === '3';

  return {
    code,
    title: `${isManufacturerSpecific ? 'Manufacturer-Specific' : 'Standard SAE'} ${subsystemMap[prefix] ?? 'Diagnostic'} Fault`,
    subsystem: subsystemMap[prefix] ?? 'Vehicle Control',
    severity: prefix === 'P' || prefix === 'U' ? 'warning' : 'advisory',
    fuelImpactPct: prefix === 'P' ? 'Potential efficiency impact' : 'Minimal direct fuel impact',
    description: `Diagnostic trouble code ${code} reported by vehicle ECU. Consult OEM service documentation for vehicle-specific circuit diagnostics.`,
    causes: [
      'Sensor signal out of calibrated range',
      'Intermittent wiring harness or connector resistance',
      'Actuator or mechanical subsystem wear',
    ],
    recommendedAction:
      'Record freeze-frame operating parameters and inspect associated subsystem connectors before clearing fault memory.',
  };
}
