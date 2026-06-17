// Stage 14: PE

export async function run() {
this.setRun(this.t('etap'), 'Positional Encoding...', 99.8);
    this.showColor('#808080');
    await this.sleep(800);

    // Show sinusoidal patterns at different frequencies for different positions
    // PE(pos, k) = sin(pos * ω_k) where ω_k varies with frequency index
    const nPositions = 4;
    const nFreqs = 6;
    const peVectors = []; // [pos][freq] = contrast

    for (let pos = 0; pos < nPositions; pos++) {
      this.setRun(this.t('etap'), this.t('pozitsiya', {var0: pos+1, var1: nPositions}), 99.8 + pos*0.04);
      const contrasts = [];
      for (let k = 0; k < nFreqs; k++) {
        const freq = 4 + k * 4; // stripe widths: 4,8,12,16,20,24 px
        // Each position uses a DIFFERENT base frequency multiplier
        // pos=0: 1x, pos=1: 1.5x, pos=2: 2x, pos=3: 3x
        const posFreqMult = [1, 1.5, 2, 3][pos];
        const effectiveFreq = freq * posFreqMult;
        // Also add position-specific phase
        const phase = pos * Math.PI / 2;
        this.showPattern((ctx, w, h) => {
          const dpr = window.devicePixelRatio || 1;
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          for (let x = 0; x < w; x++) {
            const v = Math.round(127 + 127 * Math.sin(2 * Math.PI * x / (effectiveFreq * dpr) + phase));
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.fillRect(x, 0, 1, h);
          }
        });
        await this.sleep(600);
        const frame = await this.captureStable(6, 40);
        const bins = this.measureNBins(frame, 4);
        const bMin = Math.min(...bins);
        const bMax = Math.max(...bins);
        const bRange = bMax - bMin;
        for (let i = 0; i < 4; i++) {
          const val = bRange > 1e-4 ? (bins[i] - bMin) / bRange : 0;
          contrasts.push(val);
        }
      }
      peVectors.push(contrasts);
      this.log(`  Pos ${pos}: [${contrasts.map(c=>c.toFixed(4)).join(', ')}]`);
      this.showColor('#808080');
      await this.sleep(400);
    }

    // Compute cos-similarity between all position pairs
    let totalCosSim = 0, nPairs = 0;
    const cosSims = [];
    for (let i = 0; i < nPositions; i++) {
      for (let j = i+1; j < nPositions; j++) {
        const cs = this.cosineSimilarity(peVectors[i], peVectors[j]);
        cosSims.push({ i, j, cs });
        totalCosSim += Math.abs(cs);
        nPairs++;
      }
    }
    const avgCosSim = nPairs > 0 ? totalCosSim / nPairs : 1;

    // Distinguishability: are positions separable?
    let distinguishable = 0;
    for (const pair of cosSims) {
      if (Math.abs(pair.cs) < 0.8) distinguishable++;
    }
    const distinguishability = distinguishable / Math.max(1, cosSims.length);

    this.log(`PE: avgCosSim=${avgCosSim.toFixed(3)}, distinguishable=${distinguishable}/${cosSims.length}`);
    this.log(this.t('pe', {var0: avgCosSim < 0.5 ? 'ортогональны' : 'перекрываются'}), avgCosSim < 0.5 ? 'ok' : 'warn');

    this.results.stage14 = {
      peVectors, cosSims, avgCosSim, distinguishability,
      nPositions, nFreqs
    };
}

export function render(r) {
if (r.stage14) { try {
      const s = r.stage14;
      this.rv('rv-pe-orth', s.avgCosSim < 0.5 ? this.t('da') : this.t('net'), s.avgCosSim < 0.5 ? 'ok' : 'warn');
      this.rv('rv-pe-dist', (s.distinguishability*100).toFixed(0)+'%', s.distinguishability > 0.5 ? 'ok' : 'warn');
      this.rv('rv-pe-cos', s.avgCosSim.toFixed(3), s.avgCosSim < 0.5 ? 'ok' : s.avgCosSim < 0.8 ? 'warn' : 'bad');
      const g = document.getElementById('g-s14');
      if (s.avgCosSim < 0.5) {
        g.textContent=this.t('pozitsii_ortogonalny'); g.className='grade pass';
      } else if (s.distinguishability > 0.3) {
        g.textContent=this.t('chastichnaya_razlichimost'); g.className='grade partial';
      } else { g.textContent=this.t('pozitsii_nerazlichimy'); g.className='grade fail'; }
      this.drawPEChart(s);
    } catch(e) { console.error('stage14 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.distinguishability > 0.3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'dist=' + (d.distinguishability||0).toFixed(3))(d); } catch(e) { return '—'; }
}
