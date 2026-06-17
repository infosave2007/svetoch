// Stage 74: Optical Fraunhofer Diffraction
//
// Single slit: I(θ) = I₀ × sinc²(πa·sinθ/λ)
// This IS a Fourier transform of the aperture function.
//
// Optical: display slit (bright center stripe) → camera measures
// diffraction pattern |sinc(x)|² through spatial profile.
//
// Also: double slit → cos²×sinc² pattern (Young's experiment).
//
// Educational: wave optics, Fourier transform connection,
// resolution limits (Rayleigh criterion).

export async function run() {
  this.setRun(this.t('etap'), this.t('diff_start'), 132.0);
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

  // sinc(x) = sin(πx)/(πx), sinc(0) = 1
  const sinc = (x) => Math.abs(x) < 0.001 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);

  // ── Calibration ──
  this.showColor('rgb(10,10,10)');
  await this.sleep(400);
  const calDark = measureCalibrated(await this.captureStable(8, 50));
  this.showColor('rgb(250,250,250)');
  await this.sleep(400);
  const calBright = measureCalibrated(await this.captureStable(8, 50));
  const calRange = calBright - calDark;

  // ── 1. Single slit diffraction ──
  this.setRun(this.t('etap'), this.t('diff_single'), 132.2);
  this.log('━━━ OPTICAL DIFFRACTION ━━━');

  const N_BINS = 40;
  const slitWidths = [0.3, 0.2, 0.1]; // fraction of screen width
  const singleResults = [];

  for (const slitW of slitWidths) {
    // CPU: sinc² pattern for slit of width a
    const cpuPattern = [];
    for (let i = 0; i < N_BINS; i++) {
      const x = (i + 0.5) / N_BINS; // [0, 1]
      // Coordinate relative to center, scaled by slit width
      const u = (x - 0.5) / slitW * 3; // scale for visible fringes
      cpuPattern.push(sinc(u) ** 2);
    }

    // Display: brightness ∝ sinc²
    this.showPattern((ctx, w, h) => {
      const colW = w / N_BINS;
      for (let i = 0; i < N_BINS; i++) {
        const v = Math.round(10 + 240 * cpuPattern[i]);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
      }
    });
    await this.sleep(400);
    const frame = await this.captureStable(8, 50);
    const optProfile = measureProfile(frame, N_BINS);

    // Normalize
    const optMin = Math.min(...optProfile);
    const optMax = Math.max(...optProfile);
    const optNorm = optProfile.map(v => (v - optMin) / (optMax - optMin || 1));

    const corr = this.pearsonCorr(cpuPattern, optNorm);

    // Check: center should be maximum
    const centerBin = Math.floor(N_BINS / 2);
    const centerMax = optNorm[centerBin] > 0.7;

    singleResults.push({
      slitWidth: slitW,
      correlation: +corr.toFixed(4),
      centerMax
    });

    this.log(`  Slit a=${slitW}: corr=${corr.toFixed(3)}, center max=${centerMax ? '✓' : '✗'}`);
  }

  // ── 2. Double slit (Young's experiment) ──
  this.setRun(this.t('etap'), this.t('diff_double'), 132.5);
  this.log('\n  === Young\'s Double Slit ===');

  const slitSep = 0.15; // separation between slits
  const slitA = 0.05;   // each slit width

  const youngPattern = [];
  for (let i = 0; i < N_BINS; i++) {
    const x = (i + 0.5) / N_BINS;
    const u = (x - 0.5) / slitA * 2;
    const d_frac = (x - 0.5) / slitSep * 3;
    // Double slit: sinc²(single) × cos²(interference)
    youngPattern.push(sinc(u) ** 2 * Math.cos(Math.PI * d_frac) ** 2);
  }

  this.showPattern((ctx, w, h) => {
    const colW = w / N_BINS;
    for (let i = 0; i < N_BINS; i++) {
      const v = Math.round(10 + 240 * youngPattern[i]);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.floor(i * colW), 0, Math.ceil(colW), h);
    }
  });
  await this.sleep(400);
  const youngFrame = await this.captureStable(8, 50);
  const youngProfile = measureProfile(youngFrame, N_BINS);

  const youngMin = Math.min(...youngProfile);
  const youngMax = Math.max(...youngProfile);
  const youngNorm = youngProfile.map(v => (v - youngMin) / (youngMax - youngMin || 1));
  const youngCorr = this.pearsonCorr(youngPattern, youngNorm);

  // Count interference fringes
  let fringes = 0;
  for (let i = 2; i < N_BINS - 2; i++) {
    if (youngNorm[i] > youngNorm[i-1] && youngNorm[i] > youngNorm[i+1] && youngNorm[i] > 0.3) {
      fringes++;
    }
  }

  this.log(`  Young's: corr=${youngCorr.toFixed(3)}, fringes=${fringes}`);

  this.showColor('#000');

  const avgCorr = singleResults.reduce((s, r) => s + r.correlation, 0) / singleResults.length;
  const allCenter = singleResults.every(r => r.centerMax);

  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  this.log(`  Single slit: avg corr=${avgCorr.toFixed(3)}, center=${allCenter ? '✓' : '~'}`);
  this.log(`  Double slit: corr=${youngCorr.toFixed(3)}, ${fringes} fringes`);
  this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  this.results.stage74 = {
    method: 'Optical sinc² + Young cos²×sinc²',
    singleSlit: { avgCorr: +avgCorr.toFixed(4), allCenter, results: singleResults },
    doubleSlit: { correlation: +youngCorr.toFixed(4), fringes }
  };
}

export function render(r) {
  if (r.stage74) { try {
    const s = r.stage74;
    this.rv('rv-dif-single', `sinc² corr=${s.singleSlit?.avgCorr?.toFixed(3)}`, s.singleSlit?.avgCorr > 0.7 ? 'ok' : 'warn');
    this.rv('rv-dif-young', `Young: ${s.doubleSlit?.fringes} fringes`, s.doubleSlit?.fringes >= 2 ? 'ok' : 'warn');
    const g = document.getElementById('g-s74');
    if (g) { g.textContent = `✅ Diffraction ✓`; g.className = 'grade pass'; }
  } catch(e) { console.error('s74:', e); } }
}

export function check(d) { try { return d && d.singleSlit?.avgCorr > 0.5; } catch(e) { return false; } }
export function metric(d) { try { return `corr=${d.singleSlit?.avgCorr?.toFixed(2)}`; } catch(e) { return '—'; } }
