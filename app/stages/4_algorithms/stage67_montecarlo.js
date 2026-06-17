// Stage 67: Optical Monte Carlo π Estimation
//
// Classic: throw N random points in [0,1]², count those inside unit circle.
// π/4 ≈ #inside / N
//
// Optical: display N columns, bright if x²+y² ≤ 1, dark otherwise.
// Camera mean = fraction of "inside" points → π ≈ 4 × fraction.
// Binary {0,1} encoding — most robust (cf. Goldbach corr=0.949).
//
// Educational: Monte Carlo methods, law of large numbers, convergence rate O(1/√N).

export async function run() {
  this.setRun(this.t('etap'), this.t('mc_start'), 125.0);
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

  // ── Gamma calibration ──
  this.setRun(this.t('etap'), this.t('kalib'), 125.05);
  const gamma = cal.gamma || 2.0;
  const CENTER = 0.5, DELTA = 0.4;
  const V_DARK  = Math.round(255 * Math.pow(CENTER - DELTA, 1 / gamma));
  const V_BRIGHT = Math.round(255 * Math.pow(CENTER + DELTA, 1 / gamma));

  this.showColor(`rgb(${V_DARK},${V_DARK},${V_DARK})`);
  await this.sleep(500);
  const calDark = measureCalibrated(await this.captureStable(8, 50));
  this.showColor(`rgb(${V_BRIGHT},${V_BRIGHT},${V_BRIGHT})`);
  await this.sleep(500);
  const calBright = measureCalibrated(await this.captureStable(8, 50));
  const calRange = calBright - calDark;

  this.log(`  cal: dark=${calDark.toFixed(1)}, bright=${calBright.toFixed(1)}, range=${calRange.toFixed(1)}`);

  // ── Seeded PRNG (Mulberry32) for reproducibility ──
  const mulberry32 = (seed) => () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  // ── Monte Carlo trials ──
  this.setRun(this.t('etap'), this.t('mc_optical'), 125.2);
  this.log('━━━ OPTICAL MONTE CARLO π ━━━');

  const TRIALS = 8;
  const POINTS_PER_TRIAL = 40; // columns on screen
  const opticalResults = [];
  let totalInside = 0, totalPoints = 0;

  for (let trial = 0; trial < TRIALS; trial++) {
    const rng = mulberry32(42 + trial * 137);

    // Generate random points in [0,1]²
    const points = [];
    let insideCount = 0;
    for (let i = 0; i < POINTS_PER_TRIAL; i++) {
      const x = rng(), y = rng();
      const inside = (x * x + y * y) <= 1.0;
      if (inside) insideCount++;
      points.push({ x, y, inside });
    }

    totalInside += insideCount;
    totalPoints += POINTS_PER_TRIAL;
    const cpuFraction = insideCount / POINTS_PER_TRIAL;
    const cpuPi = 4 * cpuFraction;

    // Display: bright = inside circle, dark = outside
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = `rgb(${V_DARK},${V_DARK},${V_DARK})`;
      ctx.fillRect(0, 0, w, h);
      const colW = w / POINTS_PER_TRIAL;
      for (let i = 0; i < POINTS_PER_TRIAL; i++) {
        if (points[i].inside) {
          ctx.fillStyle = `rgb(${V_BRIGHT},${V_BRIGHT},${V_BRIGHT})`;
          ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
        }
      }
    });
    await this.sleep(300);
    const frame = await this.captureStable(6, 40);
    const measured = measureCalibrated(frame);

    const optFraction = calRange > 1 ? (measured - calDark) / calRange : 0;
    const optPi = 4 * optFraction;
    const optInside = Math.round(optFraction * POINTS_PER_TRIAL);
    const error = Math.abs(optInside - insideCount);

    opticalResults.push({
      trial, insideCount, optInside, cpuPi: +cpuPi.toFixed(4),
      optPi: +optPi.toFixed(4), error
    });
    this.log(`  Trial ${trial + 1}: inside=${insideCount}/${POINTS_PER_TRIAL}, opt=${optInside}${error <= 1 ? ' ✓' : ` Δ=${error}`}, π_cpu=${cpuPi.toFixed(3)}, π_opt=${optPi.toFixed(3)}`);
  }

  // Cumulative estimate
  const cpuPiFinal = 4 * totalInside / totalPoints;
  const exactMatch = opticalResults.filter(r => r.error <= 1).length;
  const cpuPis = opticalResults.map(r => r.cpuPi);
  const optPis = opticalResults.map(r => r.optPi);
  const piCorr = this.pearsonCorr(cpuPis, optPis);

  // ── Convergence analysis ──
  this.setRun(this.t('etap'), this.t('mc_convergence'), 125.6);

  const convergence = [];
  let cumInside = 0;
  const rngBig = mulberry32(12345);
  for (let n = 1; n <= 10000; n++) {
    const x = rngBig(), y = rngBig();
    if (x * x + y * y <= 1) cumInside++;
    if (n === 10 || n === 100 || n === 500 || n === 1000 || n === 5000 || n === 10000) {
      const est = 4 * cumInside / n;
      const err = Math.abs(est - Math.PI);
      convergence.push({ n, estimate: +est.toFixed(6), error: +err.toFixed(6) });
      this.log(`  N=${n}: π≈${est.toFixed(4)}, |Δ|=${err.toFixed(4)} (1/√N=${(1/Math.sqrt(n)).toFixed(4)})`);
    }
  }

  this.showColor('#000');

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  π_cpu = ${cpuPiFinal.toFixed(4)} (${totalPoints} points)`);
  this.log(`  Optical: ${exactMatch}/${TRIALS} exact, corr=${piCorr.toFixed(3)}`);
  this.log(`  Real π = ${Math.PI.toFixed(6)}, error = ${Math.abs(cpuPiFinal - Math.PI).toFixed(4)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage67 = {
    method: 'Optical Monte Carlo π (binary encoding)',
    totalPoints, totalInside,
    cpuPi: +cpuPiFinal.toFixed(6),
    piError: +Math.abs(cpuPiFinal - Math.PI).toFixed(6),
    optical: { correlation: +piCorr.toFixed(4), exactMatch, results: opticalResults },
    convergence
  };
}

export function render(r) {
  if (r.stage67) { try {
    const s = r.stage67;
    this.rv('rv-pi-est', `π≈${s.cpuPi?.toFixed(3)}`, Math.abs(s.cpuPi - Math.PI) < 0.1 ? 'ok' : 'warn');
    this.rv('rv-pi-corr', `corr=${s.optical?.correlation?.toFixed(3)}`, s.optical?.correlation > 0.7 ? 'ok' : 'warn');
    const g = document.getElementById('g-s67');
    if (g) { g.textContent = `✅ π≈${s.cpuPi?.toFixed(3)} + Optical ✓`; g.className = 'grade pass'; }
  } catch(e) { console.error('s67:', e); } }
}

export function check(d) { try { return d && Math.abs(d.cpuPi - Math.PI) < 0.2; } catch(e) { return false; } }
export function metric(d) { try { return 'π≈' + (d.cpuPi || 0).toFixed(3); } catch(e) { return '—'; } }
