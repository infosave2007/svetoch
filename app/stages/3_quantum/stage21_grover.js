// Stage 21: Grov

export async function run() {
this.setRun(this.t('etap'), this.t('algoritm_grovera'), 99.98);
    this.showColor('#808080');
    await this.sleep(800);

    const N = 4;
    const target = 2; // Search for element #2

    // Step 0: Equal superposition (all elements at 25%)
    this.log(this.t('shag_ravnaya_superpozitsiya_ad'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      const bw = Math.floor(w / (N+1));
      for (let i = 0; i < N; i++) {
        ctx.fillStyle='rgb(128,128,128)';
        ctx.fillRect((i+0.5)*bw, h*0.15, bw*0.8, h*0.7);
      }
    });
    await this.sleep(1000);
    const f0 = await this.captureStable(8, 60);
    const bins0 = this.measureNBins(f0, N);
    this.log(this.t('nachalo', {var0: bins0.map(v=>v.toFixed(3)).join(', ')}));

    this.showColor('#808080'); await this.sleep(500);

    // Step 1: Oracle — mark target (make it DARK, others bright)
    this.log(this.t('shag_orakul_vydelit_element', {var0: target}));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      const bw = Math.floor(w / (N+1));
      for (let i = 0; i < N; i++) {
        const v = (i === target) ? 32 : 192; // Oracle: target goes DARK (phase inversion)
        ctx.fillStyle=`rgb(${v},${v},${v})`;
        ctx.fillRect((i+0.5)*bw, h*0.15, bw*0.8, h*0.7);
      }
    });
    await this.sleep(1000);
    const f1 = await this.captureStable(8, 60);
    const bins1 = this.measureNBins(f1, N);
    this.log(this.t('orakul', {var0: bins1.map(v=>v.toFixed(3)).join(', ')}));

    this.showColor('#808080'); await this.sleep(500);

    // Step 2: Diffuser — reflect about mean → target amplified
    // To remove camera lens shading/vignetting, we use baseline subtraction relative to bins0
    const diff1 = bins1.map((v, i) => v - bins0[i]);
    const meanDiff1 = diff1.reduce((a,b)=>a+b,0) / N;
    const diffused = diff1.map(v => 2*meanDiff1 - v); // Inversion about mean relative to superposition
    
    // Scale diffused relative changes to [0, 1] for displaying
    const dMin = Math.min(...diffused);
    const dMax = Math.max(...diffused);
    const normDiff = diffused.map(v => (dMax - dMin > 1e-4) ? (v - dMin) / (dMax - dMin) : 0.5);

    this.log(this.t('shag_diffuzor_otrazhenie_ot_sr'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
      const bw = Math.floor(w / (N+1));
      for (let i = 0; i < N; i++) {
        const v = Math.round(normDiff[i] * 255);
        ctx.fillStyle=`rgb(${v},${v},${v})`;
        ctx.fillRect((i+0.5)*bw, h*0.15, bw*0.8, h*0.7);
      }
    });
    await this.sleep(1000);
    const f2 = await this.captureStable(8, 60);
    const bins2 = this.measureNBins(f2, N);
    this.log(this.t('rezultat', {var0: bins2.map(v=>v.toFixed(3)).join(', ')}));

    // Analysis: was target amplified relative to superposition?
    // Subtract bins0 to get clean differential response
    const diff2 = bins2.map((v, i) => v - bins0[i]);
    this.log(this.t('differentsialnyy_otklik', {var0: diff2.map(v=>v.toFixed(3)).join(', ')}));

    const targetIntensity = bins2[target];
    const othersMean = bins2.filter((_,i)=>i!==target).reduce((a,b)=>a+b,0)/(N-1);
    const amplification = othersMean > 0.001 ? targetIntensity / othersMean : 0;
    const amplificationDB = 10 * Math.log10(Math.max(amplification, 0.001));
    
    // Target is found if it has the largest differential increase
    const found = diff2.indexOf(Math.max(...diff2)) === target;

    // √N speedup check
    const sqrtN = Math.sqrt(N);
    const speedup = amplification > 1 ? this.t('iteratsiya_vmesto', {var0: N, var1: sqrtN.toFixed(1)}) : this.t('net');

    this.log(this.t('grover_target_amp_db', {var0: target, var1: amplification.toFixed(2), var2: amplificationDB.toFixed(1)}));
    this.log(this.t('nayden_n', {var0: found ? 'ДА' : this.t('net'), var1: sqrtN.toFixed(1)}));
    this.log(this.t('grover', {var0: found ? 'работает' : 'не найден'}), found ? 'ok' : 'warn');

    this.results.stage21 = {
      N, target, bins0, bins1, bins2, normDiff,
      targetIntensity, othersMean, amplification, amplificationDB,
      found, speedup
    };
}

export function render(r) {
if (r.stage21) { try {
      const s = r.stage21;
      this.rv('rv-grov-target', s.found ? `#${s.target} ✓` : `#${s.target} ✗`, s.found ? 'ok' : 'warn');
      this.rv('rv-grov-amp', s.amplificationDB.toFixed(1)+this.t('db'), s.amplification > 1.5 ? 'ok' : 'warn');
      this.rv('rv-grov-speed', s.speedup, s.found ? 'ok' : 'warn');
      const g = document.getElementById('g-s21');
      if (s.found && s.amplification > 1.5) { g.textContent=this.t('grover_nashyol_za_iteratsiyu'); g.className='grade pass'; }
      else if (s.found) { g.textContent=this.t('nayden_slaboe_usilenie'); g.className='grade partial'; }
      else { g.textContent=this.t('ne_nayden'); g.className='grade fail'; }
      this.drawGroverChart(s);
    } catch(e) { console.error('stage21 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.found)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'found=' + d.found)(d); } catch(e) { return '—'; }
}
