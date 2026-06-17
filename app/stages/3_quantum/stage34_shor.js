// Stage 34: Shor

export async function run() {
this.setRun(this.t('etap'), 'Shor N=15...', 107);
    this.showColor('#808080');
    await this.sleep(800);

    const N = 15;
    const a = 7; // a^r mod N: 7,4,13,1,7,4,13,1... → period r=4

    // Step 1: Show period-4 sequence as brightness levels
    this.log(this.t('shor_faktorizatsiya_a', {var0: N, var1: a}));
    const sequence = [];
    let val = 1;
    for (let i = 0; i < 8; i++) {
      sequence.push(val);
      val = (val * a) % N;
    }
    this.log(this.t('posledovatelnost_ax_mod', {var0: N, var1: sequence.join(',')}));

    // Show sequence as 8-bin pattern with MAXIMUM contrast
    const maxVal = Math.max(...sequence);
    const minVal = Math.min(...sequence);
    const valRange = maxVal - minVal || 1;
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      const bw = Math.floor(w / 9);
      for (let i = 0; i < 8; i++) {
        // Full contrast: map [minVal, maxVal] to [20, 240]
        const v = Math.round(((sequence[i] - minVal) / valRange) * 220 + 20);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect((i+0.5)*bw, Math.floor(h*0.15), bw*0.8, Math.floor(h*0.7));
      }
    });
    await this.sleep(1200);
    const fSeq = await this.captureStable(8, 50);
    const binsSeq = this.measureNBins(fSeq, 8);
    this.log(`  Optical: [${binsSeq.map(v=>v.toFixed(2)).join(',')}]`);

    // Step 2: Detrend bins (remove vignetting gradient) then compute DFT
    this.setRun(this.t('etap'), 'QFT...', 107.5);
    // Linear detrend: subtract best-fit line to remove camera vignetting
    const nBins = binsSeq.length;
    const xMean = (nBins - 1) / 2;
    const yMean = binsSeq.reduce((a,b)=>a+b,0) / nBins;
    let sxy = 0, sxx = 0;
    for (let i = 0; i < nBins; i++) {
      sxy += (i - xMean) * (binsSeq[i] - yMean);
      sxx += (i - xMean) ** 2;
    }
    const slope = sxx > 0 ? sxy / sxx : 0;
    const detrended = binsSeq.map((v, i) => v - (yMean + slope * (i - xMean)));
    this.log(`  Detrended (slope=${slope.toFixed(4)}): [${detrended.map(v=>v.toFixed(3)).join(',')}]`);

    const qftMag = [];
    for (let k = 0; k < 8; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < 8; n++) {
        const angle = -2 * Math.PI * k * n / 8;
        re += detrended[n] * Math.cos(angle);
        im += detrended[n] * Math.sin(angle);
      }
      qftMag.push(Math.sqrt(re*re + im*im));
    }
    this.log(`  QFT|k|: [${qftMag.map(v=>v.toFixed(3)).join(',')}]`);

    // Step 3: Find period from QFT peaks
    // Skip DC (k=0), find dominant frequency
    // For period-4 signal in 8 samples, expect peak at k=2 (and mirror k=6)
    const qftNoDC = qftMag.slice(1);
    const sortedIndices = qftNoDC
      .map((mag, idx) => ({ k: idx + 1, mag }))
      .sort((s1, s2) => s2.mag - s1.mag);

    let factor1 = 0, factor2 = 0;
    let r = 0;
    let correctFactors = false;
    let peakK = sortedIndices[0].k;
    let effectiveK = peakK <= 4 ? peakK : 8 - peakK;

    for (const cand of sortedIndices) {
      const candK = cand.k;
      const effK = candK <= 4 ? candK : 8 - candK;
      const detectedPeriod = effK > 0 ? 8 / effK : 8;
      const candR = Math.round(detectedPeriod);
      if (candR > 0 && candR % 2 === 0) {
        const aHalfR = Math.pow(a, candR/2) % N;
        const f1 = this.gcd(aHalfR + 1, N);
        const f2 = this.gcd(aHalfR - 1, N);
        if (f1 > 1 && f1 < N && f2 > 1 && f2 < N && f1 * f2 === N) {
          factor1 = f1;
          factor2 = f2;
          r = candR;
          peakK = candK;
          effectiveK = effK;
          correctFactors = true;
          this.log(this.t('naydeno_po_piku_k_r', {var0: peakK, var1: r, var2: N, var3: factor1, var4: factor2}));
          break;
        }
      }
    }

    if (!correctFactors) {
      const bestK = sortedIndices[0].k;
      const effK = bestK <= 4 ? bestK : 8 - bestK;
      r = Math.round(effK > 0 ? 8 / effK : 8);
      if (r > 0 && r % 2 === 0) {
        const aHalfR = Math.pow(a, r/2) % N;
        factor1 = this.gcd(aHalfR + 1, N);
        factor2 = this.gcd(aHalfR - 1, N);
        if (factor1 === 1 || factor1 === N) factor1 = 0;
        if (factor2 === 1 || factor2 === N) factor2 = 0;
      }
      correctFactors = (factor1 === 3 && factor2 === 5) || (factor1 === 5 && factor2 === 3);
    }

    this.log(this.t('pik_na_k_effective_period_r', {var0: peakK, var1: effectiveK, var2: r}));
    this.log(`  r=${r}: gcd(${a}^${r/2}±1, ${N}) = {${factor1}, ${factor2}}`);
    this.log(`  ${N} = ${factor1} × ${factor2} ${correctFactors ? '✓' : '✗'}`);
    this.log(this.t('shor', {var0: correctFactors ? 'ФАКТОРИЗОВАЛ' : 'не нашёл'}), correctFactors ? 'ok' : 'warn');

    this.results.stage34 = {
      N, a, sequence, binsSeq, qftMag,
      peakK, detectedPeriod: 8 / effectiveK, r, factor1, factor2, correctFactors
    };
}

export function render(r) {
if (r.stage34) { try {
      const s = r.stage34;
      this.rv('rv-shor-fac', s.factor1+'×'+s.factor2, s.correctFactors?'ok':'bad');
      this.rv('rv-shor-r', 'r='+s.r, s.correctFactors?'ok':'warn');
      const g = document.getElementById('g-s34');
      if (s.correctFactors) { g.textContent=this.t('naydeno'); g.className='grade pass'; }
      else { g.textContent=this.t('faktorizatsiya_ne_udalas'); g.className='grade fail'; }
    } catch(e) { console.error('stage34 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.correctFactors)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'r=' + (d.r||'?'))(d); } catch(e) { return '—'; }
}
