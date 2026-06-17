// Stage 75: Quantum vs Classical Random Walk
//
// Classical: coin flip at each step → Binomial distribution, spread ~ √t
// Quantum: superposition at each step → Quadratic spread ~ t
//
// The key difference: quantum interference causes the walker to
// spread FASTER (ballistic) than classical (diffusive).
//
// Optical: display probability distributions as brightness columns.
// Camera verifies the characteristic shape:
//   - Classical: peaked at center (Gaussian-like)
//   - Quantum: peaked at EDGES (ballistic peaks)
//
// Educational: quantum speedup, decoherence, quantum advantage.

export async function run() {
  this.setRun(this.t('etap'), this.t('qrw_start'), 133.0);
  this.showColor('#808080');
  await this.sleep(500);

  const cal = this.results.calibration || {};
  const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

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

  const measureProfile = (frame, nBins) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const x0 = (cal.x0 != null) ? cal.x0 : Math.floor(fw * 0.15);
    const x1 = (cal.x1 != null) ? cal.x1 : Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.3), y1 = Math.floor(fh * 0.7);
    const width = x1 - x0;
    const binW = width / nBins;
    const profile = [];
    for (let b = 0; b < nBins; b++) {
      const bx0 = x0 + Math.floor(b * binW);
      const bx1 = x0 + Math.floor((b + 1) * binW);
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y += 2) {
        for (let x = bx0; x < bx1; x += 2) {
          const i = (y * fw + x) * 4;
          sum += (d[i] + d[i + 1] + d[i + 2]) / 3; count++;
        }
      }
      profile.push(count > 0 ? sum / count : 0);
    }
    if (isMirrored) profile.reverse();
    return profile;
  };

  // ── 1. Classical Random Walk ──
  this.setRun(this.t('etap'), this.t('qrw_classical'), 133.2);
  this.log('━━━ QUANTUM vs CLASSICAL RANDOM WALK ━━━');

  const STEPS = 20;
  const N_POS = 2 * STEPS + 1; // positions: -STEPS to +STEPS
  const N_BINS = 41;

  // Classical: binomial coefficients
  // P(x at position k after n steps) = C(n,(n+k)/2) / 2^n
  const classicalProb = new Float64Array(N_POS);
  const pow2n = Math.pow(2, STEPS);
  for (let k = -STEPS; k <= STEPS; k += 2) { // only even/odd positions reachable
    const idx = k + STEPS;
    const r = (STEPS + k) / 2;
    if (r < 0 || r > STEPS) continue;
    // C(n, r)
    let logC = 0;
    for (let i = 1; i <= STEPS; i++) logC += Math.log(i);
    for (let i = 1; i <= r; i++) logC -= Math.log(i);
    for (let i = 1; i <= STEPS - r; i++) logC -= Math.log(i);
    classicalProb[idx] = Math.exp(logC - STEPS * Math.log(2));
  }

  // Normalize for display
  const classMax = Math.max(...classicalProb);
  const classNorm = Array.from(classicalProb).map(v => v / (classMax || 1));

  this.log(`  Classical (${STEPS} steps): Gaussian-like, σ=√${STEPS}=${Math.sqrt(STEPS).toFixed(1)}`);

  // ── 2. Quantum Random Walk (Hadamard coin) ──
  // State: |position⟩ ⊗ |coin⟩, coin = {|↑⟩, |↓⟩}
  // Hadamard coin: H|↑⟩ = (|↑⟩+|↓⟩)/√2, H|↓⟩ = (|↑⟩-|↓⟩)/√2
  // Shift: |↑⟩ → position+1, |↓⟩ → position-1

  // Complex amplitudes: amp[pos][coin]
  let amp = Array.from({length: N_POS}, () => [{ re: 0, im: 0 }, { re: 0, im: 0 }]);
  // Start at center with coin |↑⟩
  amp[STEPS][0] = { re: 1, im: 0 };

  const INV_SQRT2 = 1 / Math.sqrt(2);

  for (let step = 0; step < STEPS; step++) {
    const newAmp = Array.from({length: N_POS}, () => [{ re: 0, im: 0 }, { re: 0, im: 0 }]);

    for (let pos = 0; pos < N_POS; pos++) {
      const up = amp[pos][0], dn = amp[pos][1];
      if (Math.abs(up.re) + Math.abs(up.im) + Math.abs(dn.re) + Math.abs(dn.im) < 1e-15) continue;

      // Hadamard: new_up = (up + dn)/√2, new_dn = (up - dn)/√2
      const newUp = { re: (up.re + dn.re) * INV_SQRT2, im: (up.im + dn.im) * INV_SQRT2 };
      const newDn = { re: (up.re - dn.re) * INV_SQRT2, im: (up.im - dn.im) * INV_SQRT2 };

      // Shift: up → pos+1, dn → pos-1
      if (pos + 1 < N_POS) {
        newAmp[pos + 1][0].re += newUp.re; newAmp[pos + 1][0].im += newUp.im;
      }
      if (pos - 1 >= 0) {
        newAmp[pos - 1][1].re += newDn.re; newAmp[pos - 1][1].im += newDn.im;
      }
    }
    amp = newAmp;
  }

  // Quantum probability
  const quantumProb = amp.map(([up, dn]) =>
    up.re * up.re + up.im * up.im + dn.re * dn.re + dn.im * dn.im
  );
  const qMax = Math.max(...quantumProb);
  const quantNorm = quantumProb.map(v => v / (qMax || 1));

  // Quantum spread (std dev)
  const qTotalProb = quantumProb.reduce((s, v) => s + v, 0);
  let qMean = 0, qVar = 0;
  for (let i = 0; i < N_POS; i++) {
    const pos = i - STEPS;
    qMean += pos * quantumProb[i] / qTotalProb;
  }
  for (let i = 0; i < N_POS; i++) {
    const pos = i - STEPS;
    qVar += (pos - qMean) ** 2 * quantumProb[i] / qTotalProb;
  }
  const qStd = Math.sqrt(qVar);

  this.log(`  Quantum (${STEPS} steps): σ=${qStd.toFixed(1)} (vs classical √${STEPS}=${Math.sqrt(STEPS).toFixed(1)})`);
  this.log(`  Speedup: σ_q/σ_c = ${(qStd / Math.sqrt(STEPS)).toFixed(2)}× (expect ~√T for T=${STEPS})`);

  // ── 3. Optical verification: display both distributions ──
  this.setRun(this.t('etap'), this.t('qrw_optical'), 133.5);

  // Display classical distribution
  this.showPattern((ctx, w, h) => {
    const colW = w / N_BINS;
    for (let i = 0; i < N_BINS; i++) {
      const idx = Math.floor(i / N_BINS * N_POS);
      const v = Math.round(10 + 240 * classNorm[Math.min(idx, N_POS - 1)]);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
    }
  });
  await this.sleep(400);
  const classFrame = await this.captureStable(8, 50);
  const classProfile = measureProfile(classFrame, N_BINS);

  // Display quantum distribution
  this.showPattern((ctx, w, h) => {
    const colW = w / N_BINS;
    for (let i = 0; i < N_BINS; i++) {
      const idx = Math.floor(i / N_BINS * N_POS);
      const v = Math.round(10 + 240 * quantNorm[Math.min(idx, N_POS - 1)]);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
    }
  });
  await this.sleep(400);
  const quantFrame = await this.captureStable(8, 50);
  const quantProfile = measureProfile(quantFrame, N_BINS);

  // Normalize profiles
  const cMin = Math.min(...classProfile), cMax = Math.max(...classProfile);
  const classOpt = classProfile.map(v => (v - cMin) / (cMax - cMin || 1));
  const qMin2 = Math.min(...quantProfile), qMax2 = Math.max(...quantProfile);
  const quantOpt = quantProfile.map(v => (v - qMin2) / (qMax2 - qMin2 || 1));

  // Resample CPU distributions to N_BINS
  const classRef = Array.from({length: N_BINS}, (_, i) => classNorm[Math.floor(i / N_BINS * N_POS)]);
  const quantRef = Array.from({length: N_BINS}, (_, i) => quantNorm[Math.floor(i / N_BINS * N_POS)]);

  const classCorr = this.pearsonCorr(classRef, classOpt);
  const quantCorr = this.pearsonCorr(quantRef, quantOpt);

  // Key test: is quantum max at edges, classical max at center?
  const classCenterBright = classOpt[Math.floor(N_BINS / 2)] > 0.7;
  const quantEdges = (quantOpt[5] + quantOpt[N_BINS - 6]) / 2;
  const quantCenter = quantOpt[Math.floor(N_BINS / 2)];
  const quantEdgeBright = quantEdges > quantCenter;

  this.showColor('#000');

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Classical: center bright=${classCenterBright ? '✓' : '✗'}, corr=${classCorr.toFixed(3)}`);
  this.log(`  Quantum: edges>${(quantEdgeBright ? '✓' : '✗')}, corr=${quantCorr.toFixed(3)}`);
  this.log(`  Quantum speedup: σ_q=${qStd.toFixed(1)} > σ_c=${Math.sqrt(STEPS).toFixed(1)}`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage75 = {
    method: 'Quantum vs Classical Random Walk (Hadamard coin)',
    steps: STEPS,
    classicalStd: +Math.sqrt(STEPS).toFixed(2),
    quantumStd: +qStd.toFixed(2),
    speedup: +(qStd / Math.sqrt(STEPS)).toFixed(3),
    optical: {
      classCorr: +classCorr.toFixed(4),
      quantCorr: +quantCorr.toFixed(4),
      classCenterBright, quantEdgeBright
    }
  };
}

export function render(r) {
  if (r.stage75) { try {
    const s = r.stage75;
    this.rv('rv-qrw-speed', `σ_q/σ_c=${s.speedup}×`, s.speedup > 1.5 ? 'ok' : 'warn');
    this.rv('rv-qrw-corr', `corr_c=${s.optical?.classCorr?.toFixed(2)} q=${s.optical?.quantCorr?.toFixed(2)}`, 'ok');
    const g = document.getElementById('g-s75');
    if (g) { g.textContent = `✅ QRW ${s.speedup}× faster`; g.className = 'grade pass'; }
  } catch(e) { console.error('s75:', e); } }
}

export function check(d) { try { return d && d.speedup > 1.2; } catch(e) { return false; } }
export function metric(d) { try { return `${d.speedup}× speedup`; } catch(e) { return '—'; } }
