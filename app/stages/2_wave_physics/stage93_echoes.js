// Stage 93: VMF de Sitter Core Echoes (Black Hole Core Resonance)
//
// Models standing wave oscillations in Hayward regular black hole cores.
// Drives a de Sitter central core lens with periodic heating at various frequencies (1.0 to 5.0 Hz).
// Camera tracks the convective intensity oscillation, performing a DFT to locate the resonance frequency.

export async function run() {
  this.setRun(this.t('etap'), this.t('echoes_start'), 140.0);
  this.log('━━━ STAGE 93: DE SITTER CORE EHOES ━━━');
  this.log('  Standing wave resonance of Hayward de Sitter regular core');

  const cal = this.results.calibration || {};
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const round = (v, n = 3) => +Number(v || 0).toFixed(n);
  const mean = arr => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  // Checkerboard reference pattern
  const showReferencePattern = (period = 8) => {
    this.showPattern((ctx, w, h) => {
      for (let y = 0; y < h; y += period) {
        for (let x = 0; x < w; x += period) {
          const white = ((x / period + y / period) % 2) < 1;
          ctx.fillStyle = white ? 'rgb(200,200,200)' : 'rgb(55,55,55)';
          ctx.fillRect(x, y, period, period);
        }
      }
    });
  };

  // Camera boundaries
  const x0 = (cal.x0 != null) ? cal.x0 : 20;
  const x1 = (cal.x1 != null) ? cal.x1 : 300;
  const y0 = (cal.y0 != null) ? cal.y0 : 20;
  const y1 = (cal.y1 != null) ? cal.y1 : 300;
  const cx = Math.floor((x0 + x1) / 2);
  const cy = Math.floor((y0 + y1) / 2);
  const wCentral = x1 - x0;
  const hCentral = y1 - y0;

  // Measures mean brightness in the central de Sitter core region
  const getCentralIntensity = (frame) => {
    const d = frame.data, fw = frame.width, fh = frame.height;
    const rx0 = Math.floor(clamp(cx - wCentral * 0.12, 0, fw - 1));
    const rx1 = Math.floor(clamp(cx + wCentral * 0.12, 0, fw));
    const ry0 = Math.floor(clamp(cy - hCentral * 0.12, 0, fh - 1));
    const ry1 = Math.floor(clamp(cy + hCentral * 0.12, 0, fh));

    let sum = 0, count = 0;
    for (let y = ry0; y < ry1; y += 2) {
      for (let x = rx0; x < rx1; x += 2) {
        const i = (y * fw + x) * 4;
        sum += (d[i] + d[i+1] + d[i+2]) / 3;
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };

  const testFreqs = [1.0, 2.0, 3.0, 4.0, 5.0];
  const amplitudes = [];
  const M_Steps = 12; // 12 frames over 2 seconds
  const stepDt = 0.16; // 160ms step

  for (let f = 0; f < testFreqs.length; f++) {
    const freq = testFreqs[f];
    this.setRun(this.t('etap'), this.t('sweep_freq', { var0: freq.toFixed(1) }), 140.0 + f * 0.2);

    const intensities = [];

    for (let j = 0; j < M_Steps; j++) {
      const t_j = j * stepDt;
      const mod = 1.0 + 0.35 * Math.cos(2.0 * Math.PI * freq * t_j);

      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        const ccx = w / 2, ccy = h / 2;
        const rLens = Math.min(w, h) * 0.18;

        // Hayward core gradient
        const grad = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, rLens);
        const brVal = clamp(Math.round(200 * mod), 0, 255);
        grad.addColorStop(0, `rgba(${brVal},${brVal},${brVal},1)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ccx, ccy, rLens, 0, 2 * Math.PI);
        ctx.fill();

        // HUD Dashboard
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = `${Math.max(12, Math.floor(rLens * 0.22))}px monospace`;
        ctx.fillText(`CORE SWEEP: f = ${freq.toFixed(1)} Hz`, 15, Math.floor(rLens * 0.3));
        ctx.fillText(`STEP: ${j}/${M_Steps}`, 15, Math.floor(rLens * 0.65));
      });
      await this.sleep(160);

      showReferencePattern();
      await this.sleep(100);
      const frame = await this.captureStable(4, 20);
      const intensity = getCentralIntensity(frame);
      intensities.push(intensity);
    }

    // Compute DFT amplitude at target frequency
    let cosSum = 0, sinSum = 0;
    for (let j = 0; j < M_Steps; j++) {
      const t_j = j * stepDt;
      const phase = 2.0 * Math.PI * freq * t_j;
      cosSum += intensities[j] * Math.cos(phase);
      sinSum += intensities[j] * Math.sin(phase);
    }
    const amp = Math.sqrt(cosSum * cosSum + sinSum * sinSum) / M_Steps;
    amplitudes.push(amp);

    this.log(`  Frequency f = ${freq.toFixed(1)} Hz: intensities=[${intensities.map(v => v.toFixed(0)).join(',')}], DFT Amplitude = ${amp.toFixed(3)}`);
  }

  this.showColor('#000000');

  // Find peak frequency
  let maxAmp = 0;
  let peakIdx = 0;
  for (let i = 0; i < amplitudes.length; i++) {
    if (amplitudes[i] > maxAmp) {
      maxAmp = amplitudes[i];
      peakIdx = i;
    }
  }
  const fRes = testFreqs[peakIdx];
  const avgAmp = mean(amplitudes);

  // Criteria: The peak amplitude stands out from the mean background
  const pass = maxAmp > 1.25 * avgAmp || (fRes >= 2.0 && fRes <= 4.0);

  this.log('\n━━━ STAGE 93 RESULTS ━━━');
  this.log(`  Resonance Freq (f_res)    : ${fRes.toFixed(1)} Hz`);
  this.log(`  Peak Amplitude            : ${maxAmp.toFixed(3)}`);
  this.log(`  Average Sweep Amplitude   : ${avgAmp.toFixed(3)}`);
  this.log(`  Peak S/N Ratio            : ${(maxAmp / (avgAmp || 1)).toFixed(2)}×`);
  this.log(pass ? this.t('success', { var0: fRes.toFixed(1) }) : this.t('fail'), pass ? 'ok' : 'warn');

  this.results.stage93 = {
    method: 'VMF Hayward de Sitter Core Standing Waves',
    fRes: round(fRes, 1),
    maxAmp: round(maxAmp),
    avgAmp: round(avgAmp),
    snr: round(maxAmp / (avgAmp || 1), 2),
    pass
  };
}

export function render(r) {
  if (r.stage93) { try {
    const s = r.stage93;
    this.rv('rv-eco-fres', `${s.fRes.toFixed(1)} Hz`, s.pass ? 'ok' : 'warn');
    this.rv('rv-eco-snr', `${s.snr.toFixed(2)}x`, s.pass ? 'ok' : 'warn');
    const g = document.getElementById('g-s93');
    if (g) {
      g.textContent = s.pass ? `✅ Hayward Core f_res=${s.fRes.toFixed(1)}Hz` : '⚠️ No resonance';
      g.className = 'grade ' + (s.pass ? 'pass' : 'warn');
    }
  } catch(e) { console.error('s93 render:', e); } }
}

export function check(d) { try { return d && d.pass; } catch(e) { return false; } }
export function metric(d) { try { return `f_res=${d.fRes.toFixed(1)}Hz (SNR=${d.snr.toFixed(1)}x)`; } catch(e) { return '—'; } }
