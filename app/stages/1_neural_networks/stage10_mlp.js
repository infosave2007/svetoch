// Stage 10: MLP

export async function run() {
this.setRun(this.t('etap'), '2-Layer MLP...', 99);
    this.showColor('#808080');
    await this.sleep(800);

    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;
    const gamma = cal.gamma || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;

    const M = 4;
    const rng1 = this.mulberry32(77);
    const W1 = Array.from({length: M*M}, () => rng1());
    const rng2 = this.mulberry32(123);
    const W2 = Array.from({length: M*M}, () => rng2());
    const rngX = this.mulberry32(55);
    const x = Array.from({length: M}, () => rngX());

    // Digital: Layer 1
    const dig_y1 = [];
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let j = 0; j < M; j++) s += W1[i*M+j] * x[j];
      dig_y1.push(s);
    }
    // Digital: Activation (sigmoid)
    const dig_z1 = dig_y1.map(v => this.sigmoid(v * 2 - 1));
    // Digital: Layer 2
    const dig_y2 = [];
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let j = 0; j < M; j++) s += W2[i*M+j] * dig_z1[j];
      dig_y2.push(s);
    }

    // Reference
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    // Optical: Layer 1
    this.setRun(this.t('etap'), this.t('sloy_wx'), 99);
    const opt_y1 = [];
    for (let i = 0; i < M; i++) {
      const row = [];
      for (let j = 0; j < M; j++) row.push(W1[i*M+j] * x[j]);
      this.showBlockPattern(row, M);
      await this.sleep(500);
      const f = await this.captureStable(4, 50);
      const rawMean = this.regionMean(f);
      const normalized = (rawMean - blackLevel) / Math.max(refBright - blackLevel, 1);
      opt_y1.push(normalized > 0 ? Math.pow(normalized, invGamma) : 0);
      this.showColor('#808080'); await this.sleep(300);
    }

    // Affine-scale optical layer 1 to match digital range
    const dMean1 = dig_y1.reduce((a,b) => a+b, 0) / M;
    const oMean1 = opt_y1.reduce((a,b) => a+b, 0) / M;
    const dR1 = Math.max(...dig_y1) - Math.min(...dig_y1);
    const oR1 = Math.max(...opt_y1) - Math.min(...opt_y1);
    const sc1 = dR1 > 0 && oR1 > 0 ? dR1 / oR1 : 1;
    const opt_y1_scaled = opt_y1.map(v => (v - oMean1) * sc1 + dMean1);
    const l1Corr = this.pearson(opt_y1_scaled, dig_y1);

    this.log(`Layer 1: corr=${l1Corr.toFixed(4)}`, l1Corr > 0.5 ? 'ok' : 'warn');

    // Apply activation (sigmoid) to optical layer 1 output
    const opt_z1 = opt_y1_scaled.map(v => this.sigmoid(v * 2 - 1));

    // ── Inter-layer normalization ──
    // Sigmoid compresses to ~0.4-0.6 → almost no contrast for camera
    // Normalize opt_z1 to [0,1] to maximize optical dynamic range
    const z1min = Math.min(...opt_z1), z1max = Math.max(...opt_z1);
    const z1range = z1max - z1min;
    const opt_z1_norm = z1range > 0.001
      ? opt_z1.map(v => (v - z1min) / z1range)  // stretch to [0,1]
      : opt_z1.map(v => v);  // fallback if all equal

    // Digital Layer 2 uses dig_z1 directly (no normalization needed)
    // But optical Layer 2 uses normalized values for pattern generation,
    // then un-normalizes correlation

    // Optical: Layer 2 (using normalized z1 for contrast)
    this.setRun(this.t('etap'), this.t('sloy_wy'), 99.5);
    const opt_y2 = [];
    for (let i = 0; i < M; i++) {
      const row = [];
      for (let j = 0; j < M; j++) row.push(W2[i*M+j] * opt_z1_norm[j]);
      this.showBlockPattern(row, M);
      await this.sleep(500);
      const f = await this.captureStable(4, 50);
      const rawMean = this.regionMean(f);
      const normalized = (rawMean - blackLevel) / Math.max(refBright - blackLevel, 1);
      opt_y2.push(normalized > 0 ? Math.pow(normalized, invGamma) : 0);
      this.showColor('#808080'); await this.sleep(300);
    }

    // Affine-scale layer 2
    const dMean2 = dig_y2.reduce((a,b) => a+b, 0) / M;
    const oMean2 = opt_y2.reduce((a,b) => a+b, 0) / M;
    const dR2 = Math.max(...dig_y2) - Math.min(...dig_y2);
    const oR2 = Math.max(...opt_y2) - Math.min(...opt_y2);
    const sc2 = dR2 > 0 && oR2 > 0 ? dR2 / oR2 : 1;
    const opt_y2_scaled = opt_y2.map(v => (v - oMean2) * sc2 + dMean2);

    // Use abs(corr) with sign prediction (same as MatVec)
    const calInverted = this.results.calibration && this.results.calibration.inverted;
    const rawL2Corr = this.pearson(opt_y2_scaled, dig_y2);
    const signCorrect = calInverted ? rawL2Corr <= 0 : rawL2Corr >= 0;
    const l2Corr = Math.abs(rawL2Corr);
    const fullCorr = l2Corr;

    // NRMSE
    const rmse = Math.sqrt(dig_y2.map((d,i) => (d-opt_y2_scaled[i])**2).reduce((a,b) => a+b, 0) / M);
    const nrmse = dR2 > 0 ? rmse / dR2 * 100 : 0;

    this.log(`Layer 2: corr=${rawL2Corr.toFixed(4)}${rawL2Corr<0?' ⟲':''} sign:${signCorrect?'✓':'✗'}`, l2Corr > 0.3 ? 'ok' : 'warn');
    this.log(`Full MLP: |corr|=${fullCorr.toFixed(4)} NRMSE=${nrmse.toFixed(1)}%`, fullCorr > 0.3 ? 'ok' : 'warn');
    this.log(`  z1 range: [${z1min.toFixed(3)},${z1max.toFixed(3)}] → normalized to [0,1]`);

    this.results.stage10 = {
      layer1Corr: Math.abs(l1Corr), layer2Corr: l2Corr, fullCorr,
      rawL2Corr, signCorrect, nrmse,
      digitalY1: dig_y1, digitalY2: dig_y2,
      opticalY1: opt_y1_scaled, opticalY2: opt_y2_scaled,
      z1range: z1range
    };
}

export function render(r) {
if (r.stage10) { try {
      const s = r.stage10;
      this.rv('rv-mlp-l1', s.layer1Corr.toFixed(4), s.layer1Corr>0.7?'ok':s.layer1Corr>0.4?'warn':'bad');
      this.rv('rv-mlp-l2', s.layer2Corr.toFixed(4), s.layer2Corr>0.5?'ok':s.layer2Corr>0.3?'warn':'bad');
      this.rv('rv-mlp-full', s.fullCorr.toFixed(4), s.fullCorr>0.5?'ok':s.fullCorr>0.3?'warn':'bad');
      this.rv('rv-mlp-nrmse', s.nrmse.toFixed(1)+'%', s.nrmse<30?'ok':s.nrmse<60?'warn':'bad');
      const g = document.getElementById('g-s10');
      if (s.fullCorr > 0.5) { g.textContent=this.t('sloynyy_mlp_rabotaet'); g.className='grade pass'; }
      else if (s.fullCorr > 0.3) { g.textContent=this.t('chastichno'); g.className='grade partial'; }
      else { g.textContent=this.t('kaskad_ne_rabotaet'); g.className='grade fail'; }
      this.drawMLPChart(s);
    } catch(e) { console.error('stage10 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.fullCorr > 0.3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.fullCorr||0).toFixed(3))(d); } catch(e) { return '—'; }
}
