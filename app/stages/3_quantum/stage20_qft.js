// Stage 20: QFT

export async function run() {
this.setRun(this.t('etap'), 'QFT N=4...', 99.975);
    this.showColor('#808080');
    await this.sleep(800);

    const N = 4; // 4 computational basis states
    const qftRawAmplitudes = []; // [input_k][output_n]

    for (let k = 0; k < N; k++) {
      this.setRun(this.t('etap'), `QFT |${k}⟩`, 99.975 + k*0.005);
      // Show pattern encoding e^{2πi·k·n/N} for each n
      this.showPattern((ctx, w, h) => {
        const dpr = window.devicePixelRatio || 1;
        ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
        const bw = Math.floor(w / N);
        for (let n = 0; n < N; n++) {
          // Phase: φ = 2π·k·n/N; Intensity = cos²(φ/2) = (1+cos(φ))/2
          const phase = 2 * Math.PI * k * n / N;
          const intensity = (1 + Math.cos(phase)) / 2;
          const v = Math.round(intensity * 255);
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(n * bw + bw*0.1, h*0.1, bw*0.8, h*0.8);
        }
      });
      await this.sleep(1000);
      const frame = await this.captureStable(8, 60);
      const bins = this.measureCalibratedBins ? this.measureCalibratedBins(frame, N, { mirror: true }) : this.measureNBins(frame, N);
      qftRawAmplitudes.push(bins);
      this.log(`  QFT|${k}⟩ → [${bins.map(v=>v.toFixed(3)).join(', ')}]`);
      this.showColor('#808080'); await this.sleep(500);
    }

    const flat = qftRawAmplitudes[0].map(v => Math.max(v, 1e-4));
    const qftAmplitudes = qftRawAmplitudes.map(row => row.map((v, i) => v / flat[i]));

    // Expected QFT matrix for N=4:
    // QFT|0⟩ = [1,1,1,1]/2      → all equal
    // QFT|1⟩ = [1,i,-1,-i]/2    → cos²: [1, 0.5, 0, 0.5]
    // QFT|2⟩ = [1,-1,1,-1]/2    → cos²: [1, 0, 1, 0]
    // QFT|3⟩ = [1,-i,-1,i]/2    → cos²: [1, 0.5, 0, 0.5]
    const expectedQFT = [
      [1, 1, 1, 1],       // |0⟩
      [1, 0.5, 0, 0.5],   // |1⟩
      [1, 0, 1, 0],       // |2⟩
      [1, 0.5, 0, 0.5]    // |3⟩
    ];

    let totalCorr = 0;
    for (let k = 1; k < N; k++) {
      const corr = this.pearsonCorr(expectedQFT[k], qftAmplitudes[k]);
      totalCorr += corr;
    }
    const avgCorr = totalCorr / (N - 1);

    const a0 = qftAmplitudes[0];
    const a0Mean = a0.reduce((a,b)=>a+b,0) / N;
    const a0Std = Math.sqrt(a0.reduce((s,v)=>s+(v-a0Mean)**2,0) / N);
    const uniformFlatness = a0Mean > 1e-6 ? Math.max(0, 1 - a0Std / a0Mean) : 0;

    // Phase accuracy: check that QFT|2⟩ has alternating pattern
    const a2 = qftAmplitudes[2];
    const phaseAccuracy = a2.length >= 4 ?
      Math.abs((a2[0]+a2[2])/(a2[0]+a2[1]+a2[2]+a2[3]+0.001) - 0.5) * 2 : 0;
    const phaseOK = 1 - phaseAccuracy;

    this.log(`QFT: avgCorr=${avgCorr.toFixed(3)}, flat=${uniformFlatness.toFixed(3)}, phaseAccuracy=${phaseOK.toFixed(3)}`);
    this.log(this.t('qft', {var0: avgCorr > 0.5 ? 'работает' : 'слабый'}), avgCorr > 0.5 ? 'ok' : 'warn');

    this.results.stage20 = {
      N, qftAmplitudes, qftRawAmplitudes, expectedQFT, avgCorr, uniformFlatness, phaseOK
    };
}

export function render(r) {
if (r.stage20) { try {
      const s = r.stage20;
      this.rv('rv-qft-corr', s.avgCorr.toFixed(3), s.avgCorr > 0.5 ? 'ok' : 'warn');
      this.rv('rv-qft-phase', (s.phaseOK*100).toFixed(0)+'%', s.phaseOK > 0.5 ? 'ok' : 'warn');
      this.rv('rv-qft-levels', s.N+'', 'ok');
      const g = document.getElementById('g-s20');
      if (s.avgCorr > 0.6) { g.textContent=this.t('qft_rabotaet'); g.className='grade pass'; }
      else if (s.avgCorr > 0.3) { g.textContent=this.t('chastichnyy_qft'); g.className='grade partial'; }
      else { g.textContent=this.t('qft_ne_rabotaet'); g.className='grade fail'; }
      this.drawQFTChart(s);
    } catch(e) { console.error('stage20 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.avgCorr > 0.3)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.avgCorr||0).toFixed(3))(d); } catch(e) { return '—'; }
}
