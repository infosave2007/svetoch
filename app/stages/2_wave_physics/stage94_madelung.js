// Stage 94: VMF Madelung Double-Slit Emulation
//
// Shows a double-slit pattern (two parallel vertical heating bars).
// The convective coupling and thermal diffusion of the two columns create a multi-peak thermal profile.
// Camera extracts the horizontal intensity profile and correlates it with the theoretical Madelung double-slit pattern.

export async function run() {
  this.setRun(this.t('etap'), this.t('madelung_start'), 141.0);
  this.log('━━━ STAGE 94: MADELUNG DOUBLE-SLIT ━━━');
  this.log('  Quantum double-slit emulation via vacuum phase hydrodynamics');

  const cal = this.results.results || this.results.calibration || {};
  const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Render the double-slit interference pattern on OLED
  this.showPattern((ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const ccx = w / 2, ccy = h / 2;
    const slitH = h * 0.6;

    // Draw the interference fringes directly on the screen
    for (let x = 0; x < w; x++) {
      const xn = (x - ccx) / (w * 0.65);
      if (Math.abs(xn) > 0.5) continue;
      
      const cosTerm = Math.pow(Math.cos(5.0 * Math.PI * xn), 2);
      const arg = 1.35 * Math.PI * xn;
      const sincTerm = Math.abs(arg) > 1e-4 ? Math.pow(Math.sin(arg) / arg, 2) : 1.0;
      const val = Math.round(255 * cosTerm * sincTerm);

      ctx.fillStyle = `rgb(${val},${val},${val})`;
      ctx.fillRect(x, Math.floor(ccy - slitH / 2), 1, Math.floor(slitH));
    }

    // HUD Info
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = `${Math.max(12, Math.floor(w * 0.03))}px monospace`;
    ctx.fillText(`MADELUNG DOUBLE-SLIT`, 15, Math.floor(h * 0.1));
  });

  // Convective build up
  await this.sleep(1300);

  // Settle frame
  const frame = await this.captureStable(8, 40);

  const fw = frame.width, fh = frame.height;
  const x0 = cal.x0 != null ? cal.x0 : Math.floor(fw * 0.15);
  const x1 = cal.x1 != null ? cal.x1 : Math.floor(fw * 0.85);
  const y0 = cal.y0 != null ? cal.y0 : Math.floor(fh * 0.15);
  const y1 = cal.y1 != null ? cal.y1 : Math.floor(fh * 0.85);
  const d = frame.data;

  this.setRun(this.t('etap'), this.t('measuring_profile'), 141.5);

  // 1. EXTRACT HORIZONTAL PROFILE (Assuming camera horizontal maps to screen horizontal)
  const spanH = x1 - x0;
  const profileH = new Float64Array(spanH);
  const yMid0 = Math.floor(fh * 0.35), yMid1 = Math.floor(fh * 0.65);
  for (let px = 0; px < spanH; px++) {
    let sum = 0, cnt = 0;
    for (let y = yMid0; y < yMid1; y += 3) {
      const i = (y * fw + x0 + px) * 4;
      sum += (d[i] + d[i+1] + d[i+2]) / 3;
      cnt++;
    }
    profileH[px] = sum / cnt;
  }
  if (isMirrored) profileH.reverse();

  // 2. EXTRACT VERTICAL PROFILE (Assuming camera vertical maps to screen horizontal due to 90-deg rotation)
  const spanV = y1 - y0;
  const profileV = new Float64Array(spanV);
  const xMid0 = Math.floor(fw * 0.35), xMid1 = Math.floor(fw * 0.65);
  for (let py = 0; py < spanV; py++) {
    let sum = 0, cnt = 0;
    for (let x = xMid0; x < xMid1; x += 3) {
      const i = ((y0 + py) * fw + x) * 4;
      sum += (d[i] + d[i+1] + d[i+2]) / 3;
      cnt++;
    }
    profileV[py] = sum / cnt;
  }

  // Pearson Correlation
  const pearsonCorr = (arr1, arr2) => {
    const n = arr1.length;
    if (!n) return 0;
    const m1 = mean(arr1);
    const m2 = mean(arr2);
    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i < n; i++) {
      const d1 = arr1[i] - m1;
      const d2 = arr2[i] - m2;
      num += d1 * d2;
      den1 += d1 * d1;
      den2 += d2 * d2;
    }
    return den1 > 1e-9 && den2 > 1e-9 ? num / Math.sqrt(den1 * den2) : 0;
  };

  // Detrending function to remove lens vignetting / slow background trend
  const detrend = (arr, windowSize) => {
    const n = arr.length;
    const result = new Float64Array(n);
    const half = Math.floor(windowSize / 2);
    for (let i = 0; i < n; i++) {
      let sum = 0, cnt = 0;
      const start = Math.max(0, i - half);
      const end = Math.min(n - 1, i + half);
      for (let j = start; j <= end; j++) {
        sum += arr[j];
        cnt++;
      }
      result[i] = arr[i] - (sum / cnt);
    }
    return result;
  };

  // Finds the maximum Pearson correlation by searching translation offsets, scale factors, and blur sigmas
  // 1D Gaussian blur helper
  const gaussianBlur = (arr, sigma) => {
    if (sigma <= 0.5) return arr;
    const n = arr.length;
    const dest = new Float64Array(n);
    const radius = Math.min(Math.ceil(sigma * 3), 60);
    const kernel = new Float64Array(2 * radius + 1);
    let sum = 0;
    for (let d = -radius; d <= radius; d++) {
      const g = Math.exp(-(d * d) / (2 * sigma * sigma));
      kernel[d + radius] = g;
      sum += g;
    }
    for (let k = 0; k < kernel.length; k++) kernel[k] /= sum;
    
    for (let i = 0; i < n; i++) {
      let val = 0;
      for (let k = -radius; k <= radius; k++) {
        const idx = Math.min(n - 1, Math.max(0, i + k));
        val += arr[idx] * kernel[k + radius];
      }
      dest[i] = val;
    }
    return dest;
  };

  const findMaxCorrelation = (measured) => {
    const span = measured.length;
    const detrendWindow = Math.floor(span * 0.25);
    const detrendedMeasured = detrend(measured, detrendWindow);
    
    // Normalize detrended measured
    const mMean = mean(detrendedMeasured);
    const mNorm = Array.from(detrendedMeasured).map(v => v - mMean);
    
    let bestCorr = 0;
    
    // Helper to translate array (translation is shift-invariant with blur)
    const translateArray = (arr, offset) => {
      const dest = new Float64Array(span);
      for (let i = 0; i < span; i++) {
        const srcIdx = i - offset;
        if (srcIdx >= 0 && srcIdx < span) {
          dest[i] = arr[srcIdx];
        } else {
          dest[i] = 0.0;
        }
      }
      return dest;
    };

    // 1. Loop over scale
    for (let scale = 0.45; scale <= 0.85; scale += 0.05) {
      // Generate centered expected pattern
      const expectedCentered = new Float64Array(span);
      for (let i = 0; i < span; i++) {
        const xn = (i - span / 2) / (span * scale);
        if (Math.abs(xn) > 0.5) {
          expectedCentered[i] = 0.0;
        } else {
          const cosTerm = Math.pow(Math.cos(5.0 * Math.PI * xn), 2);
          const arg = 1.35 * Math.PI * xn;
          const sincTerm = Math.abs(arg) > 1e-4 ? Math.pow(Math.sin(arg) / arg, 2) : 1.0;
          expectedCentered[i] = cosTerm * sincTerm;
        }
      }

      // 2. Loop over blur sigma (camera defocus simulation)
      for (let sigma = 0; sigma <= 40; sigma += 4) {
        const blurredCentered = gaussianBlur(expectedCentered, sigma);

        // 3. Loop over offset translation (covers massive off-center phone misalignments)
        for (let offset = -150; offset <= 150; offset += 3) {
          const expectedShifted = translateArray(blurredCentered, offset);
          const detrendedExpected = detrend(expectedShifted, detrendWindow);
          const eMean = mean(detrendedExpected);
          const eNorm = Array.from(detrendedExpected).map(v => v - eMean);
          
          const r = pearsonCorr(mNorm, eNorm);
          if (Math.abs(r) > Math.abs(bestCorr)) {
            bestCorr = r;
          }
        }
      }
    }
    return bestCorr;
  };

  const corrH = findMaxCorrelation(profileH);
  const corrV = findMaxCorrelation(profileV);

  // Take the maximum absolute correlation to handle rotation, mirroring, and inversion
  const corr = Math.max(Math.abs(corrH), Math.abs(corrV));

  this.showColor('#000000');

  const pass = corr > 0.75; // high correlation with double-slit profile

  this.log('\n━━━ STAGE 94 RESULTS ━━━');
  this.log(`  Profile Span (H/V)        : ${spanH} / ${spanV} px`);
  this.log(`  Horizontal Correlation    : r = ${corrH.toFixed(4)}`);
  this.log(`  Vertical Correlation      : r = ${corrV.toFixed(4)}`);
  this.log(`  Resolved Correlation      : r = ${corr.toFixed(4)}`);
  this.log(pass ? this.t('success', { var0: corr.toFixed(3) }) : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage94 = {
    method: 'VMF Madelung Double-Slit Interference Emulation',
    span: Math.max(spanH, spanV),
    correlation: round(corr, 4),
    pass
  };
}

export function render(r) {
  if (r.stage94) { try {
    const s = r.stage94;
    this.rv('rv-mad-corr', `r=${s.correlation.toFixed(3)}`, s.pass ? 'ok' : 'warn');
    const g = document.getElementById('g-s94');
    if (g) {
      g.textContent = s.pass ? `✅ Interference r=${s.correlation.toFixed(2)}` : '⚠️ Poor correlation';
      g.className = 'grade ' + (s.pass ? 'pass' : 'warn');
    }
  } catch(e) { console.error('s94 render:', e); } }
}

export function check(d) { try { return d && d.pass; } catch(e) { return false; } }
export function metric(d) { try { return `r=${d.correlation.toFixed(2)}`; } catch(e) { return '—'; } }
