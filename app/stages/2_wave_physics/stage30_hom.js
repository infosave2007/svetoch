// Stage 30: HOM

export async function run() {
this.setRun(this.t('etap'), 'HOM Interference...', 103);
    this.showColor('#808080');
    await this.sleep(800);

    const period = 16; // pixels
    const nShifts = 12;
    const intensities = [];
    const fringeAmplitudes = [];
    const shifts = [];

    const measureFringeAmplitude = (frame) => {
      if (!frame) return 0;
      const profile = this.getHorizontalProfile(frame);
      if (profile.length < 8) return 0;
      const mean = profile.reduce((a,b)=>a+b,0) / profile.length;
      let best = 0;
      for (let periodSamples = 4; periodSamples <= 40; periodSamples++) {
        let sin = 0, cos = 0;
        for (let i = 0; i < profile.length; i++) {
          const phase = 2 * Math.PI * i / periodSamples;
          const v = profile[i] - mean;
          sin += v * Math.sin(phase);
          cos += v * Math.cos(phase);
        }
        const amp = Math.sqrt(sin*sin + cos*cos) / Math.max(profile.length * mean, 1e-6);
        if (amp > best) best = amp;
      }
      return best;
    };

    for (let s = 0; s < nShifts; s++) {
      const dx = s * period / nShifts; // shift in pixels
      shifts.push(dx);
      this.setRun(this.t('etap'), `Δx=${dx.toFixed(1)}px...`, 103 + s * 0.2);

      // Show two overlapping stripe patterns with shift dx
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          // Pattern 1 (fixed) + Pattern 2 (shifted by dx)
          const v1 = Math.sin(2*Math.PI*x/(period*dpr));
          const v2 = Math.sin(2*Math.PI*(x - dx*dpr)/(period*dpr));
          // Superposition: add amplitudes
          const combined = Math.round(Math.max(0, Math.min(255, 127 + 63*(v1 + v2))));
          ctx.fillStyle = `rgb(${combined},${combined},${combined})`;
          ctx.fillRect(x, 0, 1, h);
        }
      });
      await this.sleep(600);
      const frame = await this.captureStable(6, 40);
      const mean = this.regionMean(frame);
      intensities.push(mean);
      fringeAmplitudes.push(measureFringeAmplitude(frame));
      this.showColor('#808080'); await this.sleep(200);
    }

    const Imax = Math.max(...fringeAmplitudes);
    const Imin = Math.min(...fringeAmplitudes);
    const Imean = fringeAmplitudes.reduce((a,b)=>a+b,0) / fringeAmplitudes.length;
    const amplitude = (Imax - Imin) / 2;
    const visibility = (Imax + Imin) > 0 ? (Imax - Imin) / (Imax + Imin) : 0;

    const expected = shifts.map(dx => Math.abs(Math.cos(Math.PI*dx/period)));
    const corrSin = this.pearsonCorr(fringeAmplitudes, expected);
    const matchedScore = Math.max(0, corrSin) * visibility;

    this.log(this.t('skanirovanie_i', {var0: fringeAmplitudes.map(v=>v.toFixed(3)).join(',')}));
    this.log(`ACmax=${Imax.toFixed(3)}, ACmin=${Imin.toFixed(3)}, ACmean=${Imean.toFixed(3)}`);
    this.log(this.t('vidnost_v_acdc', {var0: visibility.toFixed(3), var1: amplitude.toFixed(1), var2: Imean.toFixed(1)}));
    this.log(this.t('korr_s_cos', {var0: corrSin.toFixed(3)}));
    this.log(this.t('hom', {var0: visibility > 0.3 ? (visibility > 0.5 ? 'КВАНТОВЫЙ' : 'работает') : 'слабый'}),
      visibility > 0.3 ? 'ok' : 'warn');

    this.results.stage30 = { shifts, intensities, fringeAmplitudes, Imax, Imin, Imean, visibility, corrSin, matchedScore };
}

export function render(r) {
if (r.stage30) { try {
      const s = r.stage30;
      this.rv('rv-hom-vis', (s.visibility||0).toFixed(3), s.visibility>0.3?'ok':'warn');
      const g = document.getElementById('g-s30');
      if (s.visibility>0.3) { g.textContent=this.t('hom_podtverzhdyon'); g.className='grade pass'; }
      else { g.textContent=this.t('nizkaya_vidimost'); g.className='grade fail'; }
    } catch(e) { console.error('stage30 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.visibility > 0.3 && (d.corrSin === undefined || d.corrSin > 0.5))(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'V=' + (d.visibility||0).toFixed(3))(d); } catch(e) { return '—'; }
}
