// Stage 7: SiLU

export async function run() {
this.setRun(this.t('etap'), 'Natural SiLU...', 96);
    this.showColor('#808080');
    await this.sleep(800);

    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;

    // Measure transfer curve at 20 intensity levels
    const nLevels = 20;
    const inputs = [];
    const outputs = [];

    // Reference white
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    for (let i = 0; i < nLevels; i++) {
      const level = i / (nLevels - 1); // 0 to 1
      inputs.push(level);
      this.setRun(this.t('etap'), this.t('uroven', {var0: i+1, var1: nLevels, var2: Math.round(level*100)}), 96 + i * 0.15);

      const v = Math.round(level * 255);
      this.showColor(`rgb(${v},${v},${v})`);
      await this.sleep(500);
      const frame = await this.captureStable(5, 50);
      const rawMean = this.regionMean(frame);
      const normalized = (rawMean - blackLevel) / Math.max(refBright - blackLevel, 1);
      outputs.push(Math.max(0, Math.min(1, normalized)));

      this.showColor('#808080'); await this.sleep(300);
    }

    // Compute SiLU reference: SiLU(x) = x * sigmoid(x), normalized to [0,1]
    const siluRef = inputs.map(x => x * this.sigmoid(x * 6 - 3)); // scaled SiLU
    const siluMax = Math.max(...siluRef, 0.01);
    const siluNorm = siluRef.map(v => v / siluMax);

    // ReLU reference
    const reluRef = inputs.map(x => Math.max(0, x - 0.1)); // ReLU with small bias
    const reluMax = Math.max(...reluRef, 0.01);
    const reluNorm = reluRef.map(v => v / reluMax);

    // Normalize outputs to [0,1]
    const outMax = Math.max(...outputs, 0.01);
    const outNorm = outputs.map(v => v / outMax);

    // Correlations
    const siluCorr = this.pearson(outNorm, siluNorm);
    const reluCorr = this.pearson(outNorm, reluNorm);
    const linearCorr = this.pearson(outNorm, inputs);

    // Nonlinearity measure: 1 - R² with linear fit
    const nonlinearity = (1 - linearCorr * linearCorr) * 100;

    this.log(`SiLU corr=${siluCorr.toFixed(4)}, ReLU corr=${reluCorr.toFixed(4)}`);
    this.log(this.t('nelineynost', {var0: nonlinearity.toFixed(1)}), nonlinearity > 5 ? 'ok' : 'warn');

    this.results.stage7 = {
      inputs, outputs: outNorm, siluRef: siluNorm, reluRef: reluNorm,
      siluCorrelation: siluCorr, reluCorrelation: reluCorr,
      nonlinearity, linearCorrelation: linearCorr
    };
}

export function render(r) {
if (r.stage7) { try {
      const s = r.stage7;
      this.rv('rv-silu-corr', s.siluCorrelation.toFixed(4), s.siluCorrelation>0.9?'ok':s.siluCorrelation>0.7?'warn':'bad');
      this.rv('rv-relu-corr', s.reluCorrelation.toFixed(4), s.reluCorrelation>0.9?'ok':s.reluCorrelation>0.7?'warn':'bad');
      this.rv('rv-nonlin', s.nonlinearity.toFixed(1)+'%', s.nonlinearity>5?'ok':s.nonlinearity>1?'warn':'bad');
      const g = document.getElementById('g-s7');
      if (s.siluCorrelation > 0.85 && s.nonlinearity > 5) { g.textContent=this.t('estestvennaya_siluaktivatsiya'); g.className='grade pass'; }
      else if (s.nonlinearity > 2) { g.textContent=this.t('slabaya_nelineynost'); g.className='grade partial'; }
      else { g.textContent=this.t('kanal_lineynyy'); g.className='grade fail'; }
      this.drawSiLUChart(s);
    } catch(e) { console.error('stage7 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.nonlinearity > 2)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => (d.nonlinearity||0).toFixed(1) + '%')(d); } catch(e) { return '—'; }
}
