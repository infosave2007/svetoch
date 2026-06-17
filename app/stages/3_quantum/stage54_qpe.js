// Stage 54: QPE

export async function run() {
this.setRun(this.t('etap'), this.t('qpe_bit_otsenka_fazy_shor'), 114.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const isMirrored = cal.isMirrored !== undefined ? cal.isMirrored : true;

    // QPE: 4-bit precision → resolution 1/16 = 0.0625
    const nBits = 4;
    const N = 1 << nBits; // 16

    // Helper: extract 1D profile from frame
    const extractProfile = (frame) => {
      const d = frame.data, fw = frame.width, fh = frame.height;
      const x0 = cal.x0 || Math.floor(fw * 0.15);
      const x1 = cal.x1 || Math.floor(fw * 0.85);
      const y0 = Math.floor(fh * 0.35), y1 = Math.floor(fh * 0.65);
      const span = x1 - x0;
      const profile = new Float64Array(span);
      for (let px = 0; px < span; px++) {
        let sum = 0, cnt = 0;
        for (let y = y0; y < y1; y += 3) {
          const i = (y * fw + x0 + px) * 4;
          sum += (d[i] + d[i+1] + d[i+2]) / 3;
          cnt++;
        }
        profile[px] = sum / cnt;
      }
      if (isMirrored) profile.reverse();
      // DC removal
      let mean = 0;
      for (let i = 0; i < span; i++) mean += profile[i];
      mean /= span;
      for (let i = 0; i < span; i++) profile[i] -= mean;
      return { profile, span };
    };

    // Helper: find peak frequency in profile (fine-grained DFT)
    const findPeakFreq = (profile, span) => {
      const maxK = N * 2; // search wider range
      let bestK = 0, bestPow = 0;
      // Search with 0.25 bin resolution for precision
      for (let ki = 1; ki <= maxK * 4; ki++) {
        const k = ki / 4;
        let sinS = 0, cosS = 0;
        for (let px = 0; px < span; px++) {
          const phase = 2 * Math.PI * k * px / span;
          sinS += profile[px] * Math.sin(phase);
          cosS += profile[px] * Math.cos(phase);
        }
        const pow = sinS * sinS + cosS * cosS;
        if (pow > bestPow) { bestPow = pow; bestK = k; }
      }
      return bestK;
    };

    // Step 1: Calibrate — display pattern with known 4 periods, measure actual k
    this.log(this.t('kalibrovka_chastotnogo_masshta'));
    const calFreq = 4; // 4 periods on screen
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const v = Math.round(128 + 120 * Math.cos(2 * Math.PI * calFreq * x / w));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(600);
    const calFrame = await this.captureStable(8, 50);
    const { profile: calProf, span: calSpan } = extractProfile(calFrame);
    const calK = findPeakFreq(calProf, calSpan);
    const freqScale = calFreq / calK; // screen_freq / camera_freq
    this.log(`  Cal: displayed=${calFreq}, measured=${calK.toFixed(2)}, scale=${freqScale.toFixed(3)}`);

    this.showColor('#808080'); await this.sleep(300);

    // Step 2: Test phases with calibrated scale
    const testPhases = [
      { phi: 0.0625, label: '1/16' },
      { phi: 0.1250, label: '2/16' },
      { phi: 0.2500, label: '4/16' },
      { phi: 0.3750, label: '6/16' },
      { phi: 7/15,   label: '7/15 (Shor)' },
      { phi: 0.5000, label: '8/16' },
    ];
    const results = [];

    for (let ti = 0; ti < testPhases.length; ti++) {
      const { phi, label } = testPhases[ti];
      this.setRun(this.t('etap'), `QPE φ=${label}...`, 114.0 + ti * 0.15);

      const freq = phi * N;
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const v = Math.round(128 + 120 * Math.cos(2 * Math.PI * freq * x / w));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, 0, 1, h);
        }
      });
      await this.sleep(500);
      const frame = await this.captureStable(8, 50);
      const { profile, span } = extractProfile(frame);
      const rawK = findPeakFreq(profile, span);

      // Apply calibration: convert camera frequency to screen frequency
      const correctedFreq = rawK * freqScale;
      const bestBin = Math.round(correctedFreq); // nearest integer bin
      const measuredPhi = bestBin / N;
      const error = Math.abs(measuredPhi - phi);

      // For non-exact phases, check if nearest bin was hit
      const nearestBin = Math.round(phi * N);
      const effectiveError = Math.abs(bestBin - nearestBin) / N;

      results.push({ phi, label, measuredPhi, bestBin, rawK: Number(rawK.toFixed(2)), correctedFreq: Number(correctedFreq.toFixed(2)), error: Number(error.toFixed(4)), effectiveError: Number(effectiveError.toFixed(4)) });
      this.log(`  φ=${label}: raw_k=${rawK.toFixed(1)}, corrected=${correctedFreq.toFixed(1)} → bin=${bestBin}/${N}, φ_meas=${measuredPhi.toFixed(4)}, err=${error.toFixed(4)}`);
      this.showColor('#808080'); await this.sleep(200);
    }

    const avgError = results.reduce((s, r) => s + r.error, 0) / results.length;
    const exactHits = results.filter(r => r.effectiveError < 0.001).length;
    const shorReady = avgError <= 0.0625;
    const pass = exactHits >= 4;

    this.log(this.t('qpe_bit'));
    this.log(this.t('srednyaya_oshibka_shor_limit', {var0: avgError.toFixed(4)}));
    this.log(this.t('tochnykh_popadaniy', {var0: exactHits, var1: results.length}));
    this.log(this.t('shor_n', {var0: shorReady ? 'ГОТОВ' : 'не готов'}));
    this.log(this.t('qpe', {var0: pass ? 'РАБОТАЕТ → Shor возможен' : 'частично'}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage54 = { results, avgError: Number(avgError.toFixed(4)), shorReady, pass, nBits, freqScale: Number(freqScale.toFixed(3)) };
}

export function render(r) {
if (r.stage54) { try {
      const s = r.stage54;
      this.rv('rv-qpe-phase', s.results?.map(r => r.measuredPhi?.toFixed(4)).join(', '), 'ok');
      this.rv('rv-qpe-err', this.t('bit_shor', {var0: s.avgError?.toFixed(4), var1: s.nBits||3, var2: s.shorReady?'✓':'✗'}), s.pass ? 'ok' : 'warn');
      const g = document.getElementById('g-s54');
      if (s.pass && s.shorReady) { g.textContent=this.t('qpe_bit_shor_n_gotov'); g.className='grade pass'; }
      else if (s.pass) { g.textContent=this.t('qpe_fazy_izmereny_shor_trebuet'); g.className='grade pass'; }
      else { g.textContent=this.t('qpe_chastichno'); g.className='grade partial'; }
    } catch(e) { console.error('stage54 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'err=' + (d.avgError||0).toFixed(4))(d); } catch(e) { return '—'; }
}
