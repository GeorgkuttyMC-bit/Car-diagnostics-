import { CoachingDirective, EfficiencyBreakdown, TelemetryFrame, TelemetrySample } from '../types/obd';

export function evaluateFuelEfficiency(
  frame: TelemetryFrame,
  history: TelemetrySample[],
  idleRatio: number
): EfficiencyBreakdown {
  // 1. Throttle smoothness: penalize steep throttle deltas across recent samples
  let throttleDeltaSum = 0;
  const recent = history.slice(-12);
  for (let i = 1; i < recent.length; i++) {
    throttleDeltaSum += Math.abs(recent[i].throttlePct - recent[i - 1].throttlePct);
  }
  const avgThrottleDelta = recent.length > 1 ? throttleDeltaSum / (recent.length - 1) : 0;
  const throttleSmoothness = Math.max(15, Math.min(100, Math.round(100 - avgThrottleDelta * 4.5 - Math.max(0, frame.throttlePct - 45) * 0.8)));

  // 2. RPM Band Discipline: optimal BSFC band ~1400–2400 RPM while moving
  let rpmDiscipline = 94;
  if (frame.speedKmh > 5) {
    if (frame.rpm > 3200) {
      rpmDiscipline = Math.max(20, Math.round(92 - (frame.rpm - 2600) * 0.04));
    } else if (frame.rpm > 2450) {
      rpmDiscipline = Math.round(94 - (frame.rpm - 2450) * 0.025);
    } else if (frame.rpm < 1150) {
      rpmDiscipline = 74;
    }
  } else {
    rpmDiscipline = frame.rpm > 1000 ? 60 : 84;
  }

  // 3. Cruise Speed Economy: aerodynamic drag rises quadratically above ~95 km/h
  let cruiseEconomy = 92;
  if (frame.speedKmh === 0) {
    cruiseEconomy = 48;
  } else if (frame.speedKmh > 105) {
    cruiseEconomy = Math.max(25, Math.round(95 - (frame.speedKmh - 100) * 1.7));
  } else if (frame.speedKmh >= 60 && frame.speedKmh <= 95) {
    cruiseEconomy = 96;
  } else {
    cruiseEconomy = 72;
  }

  // 4. Idle Discipline: penalize high cumulative idle time
  const idleDiscipline = Math.max(20, Math.min(100, Math.round(100 - idleRatio * 120)));

  // 5. Thermal Readiness: cold coolant (<78C) keeps open-loop fuel enrichment active
  let thermalReadiness = 98;
  if (frame.coolantTempC < 78) {
    thermalReadiness = Math.max(35, Math.round(40 + ((frame.coolantTempC - 20) / 58) * 55));
  } else if (frame.coolantTempC > 106) {
    thermalReadiness = 55;
  }

  const overallScore = Math.round(
    throttleSmoothness * 0.25 +
      rpmDiscipline * 0.25 +
      cruiseEconomy * 0.22 +
      idleDiscipline * 0.16 +
      thermalReadiness * 0.12
  );

  // Attribute instantaneous fuel flow into 4 physical buckets (L/h normalized share)
  const flow = frame.fuelFlowLh;
  let idleWaste = 0;
  let aeroDrag = 0;
  let accelerationSurge = 0;
  let cruiseOptimal = 0;

  if (frame.speedKmh < 3) {
    idleWaste = flow;
  } else {
    const aeroShare = frame.speedKmh > 95 ? Math.min(0.45, ((frame.speedKmh - 90) / 80) * 0.5) : 0.08;
    const surgeShare = frame.throttlePct > 38 ? Math.min(0.48, (frame.throttlePct - 35) * 0.011) : 0.04;
    aeroDrag = +(flow * aeroShare).toFixed(2);
    accelerationSurge = +(flow * surgeShare).toFixed(2);
    cruiseOptimal = +Math.max(0, flow - aeroDrag - accelerationSurge).toFixed(2);
  }

  const directives: CoachingDirective[] = [];

  if (frame.speedKmh === 0 && frame.rpm > 400) {
    directives.push({
      id: 'idle_waste',
      severity: 'caution',
      title: 'Stationary idle fuel burn detected',
      detail: `Idling consumes ${frame.fuelFlowLh.toFixed(2)} L/h with zero distance gain. Shutting down during stops >30s saves urban fuel.`,
      estimatedSavingsPct: 11,
    });
  }

  if (frame.rpm > 2750 && frame.speedKmh > 15 && frame.engineLoadPct < 70) {
    directives.push({
      id: 'shift_up',
      severity: 'alert',
      title: 'Elevated engine speed — shift to higher gear',
      detail: `Running at ${frame.rpm.toLocaleString()} RPM increases internal friction and pumping loss. Target 1,600–2,300 RPM.`,
      estimatedSavingsPct: 14,
    });
  }

  if (frame.speedKmh > 108) {
    directives.push({
      id: 'aero_drag',
      severity: 'caution',
      title: 'Aerodynamic drag penalty above 105 km/h',
      detail: `Reducing cruise speed by 15 km/h cuts wind resistance roughly 24% and lowers fuel flow significantly.`,
      estimatedSavingsPct: 16,
    });
  }

  if (frame.throttlePct > 48 || avgThrottleDelta > 6) {
    directives.push({
      id: 'throttle_surge',
      severity: 'alert',
      title: 'Aggressive throttle demand spike',
      detail: `Throttle at ${frame.throttlePct.toFixed(0)}% triggers fuel enrichment. Progressive pedal modulation prevents waste.`,
      estimatedSavingsPct: 13,
    });
  }

  if (Math.abs(frame.ltftPct + frame.stftPct) > 12) {
    directives.push({
      id: 'fuel_trim_drift',
      severity: 'alert',
      title: 'Abnormal ECU fuel trim compensation',
      detail: `Combined STFT+LTFT is ${(frame.stftPct + frame.ltftPct).toFixed(1)}%. Inspect MAF sensor, vacuum lines, and scan DTCs.`,
      estimatedSavingsPct: 12,
    });
  }

  if (frame.coolantTempC < 76) {
    directives.push({
      id: 'cold_enrichment',
      severity: 'caution',
      title: 'Engine below closed-loop thermal window',
      detail: `Coolant at ${frame.coolantTempC} °C keeps cold-start enrichment active. Avoid heavy load until >82 °C.`,
      estimatedSavingsPct: 8,
    });
  }

  if (directives.length === 0) {
    directives.push({
      id: 'optimal_band',
      severity: 'optimal',
      title: 'Operating inside peak BSFC efficiency band',
      detail: `Steady ${frame.rpm.toLocaleString()} RPM at ${frame.speedKmh} km/h with smooth throttle keeps fuel burn optimal (${frame.instantL100km.toFixed(1)} L/100km).`,
      estimatedSavingsPct: 0,
    });
  }

  return {
    overallScore,
    throttleSmoothness,
    rpmDiscipline,
    cruiseEconomy,
    idleDiscipline,
    thermalReadiness,
    fuelShareLiters: {
      cruiseOptimal,
      idleWaste,
      accelerationSurge,
      aeroDrag,
    },
    directives,
  };
}
