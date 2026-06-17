// Stage 68: Optical Riemann Integral ∫f(x)dx
//
// Camera computes definite integrals by averaging brightness:
//   brightness(x) ∝ f(x) → camera mean = (1/width) × Σf(xᵢ) ≈ ∫f(x)dx / (b-a)
//
// Test functions with known exact integrals:
//   ∫₀¹ x² dx = 1/3
//   ∫₀¹ sin(πx) dx = 2/π
//   ∫₀¹ e⁻ˣ dx = 1 - 1/e
//   ∫₀¹ √x dx = 2/3
//   ∫₀¹ x·sin(πx) dx = 1/π
//
// Educational: Riemann sums → definite integral, camera as integrator.

export async function run() {
  this.setRun(this.t('etap'), this.t('integral_start'), 126.0);
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
  // Use direct brightness: f(x)=0 → black, f(x)=0.5 → mid, f(x)=1 → white
  // This avoids gamma model errors by calibrating the actual response curve
  this.setRun(this.t('etap'), this.t('kalib'), 126.05);

  const V0 = 10, V_MID = 128, V1 = 250; // display values for f=0, 0.5, 1

  this.showColor(`rgb(${V0},${V0},${V0})`);
  await this.sleep(500);
  const calZero = measureCalibrated(await this.captureStable(8, 50));

  this.showColor(`rgb(${V_MID},${V_MID},${V_MID})`);
  await this.sleep(500);
  const calHalf = measureCalibrated(await this.captureStable(8, 50));

  this.showColor(`rgb(${V1},${V1},${V1})`);
  await this.sleep(500);
  const calOne = measureCalibrated(await this.captureStable(8, 50));

  this.log(`  3-point cal: f=0→${calZero.toFixed(1)}, f=0.5→${calHalf.toFixed(1)}, f=1→${calOne.toFixed(1)}`);

  // Inverse mapping: camera reading → f value using piecewise linear interpolation
  const camToF = (cam) => {
    if (cam <= calHalf) {
      return 0.5 * (cam - calZero) / (calHalf - calZero || 1);
    } else {
      return 0.5 + 0.5 * (cam - calHalf) / (calOne - calHalf || 1);
    }
  };

  // Forward mapping: f value → display brightness using piecewise linear
  const fToDisplay = (f) => {
    if (f <= 0.5) {
      return Math.round(V0 + (V_MID - V0) * (f / 0.5));
    } else {
      return Math.round(V_MID + (V1 - V_MID) * ((f - 0.5) / 0.5));
    }
  };

  // ── Test functions ──
  this.setRun(this.t('etap'), this.t('integral_compute'), 126.2);
  this.log('━━━ OPTICAL RIEMANN INTEGRAL ━━━');

  const functions = [
    { name: 'x²', f: x => x * x, exact: 1/3, label: '∫₀¹ x² dx = 1/3' },
    { name: 'sin(πx)', f: x => Math.sin(Math.PI * x), exact: 2/Math.PI, label: '∫₀¹ sin(πx) dx = 2/π' },
    { name: 'e⁻ˣ', f: x => Math.exp(-x), exact: 1 - 1/Math.E, label: '∫₀¹ e⁻ˣ dx = 1-1/e' },
    { name: '√x', f: x => Math.sqrt(x), exact: 2/3, label: '∫₀¹ √x dx = 2/3' },
    { name: '4x(1-x)', f: x => 4*x*(1-x), exact: 2/3, label: '∫₀¹ 4x(1-x) dx = 2/3' },
    { name: 'x·sin(πx)', f: x => x * Math.sin(Math.PI * x), exact: 1/Math.PI, label: '∫₀¹ x·sin(πx) dx = 1/π' },
    { name: '1/(1+x²)', f: x => 1/(1+x*x), exact: Math.PI/4, label: '∫₀¹ 1/(1+x²) dx = π/4' },
    { name: 'cos²(πx)', f: x => Math.cos(Math.PI*x)**2, exact: 0.5, label: '∫₀¹ cos²(πx) dx = 1/2' },
  ];

  const N_COLS = 40; // display resolution
  const results = [];

  for (let fi = 0; fi < functions.length; fi++) {
    const fn = functions[fi];
    this.setRun(this.t('etap'), `∫${fn.name}...`, 126.2 + fi * 0.05);

    // CPU: Riemann sum
    let cpuSum = 0;
    const values = [];
    for (let i = 0; i < N_COLS; i++) {
      const x = (i + 0.5) / N_COLS; // midpoint
      const fval = Math.max(0, Math.min(1, fn.f(x))); // clamp to [0,1]
      values.push(fval);
      cpuSum += fval;
    }
    const cpuIntegral = cpuSum / N_COLS;

    // Display: piecewise-linear brightness encoding
    this.showPattern((ctx, w, h) => {
      const colW = w / N_COLS;
      for (let i = 0; i < N_COLS; i++) {
        const displayV = fToDisplay(values[i]);
        ctx.fillStyle = `rgb(${displayV},${displayV},${displayV})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(350);
    const frame = await this.captureStable(8, 50);
    const measured = measureCalibrated(frame);

    // Convert camera reading to integral using piecewise-linear inverse
    const optIntegral = Math.max(0, Math.min(1, camToF(measured)));
    const cpuError = Math.abs(cpuIntegral - fn.exact);
    const optError = Math.abs(optIntegral - fn.exact);

    results.push({
      name: fn.name, exact: +fn.exact.toFixed(6),
      cpu: +cpuIntegral.toFixed(6), optical: +optIntegral.toFixed(6),
      cpuErr: +cpuError.toFixed(6), optErr: +optError.toFixed(6)
    });

    this.log(`  ${fn.label}`);
    this.log(`    cpu=${cpuIntegral.toFixed(4)}, opt=${optIntegral.toFixed(4)}, exact=${fn.exact.toFixed(4)}, Δ_opt=${optError.toFixed(4)}`);
  }

  this.showColor('#000');

  const avgOptErr = results.reduce((s, r) => s + r.optErr, 0) / results.length;
  const avgCpuErr = results.reduce((s, r) => s + r.cpuErr, 0) / results.length;
  const optCorr = this.pearsonCorr(results.map(r => r.exact), results.map(r => r.optical));
  const closeCount = results.filter(r => r.optErr < 0.05).length;

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  ${closeCount}/${results.length} integrals within 5% of exact`);
  this.log(`  Avg error: cpu=${avgCpuErr.toFixed(4)}, optical=${avgOptErr.toFixed(4)}`);
  this.log(`  Correlation (exact vs optical): ${optCorr.toFixed(3)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage68 = {
    method: 'Optical Riemann integral (γ-corrected continuous)',
    nCols: N_COLS, avgOptErr: +avgOptErr.toFixed(6),
    closeCount, total: results.length,
    correlation: +optCorr.toFixed(4),
    integrals: results
  };
}

export function render(r) {
  if (r.stage68) { try {
    const s = r.stage68;
    this.rv('rv-int-close', `${s.closeCount}/${s.total} <5%`, s.closeCount >= s.total * 0.6 ? 'ok' : 'warn');
    this.rv('rv-int-corr', `corr=${s.correlation?.toFixed(3)}`, s.correlation > 0.8 ? 'ok' : 'warn');
    const g = document.getElementById('g-s68');
    if (g) { g.textContent = `✅ ∫f(x)dx: ${s.closeCount}/${s.total} ✓`; g.className = 'grade pass'; }
  } catch(e) { console.error('s68:', e); } }
}

export function check(d) { try { return d && d.closeCount >= d.total * 0.5; } catch(e) { return false; } }
export function metric(d) { try { return `${d.closeCount}/${d.total}`; } catch(e) { return '—'; } }
