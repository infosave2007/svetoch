// Stage 9: Drop

export async function run() {
this.setRun(this.t('etap'), 'Dropout...', 98);
    this.showColor('#808080');
    await this.sleep(800);

    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;
    const gamma = cal.gamma || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;

    // Use same MatVec setup as Stage 3
    const M = 4;
    const rng = this.mulberry32(99);
    const W = Array.from({length: M*M}, () => rng());
    const x = Array.from({length: M}, () => rng());

    // Digital reference (full)
    const digitalY = [];
    for (let i = 0; i < M; i++) {
      let s = 0;
      for (let j = 0; j < M; j++) s += W[i*M+j] * x[j];
      digitalY.push(s);
    }

    // Reference white
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    // Test dropout at different rates
    const dropRates = [0.1, 0.2, 0.3];
    const correlations = [];

    for (let di = 0; di < dropRates.length; di++) {
      const dropRate = dropRates[di];
      this.setRun(this.t('etap'), `Dropout ${Math.round(dropRate*100)}%...`, 98 + di * 0.3);

      // Create dropped W
      const dropRng = this.mulberry32(42 + di * 17);
      const W_dropped = W.map(w => dropRng() < dropRate ? 0 : w);

      // Compute digital result with dropout
      const digDropped = [];
      for (let i = 0; i < M; i++) {
        let s = 0;
        for (let j = 0; j < M; j++) s += W_dropped[i*M+j] * x[j];
        digDropped.push(s);
      }

      // Optical: show dropped pattern
      const opticalY = [];
      for (let i = 0; i < M; i++) {
        const row = [];
        for (let j = 0; j < M; j++) row.push(W_dropped[i*M+j] * x[j]);
        this.showBlockPattern(row, M);
        await this.sleep(500);
        const f = await this.captureStable(4, 50);
        const rawMean = this.regionMean(f);
        const normalized = (rawMean - blackLevel) / Math.max(refBright - blackLevel, 1);
        const corrected = normalized > 0 ? Math.pow(normalized, invGamma) : 0;
        opticalY.push(corrected);
        this.showColor('#808080'); await this.sleep(300);
      }

      // Correlation of dropped optical with full digital (use predicted sign)
      const rawCorr = this.pearson(opticalY, digitalY);
      const calInverted = this.results.calibration && this.results.calibration.inverted;
      const signCorrect = calInverted ? rawCorr <= 0 : rawCorr >= 0;
      correlations.push(Math.abs(rawCorr));
      this.log(`Dropout ${Math.round(dropRate*100)}%: corr=${rawCorr.toFixed(4)}${rawCorr<0?' ⟲':''} sign:${signCorrect?'✓':'✗'}`,
               Math.abs(rawCorr) > 0.5 && signCorrect ? 'ok' : 'warn');
    }

    this.results.stage9 = {
      dropRates, correlations, digitalY
    };
}

export function render(r) {
if (r.stage9) { try {
      const s = r.stage9;
      this.rv('rv-drop10', s.correlations[0].toFixed(4), s.correlations[0]>0.5?'ok':s.correlations[0]>0.3?'warn':'bad');
      this.rv('rv-drop20', s.correlations[1].toFixed(4), s.correlations[1]>0.4?'ok':s.correlations[1]>0.2?'warn':'bad');
      this.rv('rv-drop30', s.correlations[2].toFixed(4), s.correlations[2]>0.3?'ok':s.correlations[2]>0.1?'warn':'bad');
      const g = document.getElementById('g-s9');
      if (s.correlations[0] > 0.5) { g.textContent=this.t('ustoychiv_k_dropout'); g.className='grade pass'; }
      else if (s.correlations[0] > 0.3) { g.textContent=this.t('chastichno_ustoychiv'); g.className='grade partial'; }
      else { g.textContent=this.t('neustoychiv_k_shumu'); g.className='grade fail'; }
      this.drawDropChart(s);
    } catch(e) { console.error('stage9 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.correlations && d.correlations[0] > 0.3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.correlations?.[0]||0).toFixed(3))(d); } catch(e) { return '—'; }
}
