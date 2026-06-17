// Stage 16: ψ-Sup

export async function run() {
this.setRun(this.t('etap'), this.t('superpozitsiya'), 99.91);
    this.showColor('#808080');
    await this.sleep(800);

    // Pattern A: vertical stripes 16px
    // Pattern B: vertical stripes 16px with π/2 phase shift
    // Pattern A+B: superposition (both shown at 50% intensity each)
    const sz = 16;
    const measurements = {};

    // Measure I(A) — stripes at phase 0
    this.log(this.t('a_poloski_faza'));
    this.showPattern((ctx, w, h) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const v = Math.round(127 + 127 * Math.sin(2*Math.PI*x/(sz*dpr)));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(1000);
    const fA = await this.captureStable(10, 60);
    measurements.IA = this.regionMean(fA);
    const profileA = this.getHorizontalProfile(fA);
    this.log(`  I(A) = ${measurements.IA.toFixed(4)}`);

    this.showColor('#808080'); await this.sleep(600);

    // Measure I(B) — stripes at phase π/2
    this.log(this.t('b_poloski_faza'));
    this.showPattern((ctx, w, h) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const v = Math.round(127 + 127 * Math.sin(2*Math.PI*x/(sz*dpr) + Math.PI/2));
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(1000);
    const fB = await this.captureStable(10, 60);
    measurements.IB = this.regionMean(fB);
    const profileB = this.getHorizontalProfile(fB);
    this.log(`  I(B) = ${measurements.IB.toFixed(4)}`);

    this.showColor('#808080'); await this.sleep(600);

    // Measure I(A+B) — superposition at 50% each
    this.log(this.t('ab_superpozitsiya'));
    this.showPattern((ctx, w, h) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x++) {
        const vA = Math.sin(2*Math.PI*x/(sz*dpr));
        const vB = Math.sin(2*Math.PI*x/(sz*dpr) + Math.PI/2);
        const combined = (vA + vB) / 2; // Superposition
        const v = Math.round(127 + 127 * combined);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, 0, 1, h);
      }
    });
    await this.sleep(1000);
    const fAB = await this.captureStable(10, 60);
    measurements.IAB = this.regionMean(fAB);
    const profileAB = this.getHorizontalProfile(fAB);
    this.log(`  I(A+B) = ${measurements.IAB.toFixed(4)}`);

    // Classical expectation: I(A+B)_classical = (I(A) + I(B)) / 2
    const classicalSum = (measurements.IA + measurements.IB) / 2;
    // Quantum interference: deviation from classical
    const interference = measurements.IAB - classicalSum;
    const relDeviation = Math.abs(interference) / Math.max(classicalSum, 0.001) * 100;

    // Compute visibility from profile: V = (I_max - I_min) / (I_max + I_min)
    const pMax = Math.max(...profileAB, 0.01);
    const pMin = Math.min(...profileAB);
    const visibility = (pMax - pMin) / (pMax + pMin);

    this.log(this.t('klassich_izmer', {var0: classicalSum.toFixed(4), var1: measurements.IAB.toFixed(4)}));
    this.log(this.t('interf_otkl_vidnost', {var0: relDeviation.toFixed(1), var1: visibility.toFixed(3)}));
    this.log(this.t('superpozitsiya_1', {var0: relDeviation > 3 ? 'подтверждена' : 'слабая'}), relDeviation > 3 ? 'ok' : 'warn');

    this.results.stage16 = {
      IA: measurements.IA, IB: measurements.IB, IAB: measurements.IAB,
      classicalSum, interference, relDeviation, visibility,
      profileA, profileB, profileAB
    };
}

export function render(r) {
if (r.stage16) { try {
      const s = r.stage16;
      this.rv('rv-qs-interf', s.interference.toFixed(4), Math.abs(s.interference) > 0.01 ? 'ok' : 'warn');
      this.rv('rv-qs-dev', s.relDeviation.toFixed(1)+'%', s.relDeviation > 3 ? 'ok' : 'warn');
      this.rv('rv-qs-vis', s.visibility.toFixed(3), s.visibility > 0.05 ? 'ok' : 'warn');
      const g = document.getElementById('g-s16');
      if (s.relDeviation > 5 && s.visibility > 0.05) {
        g.textContent=this.t('interferentsiya'); g.className='grade pass';
      } else if (s.relDeviation > 2) {
        g.textContent=this.t('slabaya_interferentsiya'); g.className='grade partial';
      } else { g.textContent=this.t('klassicheskoe_slozhenie'); g.className='grade fail'; }
      this.drawQSuperChart(s);
    } catch(e) { console.error('stage16 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.relDeviation > 3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'dev=' + (d.relDeviation||0).toFixed(1) + '%')(d); } catch(e) { return '—'; }
}
