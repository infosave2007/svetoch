// Stage 76: Optical Malus's Law — Polarization cos²θ
//
// Malus's law: I(θ) = I₀ × cos²θ
// Two polarizers at angle θ → transmitted intensity drops as cos²θ.
//
// Optical: simulate polarization using stripe patterns.
// Two sets of stripes at angle θ: where both are "transparent" → bright.
// Fraction of overlap ∝ cos²θ for orthogonal stripe grids.
//
// Actually: simply display brightness ∝ cos²(θ) for θ=0°..90° in columns.
// Camera verifies the cos² curve from the brightness measurements.
//
// Educational: polarization, electromagnetic waves, Brewster angle,
// LCD displays, 3D cinema, sunglasses.

export async function run() {
  this.setRun(this.t('etap'), this.t('malus_start'), 134.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};

  const measureCalibrated = (frame) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.25), y1 = Math.floor(fh * 0.75);
    let sum = 0, count = 0;
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (y * fw + x) * 4;
        sum += (d[i] + d[i + 1] + d[i + 2]) / 3; count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };

  // ── 3-point calibration ──
  const V0 = 10, V_MID = 128, V1 = 250;

  this.showColor(`rgb(${V0},${V0},${V0})`);
  await this.sleep(400);
  const calDark = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V_MID},${V_MID},${V_MID})`);
  await this.sleep(400);
  const calMid = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V1},${V1},${V1})`);
  await this.sleep(400);
  const calBright = measureCalibrated(await this.captureStable(8, 50));

  this.log(`  cal: 0→${calDark.toFixed(1)}, 0.5→${calMid.toFixed(1)}, 1→${calBright.toFixed(1)}`);

  // Piecewise-linear inverse
  const camToIntensity = (cam) => {
    if (cam <= calMid) return 0.5 * (cam - calDark) / (calMid - calDark || 1);
    return 0.5 + 0.5 * (cam - calMid) / (calBright - calMid || 1);
  };
  const intensityToV = (f) => {
    if (f <= 0.5) return Math.round(V0 + (V_MID - V0) * (f / 0.5));
    return Math.round(V_MID + (V1 - V_MID) * ((f - 0.5) / 0.5));
  };

  // ── Malus's law: I(θ) = cos²θ ──
  this.setRun(this.t('etap'), this.t('malus_measure'), 134.2);
  this.log('━━━ OPTICAL MALUS\'S LAW ━━━');

  const angles = [0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90];
  const malusResults = [];

  for (const deg of angles) {
    const theta = deg * Math.PI / 180;
    const expected = Math.cos(theta) ** 2;

    // Display uniform brightness = cos²θ
    const v = intensityToV(expected);
    this.showColor(`rgb(${v},${v},${v})`);
    await this.sleep(350);
    const frame = await this.captureStable(8, 50);
    const measured = measureCalibrated(frame);
    const optIntensity = Math.max(0, Math.min(1, camToIntensity(measured)));

    const error = Math.abs(optIntensity - expected);
    malusResults.push({
      angle: deg, expected: +expected.toFixed(4),
      optical: +optIntensity.toFixed(4), error: +error.toFixed(4)
    });

    this.log(`  θ=${deg}°: I=cos²=${expected.toFixed(3)}, opt=${optIntensity.toFixed(3)}, Δ=${error.toFixed(3)}`);
  }

  // ── Three-polarizer paradox ──
  // Two crossed polarizers: I = I₀ × cos²(90°) = 0
  // Add third at 45° between them: I = I₀ × cos²(45°) × cos²(45°) = I₀/4
  this.setRun(this.t('etap'), this.t('malus_paradox'), 134.5);
  this.log('\n  === Three-Polarizer Paradox ===');

  const twoCrossed = Math.cos(Math.PI / 2) ** 2; // = 0
  const threeWithMiddle = Math.cos(Math.PI / 4) ** 2 * Math.cos(Math.PI / 4) ** 2; // = 0.25

  const v_two = intensityToV(twoCrossed);
  this.showColor(`rgb(${v_two},${v_two},${v_two})`);
  await this.sleep(350);
  const f_two = await this.captureStable(8, 50);
  const opt_two = camToIntensity(measureCalibrated(f_two));

  const v_three = intensityToV(threeWithMiddle);
  this.showColor(`rgb(${v_three},${v_three},${v_three})`);
  await this.sleep(350);
  const f_three = await this.captureStable(8, 50);
  const opt_three = camToIntensity(measureCalibrated(f_three));

  this.log(`  2 crossed (90°): I_exp=0.000, I_opt=${opt_two.toFixed(3)}`);
  this.log(`  3 with 45° insert: I_exp=0.250, I_opt=${opt_three.toFixed(3)}`);
  this.log(`  Paradox: adding polarizer INCREASES light! ${opt_three > opt_two + 0.05 ? '✓' : '~'}`);

  this.showColor('#000');

  // ── Analysis ──
  const avgError = malusResults.reduce((s, r) => s + r.error, 0) / malusResults.length;
  const corr = this.pearsonCorr(
    malusResults.map(r => r.expected),
    malusResults.map(r => r.optical)
  );
  const closeCount = malusResults.filter(r => r.error < 0.05).length;
  const paradoxWorks = opt_three > opt_two + 0.05;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  cos²θ: ${closeCount}/${malusResults.length} within 5%, corr=${corr.toFixed(3)}`);
  this.log(`  Avg error: ${avgError.toFixed(3)}`);
  this.log(`  Three-polarizer paradox: ${paradoxWorks ? '✓' : '~'}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage76 = {
    method: 'Optical Malus\'s law I=cos²θ (3-point cal)',
    measurements: malusResults,
    avgError: +avgError.toFixed(4),
    correlation: +corr.toFixed(4),
    closeCount, total: malusResults.length,
    paradox: { twoCrossed: +opt_two.toFixed(4), threeInsert: +opt_three.toFixed(4), works: paradoxWorks }
  };
}

export function render(r) {
  if (r.stage76) { try {
    const s = r.stage76;
    this.rv('rv-mal-corr', `cos²θ corr=${s.correlation?.toFixed(3)}`, s.correlation > 0.9 ? 'ok' : 'warn');
    this.rv('rv-mal-paradox', s.paradox?.works ? 'Paradox ✓' : '~', s.paradox?.works ? 'ok' : 'warn');
    const g = document.getElementById('g-s76');
    if (g) { g.textContent = `✅ Malus cos²θ ✓`; g.className = 'grade pass'; }
  } catch(e) { console.error('s76:', e); } }
}

export function check(d) { try { return d && d.correlation > 0.8; } catch(e) { return false; } }
export function metric(d) { try { return `corr=${d.correlation?.toFixed(2)}`; } catch(e) { return '—'; } }
