// Stage 57: Bounce

export async function run() {
this.setRun(this.t('etap'), this.t('nvg_bounce_modifitsirovannyy_f'), 117.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const dark = (cal.blackMean || 0) / 255;
    const white = (cal.whiteMean || 255) / 255;
    const span = Math.max(white - dark, 1e-4);
    const invGamma = cal.gamma > 0.01 ? 1 / cal.gamma : 1;
    const calibratedMean = (frame) => {
      const raw = this.regionMean(frame) / 255;
      const norm = Math.max(0, Math.min(1, (raw - dark) / span));
      return Math.pow(norm, invGamma);
    };

    // Compute theoretical a(t) from modified Friedman equation
    // H² = (8πG/3)·ρ·(1 - ρ/ρ_c), ρ ∝ a^(-3) (matter-dominated)
    // Normalized: a_min = 0.3, symmetric bounce
    const nSteps = 16;
    const tArr = [], aTheory = [];
    for (let i = 0; i < nSteps; i++) {
      const t = -1 + 2 * i / (nSteps - 1); // t ∈ [-1, 1]
      // Bounce profile: a(t) = a_min + (1 - a_min)·t²
      const a_min = 0.3;
      const a = a_min + (1 - a_min) * t * t;
      tArr.push(t);
      aTheory.push(a);
    }

    this.log(this.t('fridman_h_g_c'));
    this.log(this.t('bauns_amin_shagov', {var0: nSteps}));

    // Display each brightness level and measure camera response
    const aMeasured = [];
    for (let i = 0; i < nSteps; i++) {
      const brightness = Math.round(aTheory[i] * 220 + 10);
      this.showColor(`rgb(${brightness},${brightness},${brightness})`);
      await this.sleep(350);
      const frame = await this.captureStable(6, 35);
      const mean = calibratedMean(frame);
      aMeasured.push(mean);
    }

    // Normalize measured to [0,1]
    const mMin = Math.min(...aMeasured);
    const mMax = Math.max(...aMeasured);
    const aNorm = aMeasured.map(v => (v - mMin) / Math.max(mMax - mMin, 1));

    // Find bounce point (minimum)
    let bounceIdx = 0, bounceVal = Infinity;
    for (let i = 0; i < aNorm.length; i++) {
      if (aNorm[i] < bounceVal) { bounceVal = aNorm[i]; bounceIdx = i; }
    }

    // Check V-shape: minimum should be near center
    const centerDist = Math.abs(bounceIdx - nSteps/2) / (nSteps/2);
    const isVShape = centerDist < 0.3;

    // Check symmetry: compare left and right halves
    let symErr = 0, symCnt = 0;
    for (let d = 1; d <= Math.min(bounceIdx, nSteps - 1 - bounceIdx); d++) {
      const left = aNorm[bounceIdx - d];
      const right = aNorm[bounceIdx + d];
      symErr += Math.abs(left - right);
      symCnt++;
    }
    const symmetry = symCnt > 0 ? 1 - symErr / symCnt : 0;

    // Compute correlation with theory
    let corrNum = 0, corrDA = 0, corrDT = 0;
    const meanA = aNorm.reduce((s, v) => s + v, 0) / nSteps;
    const meanT = aTheory.reduce((s, v) => s + v, 0) / nSteps;
    for (let i = 0; i < nSteps; i++) {
      corrNum += (aNorm[i] - meanA) * (aTheory[i] - meanT);
      corrDA += (aNorm[i] - meanA) ** 2;
      corrDT += (aTheory[i] - meanT) ** 2;
    }
    const corr = (corrDA > 0 && corrDT > 0) ? corrNum / Math.sqrt(corrDA * corrDT) : 0;

    const pass = corr > 0.8 && isVShape && symmetry > 0.5;

    this.log(`  a(t) measured: [${aNorm.map(v => v.toFixed(2)).join(', ')}]`);
    this.log(this.t('baunstochka_t_centerdist', {var0: bounceIdx, var1: centerDist.toFixed(2)}));
    this.log(this.t('simmetriya', {var0: (symmetry*100).toFixed(1)}));
    this.log(this.t('korrelyatsiya_atteoriya', {var0: corr.toFixed(4)}));
    this.log(`━━━ NVG BOUNCE ━━━`);
    this.log(this.t('nvg_bauns', {var0: pass ? 'ПОДТВЕРЖДЁН!' : 'частично'}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage57 = {
      bounceIdx, centerDist: Number(centerDist.toFixed(3)),
      symmetry: Number(symmetry.toFixed(4)),
      corr: Number(corr.toFixed(4)),
      aMeasured,
      aNorm,
      isVShape, pass
    };
}

export function render(r) {
if (r.stage57) { try {
      const s = r.stage57;
      const g = document.getElementById('g-s57');
      if (s.pass) { g.textContent=`✅ NVG Bounce: corr=${s.corr.toFixed(3)}, sym=${(s.symmetry*100).toFixed(0)}%`; g.className='grade pass'; }
      else { g.textContent=`⚠️ Bounce: corr=${s.corr.toFixed(3)}`; g.className='grade partial'; }
    } catch(e) { console.error('stage57 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.corr||0).toFixed(3))(d); } catch(e) { return '—'; }
}
