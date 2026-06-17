// Stage 39: Poiss

export async function run() {
this.setRun(this.t('etap'), this.t('puassonshum'), 101.51);
    this.showColor('#808080');
    await this.sleep(800);

    const nLevels = 10;
    const nSamples = 30;
    const results = [];
    const cal = this.results.calibration || {};
    const dark = (cal.blackMean || 0) / 255;
    const white = (cal.whiteMean || 255) / 255;
    const span = Math.max(white - dark, 1e-4);
    const invGamma = cal.gamma > 0.01 ? 1 / cal.gamma : 1;
    const calibratedMean = (frame) => {
      const raw = this.regionMean(frame) / 255;
      const norm = Math.max(0, Math.min(1, (raw - dark) / span));
      return Math.pow(norm, invGamma) * 255;
    };

    for (let lvl = 0; lvl < nLevels; lvl++) {
      const brightness = Math.round(20 + lvl * 23); // 20 to 227
      const frac = brightness / 255;
      this.setRun(this.t('etap'), this.t('i_shum', {var0: (frac*100).toFixed(0)}), 101.51 + lvl * 0.04);

      this.showColor(`rgb(${brightness},${brightness},${brightness})`);
      await this.sleep(500);

      // Collect N samples of regionMean
      const samples = [];
      for (let s = 0; s < nSamples; s++) {
        const frame = await this.captureStable(1, 30);
        if (frame) {
          samples.push(calibratedMean(frame));
        }
      }

      if (samples.length < 5) continue;

      // Compute mean and variance
      const mu = samples.reduce((a, b) => a + b, 0) / samples.length;
      const variance = samples.reduce((s, v) => s + (v - mu) ** 2, 0) / (samples.length - 1);
      const std = Math.sqrt(variance);

      const spatialVar = variance;

      results.push({
        brightness, frac, mu, variance, std, spatialVar,
        nSamples: samples.length
      });

      this.log(`  I=${brightness}: μ=${mu.toFixed(2)}, σ²_temp=${variance.toFixed(4)}, σ/μ=${(std/Math.max(mu,1e-6)*100).toFixed(2)}%`);
      this.showColor('#808080'); await this.sleep(100);
    }

    // Linear fit: σ²_spatial = a·μ + b
    // Poisson: a ≈ 1, b ≈ 0 (when calibrated to photon counts)
    // We work in camera ADU units, so a = gain factor
    if (results.length >= 3) {
      const mus = results.map(r => r.mu);
      const vars = results.map(r => r.spatialVar);
      const n = mus.length;
      let sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (let i = 0; i < n; i++) {
        sx += mus[i]; sy += vars[i];
        sxy += mus[i] * vars[i]; sx2 += mus[i] * mus[i];
      }
      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
      const intercept = (sy - slope * sx) / n;

      // R² for linearity
      const yMean = sy / n;
      let ssTot = 0, ssRes = 0;
      for (let i = 0; i < n; i++) {
        const yPred = slope * mus[i] + intercept;
        ssTot += (vars[i] - yMean) ** 2;
        ssRes += (vars[i] - yPred) ** 2;
      }
      const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

      // Check for super/sub-Poissonian
      // Fit σ² = α·μ^n (power law)
      const logMu = results.filter(r => r.mu > 1).map(r => Math.log(r.mu));
      const logVar = results.filter(r => r.spatialVar > 0 && r.mu > 1).map(r => Math.log(r.spatialVar));
      let powerExp = 1;
      if (logMu.length >= 3 && logVar.length >= 3) {
        const nn = Math.min(logMu.length, logVar.length);
        let lsx = 0, lsy = 0, lsxy = 0, lsx2 = 0;
        for (let i = 0; i < nn; i++) {
          lsx += logMu[i]; lsy += logVar[i];
          lsxy += logMu[i] * logVar[i]; lsx2 += logMu[i] * logMu[i];
        }
        powerExp = (nn * lsxy - lsx * lsy) / (nn * lsx2 - lsx * lsx);
      }

      const isPoisson = Math.abs(powerExp - 1.0) < 0.3 && r2 > 0.8;
      const isSuperPoisson = powerExp > 1.3;
      const isSubPoisson = powerExp < 0.7 && r2 > 0.8;

      this.log(`σ² = ${slope.toFixed(4)}·μ + ${intercept.toFixed(2)} (R²=${r2.toFixed(3)})`);
      this.log(this.t('puasson_n', {var0: powerExp.toFixed(2)}));
      this.log(this.t('n_puasson_wkvanty_n_sverkhpuas'));

      if (isSubPoisson) {
        this.log(this.t('subpuasson_szhatyy_svet_publik'), 'ok');
      } else if (isSuperPoisson) {
        this.log(this.t('sverkhpuasson_n_klassicheskiy_', {var0: powerExp.toFixed(2)}), 'warn');
      } else if (isPoisson) {
        this.log(this.t('puasson_podtverzhdyon_n_sovmes', {var0: powerExp.toFixed(2)}), 'ok');
      } else {
        this.log(this.t('neopredelyonno_n_r', {var0: powerExp.toFixed(2), var1: r2.toFixed(3)}), 'warn');
      }

      this.results.stage39 = {
        results, slope, intercept, r2,
        powerExp, isPoisson, isSuperPoisson, isSubPoisson
      };
    }
}

export function render(r) {
if (r.stage39) { try {
      const s = r.stage39;
      this.rv('rv-pois-n', (s.powerExp||0).toFixed(2), s.r2>0.5?'ok':'warn');
      this.rv('rv-pois-r2', (s.r2||0).toFixed(3), s.r2>0.5?'ok':'warn');
      const g = document.getElementById('g-s39');
      if (s.r2>0.5) { g.textContent=this.t('puasson_podtverzhdyon'); g.className='grade pass'; }
      else { g.textContent=this.t('net_sootvetstviya'); g.className='grade fail'; }
    } catch(e) { console.error('stage39 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.r2 > 0.5)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'R²=' + (d.r2||0).toFixed(3))(d); } catch(e) { return '—'; }
}
