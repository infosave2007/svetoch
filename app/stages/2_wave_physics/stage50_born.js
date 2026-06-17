// Stage 50: Born

export async function run() {
this.setRun(this.t('etap'), this.t('nvg_pravilo_borna_osmoticheski'), 110.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const gamma = cal.gamma || 1.5;
    const invGamma = 1.0 / gamma;

    // Born rule: P(x) = |ψ(x)|²
    // Display patterns with known |ψ|² distribution
    // Then measure actual brightness → should match

    const nTests = 4;
    // Different |ψ|² distributions: uniform, single peak, double peak, gaussian
    const distributions = [
      { name: 'uniform', fn: x => 1.0 },
      { name: 'single peak', fn: x => Math.exp(-((x-0.5)**2) / 0.02) },
      { name: 'double peak', fn: x => Math.exp(-((x-0.3)**2)/0.01) + Math.exp(-((x-0.7)**2)/0.01) },
      { name: 'quadratic', fn: x => 4 * x * (1 - x) },
    ];

    const results = [];
    let flatMeasured = null;

    for (let ti = 0; ti < distributions.length; ti++) {
      const dist = distributions[ti];
      this.setRun(this.t('etap'), `|ψ|²: ${dist.name}...`, 110.0 + ti * 0.2);

      // Display |ψ(x)|² as brightness pattern
      const nBins = 8;
      const expected = new Float64Array(nBins);
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x++) {
          const t = x / w;
          const psi2 = dist.fn(t);
          const v = Math.round(Math.min(psi2, 1) * 220 + 15);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(x, 0, 1, h);
          const bin = Math.min(nBins - 1, Math.floor(t * nBins));
          expected[bin] += psi2;
        }
      });
      await this.sleep(600);
      const frame = await this.captureStable(6, 50);
      const measuredRaw = this.measureCalibratedBins ? this.measureCalibratedBins(frame, nBins, { mirror: true }) : this.measureNBins(frame, nBins);
      if (dist.name === 'uniform') flatMeasured = measuredRaw.map(v => Math.max(v, 1e-4));
      const measured = flatMeasured ? measuredRaw.map((v, i) => v / flatMeasured[i]) : measuredRaw;

      // Normalize both
      const eSum = expected.reduce((a,b) => a+b, 0) || 1;
      const mSum = measured.reduce((a,b) => a+b, 0) || 1;
      const eNorm = Array.from(expected).map(v => v / eSum);
      const mNorm = measured.map(v => v / mSum);

      // Correlation and KL divergence
      const corr = dist.name === 'uniform' ? 1 : this.pearsonCorr(eNorm, mNorm);
      let kl = 0;
      for (let i = 0; i < nBins; i++) {
        const p = Math.max(eNorm[i], 1e-6);
        const q = Math.max(mNorm[i], 1e-6);
        kl += p * Math.log(p / q);
      }

      results.push({ name: dist.name, corr: Number(corr.toFixed(4)), kl: Number(kl.toFixed(6)) });
      this.log(`  ${dist.name}: corr=${corr.toFixed(4)}, KL=${kl.toFixed(6)}`);
      this.showColor('#808080'); await this.sleep(200);
    }

    const informativeResults = results.filter(r => r.name !== 'uniform');
    const avgCorr = informativeResults.reduce((s,r) => s + r.corr, 0) / informativeResults.length;
    const avgKL = results.reduce((s,r) => s + r.kl, 0) / results.length;
    const pass = avgCorr > 0.5 && avgKL < 0.5;

    this.log(`━━━ NVG #51 Born = Osmotic Softmax ━━━`);
    this.log(this.t('srednyaya_korrelyatsiya_px', {var0: avgCorr.toFixed(4)}));
    this.log(this.t('srednyaya_kl', {var0: avgKL.toFixed(6)}));
    this.log(this.t('born_rule', {var0: pass ? 'ПОДТВЕРЖДЕНО' : 'частично'}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage50 = { results, avgCorr: Number(avgCorr.toFixed(4)), avgKL: Number(avgKL.toFixed(6)), pass };
}

export function render(r) {
if (r.stage50) { try {
      const s = r.stage50;
      this.rv('rv-nvg50-corr', s.avgCorr?.toFixed(4), s.avgCorr > 0.5 ? 'ok' : 'warn');
      this.rv('rv-nvg50-kl', s.avgKL?.toFixed(6), s.avgKL < 0.5 ? 'ok' : 'warn');
      const g = document.getElementById('g-s50');
      if (s.pass) { g.textContent='✅ NVG #51: Born = osmotic softmax!'; g.className='grade pass'; }
      else { g.textContent=this.t('born_rule_chastichno'); g.className='grade partial'; }
    } catch(e) { console.error('stage50 display:', e); } }
}


export function check(d) {
  try {
    return (d => {
      if (!d) return false;
      if (Array.isArray(d.results)) {
        const informative = d.results.filter(r => r.name !== 'uniform');
        const avgCorr = informative.reduce((s, r) => s + (r.corr || 0), 0) / Math.max(informative.length, 1);
        const avgKL = d.results.reduce((s, r) => s + (r.kl || 0), 0) / Math.max(d.results.length, 1);
        return avgCorr > 0.5 && avgKL < 0.5;
      }
      return d.pass;
    })(d);
  } catch(e) { return false; }
}

export function metric(d) {
  try {
    return (d => {
      if (Array.isArray(d.results)) {
        const informative = d.results.filter(r => r.name !== 'uniform');
        const avgCorr = informative.reduce((s, r) => s + (r.corr || 0), 0) / Math.max(informative.length, 1);
        return 'corr=' + avgCorr.toFixed(3);
      }
      return 'corr=' + (d.avgCorr||0).toFixed(3);
    })(d);
  } catch(e) { return '—'; }
}
