// Stage 18: θ-Col

export async function run() {
this.setRun(this.t('etap'), this.t('kollaps'), 99.96);
    this.showColor('#808080');
    await this.sleep(800);

    // Show HIGH-CONTRAST non-equilibrium pattern:
    // Sharp bright spike (10% of width) on dark background
    // This creates high initial spatial variance → should decay → collapse
    this.log(this.t('pokaz_neravnovesnogo_patterna_'));
    this.showPattern((ctx, w, h) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
      // Narrow bright spike in center (10% width)
      const spikeW = Math.round(w * 0.1);
      const spikeX = Math.round((w - spikeW) / 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(spikeX, 0, spikeW, h);
    });
    await this.sleep(1500);

    const spatialVariance = (frame) => {
      const bins = this.measureCalibratedBins ? this.measureCalibratedBins(frame, 8, { mirror: false }) : this.measureNBins(frame, 8);
      const avg = bins.reduce((a,b)=>a+b,0) / bins.length;
      return bins.reduce((s,v)=>s+(v-avg)**2,0) / bins.length;
    };

    const fInitial = await this.captureStable(6, 40);
    const initialVar = spatialVariance(fInitial);

    this.showColor('#808080');
    await this.sleep(80);

    const nMeasurements = 30;
    const means = [];
    const spatialVars = [];
    const timestamps = [];

    const t0 = performance.now();
    for (let m = 0; m < nMeasurements; m++) {
      this.setRun(this.t('etap'), this.t('izmerenie', {var0: m+1, var1: nMeasurements}), 99.96 + m*0.001);
      const frame = await this.captureStable(3, 20);
      const mean = this.regionMean(frame);
      means.push(mean);
      timestamps.push(performance.now() - t0);
      spatialVars.push(spatialVariance(frame));
    }

    const fPost = await this.captureStable(6, 40);
    const postMean = this.regionMean(fPost);

    const earlyVar = initialVar;
    const lateVar = spatialVars.slice(-10).reduce((a,b)=>a+b,0) / 10;
    const convergence = earlyVar > 1e-6 ? lateVar / earlyVar : 1;

    const stableIdx = spatialVars.findIndex((v) => v < earlyVar * 0.5);
    const tauMs = stableIdx > 0 ? timestamps[stableIdx] : timestamps[timestamps.length-1];

    const firstMean = means[0];
    const restMean = means.slice(1).reduce((a,b)=>a+b,0) / (means.length-1);
    const backAction = Math.abs(firstMean - restMean) / Math.max(firstMean, 0.001) * 100;

    this.log(this.t('rannyaya_spatial_pozdnyaya_spa', {var0: earlyVar.toFixed(6), var1: lateVar.toFixed(6)}));
    this.log(this.t('skhodimost_ms', {var0: convergence.toFixed(3), var1: tauMs.toFixed(0)}));
    this.log(`Back-action: ${backAction.toFixed(1)}%`);
    this.log(this.t('kollaps_1', {var0: convergence < 0.8 ? 'подтверждён' : 'слабый'}), convergence < 0.8 ? 'ok' : 'warn');

    this.results.stage18 = {
      means, spatialVars, timestamps,
      initialVar, earlyVar, lateVar, convergence, tauMs,
      backAction, postMean
    };
}

export function render(r) {
if (r.stage18) { try {
      const s = r.stage18;
      this.rv('rv-col-tau', s.tauMs.toFixed(0)+'ms', s.convergence < 0.7 ? 'ok' : 'warn');
      this.rv('rv-col-conv', s.convergence.toFixed(3), s.convergence < 0.7 ? 'ok' : s.convergence < 1 ? 'warn' : 'bad');
      this.rv('rv-col-back', s.backAction.toFixed(1)+'%', s.backAction > 1 ? 'ok' : 'warn');
      const g = document.getElementById('g-s18');
      if (s.convergence < 0.5) {
        g.textContent=this.t('kollaps_podtverzhdyon'); g.className='grade pass';
      } else if (s.convergence < 0.8) {
        g.textContent=this.t('chastichnaya_dekogerentsiya'); g.className='grade partial';
      } else { g.textContent=this.t('net_skhodimosti'); g.className='grade fail'; }
      this.drawCollapseChart(s);
    } catch(e) { console.error('stage18 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.convergence < 0.8)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'conv=' + (d.convergence||1).toFixed(3))(d); } catch(e) { return '—'; }
}
