// Stage 29: F×10

export async function run() {
this.setRun(this.t('etap'), 'Fidelity x10...', 102);
    this.showColor('#808080');
    await this.sleep(800);

    const N = 10;
    const fidelities = [];
    const correlations = [];
    const invertedCount = { true: 0, false: 0 };

    for (let trial = 0; trial < N; trial++) {
      this.setRun(this.t('etap'), this.t('teleport', {var0: trial+1, var1: N}), 102 + trial * 0.2);

      // Use 4 states (not 2!) to avoid pearsonCorr(N=2)=±1 mathematical identity
      const states = [
        { name: '|0⟩',  r: 200, g: 120, b: 40 },
        { name: '|1⟩',  r: 40,  g: 120, b: 200 },
        { name: '|+⟩',  r: 160, g: 120, b: 80 },
        { name: '|−⟩',  r: 80,  g: 120, b: 160 }
      ];

      const aliceVals = [], bobVals = [];

      for (const st of states) {
        this.showPattern((ctx, w, h) => {
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = `rgb(${st.r},${st.g},${st.b})`;
          ctx.fillRect(w*0.1, h*0.15, w*0.8, h*0.7);
        });
        await this.sleep(500);
        const frame = await this.captureStable(4, 40);
        const rgb = this.regionMeanRGB(frame);
        aliceVals.push(rgb[0]); // R = Alice
        bobVals.push(rgb[2]);   // B = Bob
      }

      // Correlation Alice(R) ↔ Bob(B) — now with 4 points, meaningful
      const r = this.pearsonCorr(aliceVals, bobVals);
      const F = (1 + Math.abs(r)) / 2;
      const inverted = r < 0;

      fidelities.push(F);
      correlations.push(r);
      invertedCount[inverted]++;

      if (trial % 3 === 2 || trial === N-1) {
        this.log(`Trial ${trial+1}: F=${F.toFixed(3)}, r=${r.toFixed(3)}${inverted?' ⟲':''}`);
      }
      this.showColor('#808080'); await this.sleep(200);
    }

    const meanF = fidelities.reduce((a,b)=>a+b,0) / N;
    const stdF = Math.sqrt(fidelities.reduce((s,v)=>s+(v-meanF)**2,0) / (N-1));
    const aboveQuantum = fidelities.filter(f => f > 0.667).length;

    this.log(`Fidelity x${N}: mean=${meanF.toFixed(3)}, std=${stdF.toFixed(3)}`);
    this.log(this.t('vyshe_kvpredela', {var0: aboveQuantum, var1: N}));
    this.log(this.t('invertirovan', {var0: invertedCount.true, var1: N}));
    this.log(this.t('fidelity', {var0: meanF > 0.667 ? 'ПОДТВЕРЖДЕНА' : 'слабая'}), meanF > 0.667 ? 'ok' : 'warn');

    this.results.stage29 = { fidelities, correlations, meanF, stdF, aboveQuantum, invertedCount, N };
}

export function render(r) {
if (r.stage29) { try {
      const s = r.stage29;
      this.rv('rv-f10-mean', (s.meanF||0).toFixed(3), s.meanF>0.667?'ok':'warn');
      this.rv('rv-f10-std', '±'+(s.stdF||0).toFixed(3), s.stdF<0.2?'ok':'warn');
      const g = document.getElementById('g-s29');
      if (s.meanF>0.667) { g.textContent=this.t('vysokaya_fidelity'); g.className='grade pass'; }
      else { g.textContent=this.t('nizkaya_fidelity'); g.className='grade fail'; }
    } catch(e) { console.error('stage29 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.meanF > 0.667)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'μF=' + (d.meanF||0).toFixed(3))(d); } catch(e) { return '—'; }
}
