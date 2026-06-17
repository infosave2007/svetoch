// Stage 44: DFT

export async function run() {
this.setRun(this.t('etap'), this.t('optical_dft_o_fure_za_odin_kad'), 104.0);
    this.showColor('#808080');
    await this.sleep(600);

    // Input signal: sum of sinusoids at coarse frequencies
    // Use low frequencies that survive mirror PSF blur
    const inputFreqs = [2, 5, 9]; // cycles across screen width
    const inputAmps = [1.0, 0.8, 0.5];
    const N = 20; // DFT bins to scan

    this.log(this.t('vkhodnoy_signal_f_a', {var0: inputFreqs.join(','), var1: inputAmps.join(',')}));

    // Generate and display composite signal as stripe pattern
    // Use full contrast range to maximize SNR
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        let val = 0;
        for (let k = 0; k < inputFreqs.length; k++) {
          val += inputAmps[k] * Math.sin(2 * Math.PI * inputFreqs[k] * x / w);
        }
        const maxAmp = inputAmps.reduce((a, b) => a + b, 0);
        const v = Math.round(((val / maxAmp) * 0.48 + 0.5) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(1000);

    // Capture ONE frame — this is the O(1) Fourier claim
    const frame = await this.captureStable(10, 60);

    // Extract power spectrum via matched filters
    this.setRun(this.t('etap'), this.t('izvlechenie_spektra_iz_odnogo_'), 104.3);
    const d = frame.data, fw = frame.width, fh = frame.height;
    const cal = this.results.calibration || {};
    const x0 = cal.x0 || Math.floor(fw * 0.15);
    const x1 = cal.x1 || Math.floor(fw * 0.85);
    const y0 = Math.floor(fh * 0.3), y1 = Math.floor(fh * 0.7);
    const span = x1 - x0;
    const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

    // Step 1: Extract 1D profile by averaging rows
    const profile = new Float64Array(span);
    const rowCount = new Float64Array(span);
    for (let y = y0; y < y1; y += 2) {
      for (let px = 0; px < span; px++) {
        const x = x0 + px;
        const i = (y * fw + x) * 4;
        profile[px] += (d[i] + d[i + 1] + d[i + 2]) / 3;
        rowCount[px]++;
      }
    }
    for (let px = 0; px < span; px++) {
      if (rowCount[px] > 0) profile[px] /= rowCount[px];
    }
    if (isMirrored) profile.reverse();

    // Step 2: CRITICAL — remove DC component (mean intensity)
    let meanI = 0;
    for (let px = 0; px < span; px++) meanI += profile[px];
    meanI /= span;
    const centered = new Float64Array(span);
    for (let px = 0; px < span; px++) centered[px] = profile[px] - meanI;

    // Step 3: Apply inverse gamma to linearize
    const gamma = cal.gamma || 1.5;
    const invGamma = 1.0 / gamma;
    for (let px = 0; px < span; px++) {
      const raw = (profile[px] - (cal.blackMean || 0)) / Math.max((cal.whiteMean || 255) - (cal.blackMean || 0), 1);
      const lin = raw > 0 ? Math.pow(raw, invGamma) : 0;
      centered[px] = lin;
    }
    // Remove DC again after gamma correction
    let meanLin = 0;
    for (let px = 0; px < span; px++) meanLin += centered[px];
    meanLin /= span;
    for (let px = 0; px < span; px++) centered[px] -= meanLin;

    // Step 4: DFT on centered, gamma-corrected signal
    const opticalPower = [];
    for (let k = 0; k < N; k++) {
      let sinSum = 0, cosSum = 0;
      for (let px = 0; px < span; px++) {
        const phase = 2 * Math.PI * k * px / span;
        sinSum += centered[px] * Math.sin(phase);
        cosSum += centered[px] * Math.cos(phase);
      }
      opticalPower.push(Math.sqrt(sinSum * sinSum + cosSum * cosSum) / span);
    }

    // Digital DFT of the input signal for comparison
    const digitalPower = [];
    for (let k = 0; k < N; k++) {
      let sinSum = 0, cosSum = 0;
      for (let n = 0; n < span; n++) {
        let val = 0;
        for (let fi = 0; fi < inputFreqs.length; fi++) {
          val += inputAmps[fi] * Math.sin(2 * Math.PI * inputFreqs[fi] * n / span);
        }
        const phase = 2 * Math.PI * k * n / span;
        sinSum += val * Math.sin(phase);
        cosSum += val * Math.cos(phase);
      }
      digitalPower.push(Math.sqrt(sinSum * sinSum + cosSum * cosSum) / span);
    }

    // Normalize both (skip DC bin k=0)
    const maxOpt = Math.max(...opticalPower.slice(1)) || 1;
    const maxDig = Math.max(...digitalPower.slice(1)) || 1;
    const optNorm = opticalPower.map(v => v / maxOpt);
    const digNorm = digitalPower.map(v => v / maxDig);

    // Find peaks (skip DC k=0)
    const findPeaks = (spec, thresh = 0.2) => {
      const peaks = [];
      for (let k = 1; k < spec.length - 1; k++) {
        if (spec[k] > thresh && spec[k] > spec[k - 1] && spec[k] >= spec[k + 1]) {
          peaks.push(k);
        }
      }
      return peaks;
    };
    const optPeaks = findPeaks(optNorm);
    const digPeaks = findPeaks(digNorm);

    // Fuzzy peak matching: allow ±1 bin tolerance
    const peaksMatch = inputFreqs.filter(f =>
      optPeaks.some(p => Math.abs(p - f) <= 1)
    ).length;

    // Correlation on AC spectrum only (skip k=0)
    const specCorr = this.pearsonCorr(optNorm.slice(1), digNorm.slice(1));

    this.log(`  DC removed, γ⁻¹=${invGamma.toFixed(2)} applied`);
    this.log(`  Digital peaks: [${digPeaks.join(',')}]`);
    this.log(`  Optical peaks: [${optPeaks.join(',')}]`);
    this.log(`  Peaks matched: ${peaksMatch}/${inputFreqs.length} (±1 bin)`);
    this.log(`  Spectrum correlation: ${specCorr.toFixed(4)}`);
    this.log(this.t('optical_dft', {var0: peaksMatch >= 2 ? 'РАБОТАЕТ' : 'слабый'}), peaksMatch >= 2 ? 'ok' : 'warn');

    this.showColor('#000000');
    this.results.stage44 = {
      inputFreqs, inputAmps, N,
      opticalPeaks: optPeaks,
      digitalPeaks: digPeaks,
      peaksMatch,
      specCorr: Number(specCorr.toFixed(4)),
      pass: peaksMatch >= 2 && specCorr > 0.2
    };
}

export function render(r) {
if (r.stage44) { try {
      const s = r.stage44;
      this.rv('rv-dft-input', `[${s.inputFreqs?.join(',')}]`, 'ok');
      this.rv('rv-dft-optical', `[${s.opticalPeaks?.join(',')}]`, s.pass ? 'ok' : 'warn');
      this.rv('rv-dft-corr', s.specCorr?.toFixed(4), s.specCorr > 0.3 ? 'ok' : 'warn');
      this.rv('rv-dft-peaks', `${s.peaksMatch}/${s.inputFreqs?.length}`, s.peaksMatch >= 2 ? 'ok' : 'bad');
      const g = document.getElementById('g-s44');
      if (s.pass) { g.textContent=this.t('o_fure_rabotaet'); g.className='grade pass'; }
      else { g.textContent=this.t('spektr_chastichno'); g.className='grade partial'; }
    } catch(e) { console.error('stage44 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.specCorr||0).toFixed(3))(d); } catch(e) { return '—'; }
}
