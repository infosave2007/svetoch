// Stage 52: Grov8

export async function run() {
this.setRun(this.t('etap'), 'Grover N=8→16→32→64...', 112.0);
    this.showColor('#808080');
    await this.sleep(600);

    const cal = this.results.calibration || {};
    const screenW = (cal.x1 || 1050) - (cal.x0 || 0);

    const sizes = [8, 16, 32, 64];
    const allResults = [];
    let maxN = 0;

    for (const N of sizes) {
      const pxPerBin = Math.floor(screenW / N);
      if (pxPerBin < 10) {
        this.log(this.t('n_propusk_pxbin', {var0: N, var1: pxPerBin}));
        allResults.push({ N, skipped: true, pxPerBin });
        continue;
      }

      const target = Math.floor(Math.random() * N);
      const nIter = Math.round(Math.PI / 4 * Math.sqrt(N));

      this.setRun(this.t('etap'), `Grover N=${N}: target=${target}...`, 112.0 + sizes.indexOf(N) * 0.2);

      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      });
      await this.sleep(250);
      const flatFrame = await this.captureStable(4, 40);
      const flatBins = this.measureCalibratedBins ? this.measureCalibratedBins(flatFrame, N, { mirror: true }) : this.measureNBins(flatFrame, N);

      // Simulate Grover
      let amplitudes = new Float64Array(N).fill(1 / Math.sqrt(N));
      for (let iter = 0; iter < nIter; iter++) {
        amplitudes[target] = -amplitudes[target];
        const mean = amplitudes.reduce((a, b) => a + b, 0) / N;
        for (let i = 0; i < N; i++) amplitudes[i] = 2 * mean - amplitudes[i];
      }

      // Display final probability distribution
      this.showPattern((ctx, w, h) => {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
        const bw = Math.floor(w / N);
        for (let i = 0; i < N; i++) {
          const prob = amplitudes[i] * amplitudes[i];
          const v = Math.round(Math.min(prob * N * 255, 255));
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(i * bw, 0, bw, h);
        }
      });
      await this.sleep(600);
      const frame = await this.captureStable(8, 50);
      const rawBins = this.measureCalibratedBins ? this.measureCalibratedBins(frame, N, { mirror: true }) : this.measureNBins(frame, N);
      const bins = rawBins.map((v, i) => v / Math.max(flatBins[i] || 1, 1e-4));

      const maxBin = bins.indexOf(Math.max(...bins));
      const meanBright = bins.reduce((a, b) => a + b, 0) / N;
      const amplification = bins[maxBin] / Math.max(meanBright, 1e-6);
      const targetProb = amplitudes[target] * amplitudes[target];
      const expectedBin = target;
      const neighbors = [expectedBin - 1, expectedBin, expectedBin + 1].filter(i => i >= 0 && i < N);
      const targetWindow = Math.max(...neighbors.map(i => bins[i]));
      const found = neighbors.includes(maxBin) && targetWindow / Math.max(meanBright, 1e-6) > 1.25;

      this.log(`  N=${N}: target=${target}, expectedBin=${expectedBin}, maxBin=${maxBin}, amp=${amplification.toFixed(1)}×, targetWin=${(targetWindow/Math.max(meanBright,1e-6)).toFixed(1)}×, ${pxPerBin}px/bin ${found ? '✓' : '✗'}`);

      if (found) maxN = N;
      allResults.push({ N, target, expectedBin, maxBin, found, nIter, pxPerBin,
        targetProb: Number(targetProb.toFixed(4)),
        amplification: Number(amplification.toFixed(2)),
        targetWindowAmp: Number((targetWindow / Math.max(meanBright, 1e-6)).toFixed(2)),
        rawBins, flatBins, bins
      });

      this.showColor('#808080'); await this.sleep(200);
    }

    // Summary
    this.log(this.t('grover_progressivnyy'));
    for (const r of allResults) {
      if (r.skipped) this.log(this.t('n_propushcheno', {var0: r.N}));
      else this.log(`  N=${r.N}: ${r.found ? '✓' : '✗'} (amp=${r.amplification}×, ${r.pxPerBin}px/bin)`);
    }
    const pass = maxN >= 8;
    this.log(this.t('grover_maksimum_n', {var0: maxN}), pass ? 'ok' : 'warn');
    this.showColor('#000000');
    this.results.stage52 = {
      maxN, results: allResults,
      pass
    };
}

export function render(r) {
if (r.stage52) { try {
      const s = r.stage52;
      const maxAmp = Math.max(...(s.results || []).filter(r => !r.skipped).map(r => r.amplification || 0), 0);
      this.rv('rv-grov8-amp', maxAmp.toFixed(2) + '×', s.pass ? 'ok' : 'warn');
      this.rv('rv-grov8-iter', s.nIter, 'ok');
      const g = document.getElementById('g-s52');
      if (s.pass) { g.textContent=this.t('grover_maks_n', {var0: s.maxN}); g.className='grade pass'; }
      else { g.textContent=this.t('grover_chastichno'); g.className='grade partial'; }
    } catch(e) { console.error('stage52 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.pass)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'amp=' + Math.max(...(d.results || []).filter(r => !r.skipped).map(r => r.amplification || 0), 0).toFixed(2) + '×')(d); } catch(e) { return '—'; }
}
