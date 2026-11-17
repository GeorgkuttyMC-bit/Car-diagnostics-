import { computeFuelMetrics } from './obdProtocol';
import { DrivingScenario, ReadinessMonitor, TelemetryFrame } from '../types/obd';

export class ObdSimulator {
  private scenario: DrivingScenario = DrivingScenario.EcoCruise;
  private tickCount = 0;
  private speedKmh = 68;
  private coolantTempC = 86;
  private fuelLevelPct = 71.4;
  private displacementL = 2.0;
  private fuelType: 'gasoline' | 'diesel' = 'gasoline';

  public setScenario(scenario: DrivingScenario) {
    this.scenario = scenario;
  }

  public setVehicleProfile(displacementL: number, fuelType: 'gasoline' | 'diesel') {
    this.displacementL = displacementL;
    this.fuelType = fuelType;
  }

  public nextFrame(): TelemetryFrame {
    this.tickCount += 1;
    const t = this.tickCount * 0.35;

    let targetSpeed = 76;
    let throttlePct = 21;
    let engineLoadPct = 36;
    let rpm = 1950;
    let stftPct = 0.8;
    let ltftPct = 1.4;
    let voltageV = 14.15;
    let targetCoolant = 89;
    let gearEstimate = 5;

    switch (this.scenario) {
      case DrivingScenario.EcoCruise: {
        targetSpeed = 76 + Math.sin(t * 0.25) * 4;
        throttlePct = 19 + Math.sin(t * 0.4) * 3.5;
        engineLoadPct = 34 + Math.sin(t * 0.35) * 5;
        gearEstimate = 6;
        rpm = Math.round(1650 + (this.speedKmh / 80) * 320 + Math.sin(t * 0.5) * 45);
        stftPct = +(Math.sin(t * 0.8) * 1.6).toFixed(1);
        ltftPct = 1.1;
        break;
      }

      case DrivingScenario.CityTraffic: {
        const cycle = t % 18;
        if (cycle < 5.5) {
          // Stop light idle
          targetSpeed = 0;
          throttlePct = 12.2;
          engineLoadPct = 21;
          gearEstimate = 0;
          rpm = 740 + Math.round(Math.sin(t * 3) * 18);
        } else if (cycle < 11) {
          // Acceleration launch
          targetSpeed = 48;
          throttlePct = 44 + Math.sin(t * 1.4) * 9;
          engineLoadPct = 66 + Math.sin(t * 1.1) * 8;
          gearEstimate = this.speedKmh < 20 ? 1 : this.speedKmh < 36 ? 2 : 3;
          rpm = Math.round(2150 + (cycle - 5.5) * 260);
        } else {
          // Short urban cruise + deceleration
          targetSpeed = cycle > 15 ? 8 : 42;
          throttlePct = cycle > 15 ? 11.5 : 22;
          engineLoadPct = cycle > 15 ? 15 : 32;
          gearEstimate = cycle > 15 ? 2 : 4;
          rpm = cycle > 15 ? 1150 : 1850;
        }
        stftPct = +(Math.sin(t * 1.2) * 3.1).toFixed(1);
        ltftPct = 2.2;
        break;
      }

      case DrivingScenario.HighwayFast: {
        targetSpeed = 126 + Math.sin(t * 0.2) * 5;
        throttlePct = 38 + Math.sin(t * 0.45) * 4;
        engineLoadPct = 58 + Math.sin(t * 0.3) * 6;
        gearEstimate = 6;
        rpm = Math.round(3150 + Math.sin(t * 0.5) * 90);
        stftPct = +(1.5 + Math.sin(t * 0.9) * 2.1).toFixed(1);
        ltftPct = 2.0;
        break;
      }

      case DrivingScenario.SteepAscent: {
        targetSpeed = 62 + Math.sin(t * 0.3) * 5;
        throttlePct = 64 + Math.sin(t * 0.6) * 8;
        engineLoadPct = 86 + Math.sin(t * 0.5) * 7;
        gearEstimate = 3;
        rpm = Math.round(3680 + Math.sin(t * 0.7) * 180);
        targetCoolant = 97;
        stftPct = +(-2.4 + Math.sin(t * 0.8) * 2.5).toFixed(1);
        ltftPct = 3.1;
        break;
      }

      case DrivingScenario.FaultCondition: {
        targetSpeed = 54 + Math.sin(t * 0.35) * 7;
        throttlePct = 31 + Math.sin(t * 1.5) * 7;
        engineLoadPct = 49 + Math.sin(t * 1.1) * 9;
        gearEstimate = 4;
        rpm = Math.round(2350 + Math.sin(t * 2.1) * 140);
        // Lean fuel trim condition (+18% LTFT, +9% STFT) + cool running thermostat + low charging voltage
        stftPct = +(8.6 + Math.sin(t * 1.3) * 3.2).toFixed(1);
        ltftPct = 18.4;
        targetCoolant = 71;
        voltageV = +(12.15 + Math.sin(t * 0.8) * 0.12).toFixed(2);
        break;
      }
    }

    // Smooth vehicle inertia
    this.speedKmh = +(this.speedKmh + (targetSpeed - this.speedKmh) * 0.24).toFixed(1);
    if (this.speedKmh < 0.8 && targetSpeed === 0) {
      this.speedKmh = 0;
    }

    this.coolantTempC = +(this.coolantTempC + (targetCoolant - this.coolantTempC) * 0.04).toFixed(1);

    // Volumetric airflow approximation
    const mapKpa = Math.round(28 + (engineLoadPct / 100) * 72);
    const intakeTempC = Math.round(24 + (engineLoadPct / 100) * 12);
    const mafGs = +(
      ((rpm / 60) / 2) *
      ((mapKpa * this.displacementL * 0.84) / ((8.314 / 28.97) * (intakeTempC + 273.15)))
    ).toFixed(2);

    const fuel = computeFuelMetrics({
      rpm,
      speedKmh: this.speedKmh,
      mafGs,
      mapKpa,
      intakeTempC,
      stftPct,
      ltftPct,
      displacementL: this.displacementL,
      fuelType: this.fuelType,
    });

    // Slowly deplete fuel tank proportionally (for realistic readout)
    this.fuelLevelPct = Math.max(5, +(this.fuelLevelPct - fuel.fuelFlowLh * 0.00025).toFixed(2));

    return {
      timestamp: Date.now(),
      rpm,
      speedKmh: Math.round(this.speedKmh),
      coolantTempC: Math.round(this.coolantTempC),
      intakeTempC,
      engineLoadPct: +engineLoadPct.toFixed(1),
      throttlePct: +throttlePct.toFixed(1),
      mafGs,
      mapKpa,
      stftPct,
      ltftPct,
      voltageV,
      fuelLevelPct: +this.fuelLevelPct.toFixed(1),
      gearEstimate,
      ...fuel,
    };
  }

  public getSimulatedDtcCodes(): { stored: string[]; pending: string[] } {
    if (this.scenario === DrivingScenario.FaultCondition) {
      return {
        stored: ['P0171', 'P0128'],
        pending: ['P0302'],
      };
    }
    return {
      stored: [],
      pending: ['P0442'],
    };
  }

  public getSimulatedMonitors(): ReadinessMonitor[] {
    const isFault = this.scenario === DrivingScenario.FaultCondition;
    return [
      { id: 'misfire', name: 'Misfire Monitor', supported: true, complete: !isFault },
      { id: 'fuel', name: 'Fuel System', supported: true, complete: !isFault },
      { id: 'components', name: 'Comprehensive Components', supported: true, complete: true },
      { id: 'catalyst', name: 'Catalyst', supported: true, complete: !isFault },
      { id: 'evap', name: 'EVAP System', supported: true, complete: false },
      { id: 'o2', name: 'O2 Sensor', supported: true, complete: true },
      { id: 'o2_heater', name: 'O2 Sensor Heater', supported: true, complete: true },
      { id: 'egr', name: 'EGR / VVT System', supported: true, complete: true },
    ];
  }
}
