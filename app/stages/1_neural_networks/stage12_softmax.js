// Stage 12: Softmax

export async function run() {
this.setRun(this.t('etap'), this.t('osmoticheskiy_softmax'), 99.6);
    this.showColor('#808080');
    await this.sleep(800);

    // Show N patterns at different brightness levels
    // Measure optical response, check if it follows softmax distribution
    const inputLevels = [0.05, 0.15, 0.30, 0.50, 0.70, 0.85, 0.95];
    const opticalOutputs = [];

    for (let i = 0; i < inputLevels.length; i++) {
      const lv = inputLevels[i];
      this.setRun(this.t('etap'), this.t('yarkost', {var0: Math.round(lv*100)}), 99.6 + i*0.03);
      const gray = Math.round(lv * 255);
      this.showColor(`rgb(${gray},${gray},${gray})`);
      await this.sleep(800);
      const frame = await this.captureStable(6, 50);
      const mean = this.regionMean(frame);
      opticalOutputs.push(mean);
      this.log(`  In=${lv.toFixed(2)} → Opt=${mean.toFixed(4)}`);
      this.showColor('#808080');
      await this.sleep(400);
    }

    // Normalize optical outputs to [0,1]
    const oMin = Math.min(...opticalOutputs);
    const oMax = Math.max(...opticalOutputs, oMin + 0.001);
    const normOpt = opticalOutputs.map(v => (v - oMin) / (oMax - oMin));

    // Compute digital softmax of inputs
    const temperature = 3.0;
    const expInputs = inputLevels.map(x => Math.exp(x / temperature));
    const sumExp = expInputs.reduce((a, b) => a + b, 0);
    const digitalSoftmax = expInputs.map(e => e / sumExp);

    // Normalize digital to [0,1] for comparison
    const dsMin = Math.min(...digitalSoftmax);
    const dsMax = Math.max(...digitalSoftmax, dsMin + 0.001);
    const normDigital = digitalSoftmax.map(v => (v - dsMin) / (dsMax - dsMin));

    // Compute optical "softmax" from optical outputs
    const expOpt = normOpt.map(x => Math.exp(x / temperature));
    const sumExpOpt = expOpt.reduce((a, b) => a + b, 0);
    const optSoftmax = expOpt.map(e => e / sumExpOpt);

    // Correlation between digital softmax and optical softmax
    const corrSm = this.pearsonCorr(digitalSoftmax, optSoftmax);

    // KL divergence
    let kl = 0;
    for (let i = 0; i < digitalSoftmax.length; i++) {
      if (optSoftmax[i] > 1e-10) kl += digitalSoftmax[i] * Math.log(digitalSoftmax[i] / optSoftmax[i]);
    }

    // Monotonicity: is optical output monotonically increasing with input?
    let monoCount = 0;
    for (let i = 1; i < opticalOutputs.length; i++) {
      if (opticalOutputs[i] >= opticalOutputs[i-1] - 0.01) monoCount++;
    }
    const monotonicity = monoCount / (opticalOutputs.length - 1);

    this.log(`Softmax corr=${corrSm.toFixed(3)}, KL=${kl.toFixed(4)}, Mono=${(monotonicity*100).toFixed(0)}%`);
    this.log(this.t('softmax', {var0: corrSm > 0.7 ? 'работает' : 'слабый'}), corrSm > 0.7 ? 'ok' : 'warn');

    this.results.stage12 = {
      inputLevels, opticalOutputs, normOpt,
      digitalSoftmax, optSoftmax,
      corrSm, kl, monotonicity
    };
}

export function render(r) {
if (r.stage12) { try {
      const s = r.stage12;
      this.rv('rv-sm-kl', s.kl.toFixed(4), s.kl < 0.1 ? 'ok' : s.kl < 0.3 ? 'warn' : 'bad');
      this.rv('rv-sm-corr', s.corrSm.toFixed(3), s.corrSm > 0.8 ? 'ok' : s.corrSm > 0.5 ? 'warn' : 'bad');
      this.rv('rv-sm-mono', (s.monotonicity*100).toFixed(0)+'%', s.monotonicity > 0.8 ? 'ok' : 'warn');
      const g = document.getElementById('g-s12');
      if (s.corrSm > 0.7 && s.monotonicity > 0.6) {
        g.textContent=this.t('softmax_rabotaet'); g.className='grade pass';
      } else if (s.monotonicity > 0.5) {
        g.textContent=this.t('chastichnyy_softmax'); g.className='grade partial';
      } else { g.textContent=this.t('net_softmaxpovedeniya'); g.className='grade fail'; }
      this.drawSoftmaxChart(s);
    } catch(e) { console.error('stage12 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.corrSm > 0.5)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'corr=' + (d.corrSm||0).toFixed(3))(d); } catch(e) { return '—'; }
}
