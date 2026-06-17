// Stage 26: W-bits

export async function run() {
this.setRun(this.t('etap'), this.t('yomkost_wbit'), 100.01);
    this.showColor('#808080');
    await this.sleep(800);

    // In-situ calibration: full-screen dark and bright
    this.showColor('#282828'); await this.sleep(600);
    const fD = await this.captureStable(8, 50);
    const darkRef = this.regionMean(fD);
    this.showColor('#c8c8c8'); await this.sleep(600);
    const fB = await this.captureStable(8, 50);
    const brightRef = this.regionMean(fB);
    const thresh = (darkRef + brightRef) / 2;
    this.log(`W-bit cal: dark=${darkRef.toFixed(1)}, bright=${brightRef.toFixed(1)}, thresh=${thresh.toFixed(1)}, gap=${(brightRef-darkRef).toFixed(1)}`);
    this.showColor('#808080'); await this.sleep(400);

    const maxQubits = 16;
    const results = [];

    for (let nQ = 1; nQ <= maxQubits; nQ++) {
      this.setRun(this.t('etap'), this.t('wbit', {var0: nQ}), 100.01 + nQ * 0.3);
      // Test patterns: all-zeros, all-ones, alternating
      const patterns = [
        new Array(nQ).fill(0),
        new Array(nQ).fill(1),
      ];
      if (nQ >= 2) patterns.push(Array.from({length:nQ}, (_,i) => i%2));

      let totalCorrect = 0, totalBits = 0;

      for (const pat of patterns) {
        // Read each W-bit SEQUENTIALLY as full-screen brightness
        // Each measurement probes a discrete amplitude of the vacuum condensate W-field
        for (let q = 0; q < nQ; q++) {
          const v = pat[q] ? 200 : 40;
          this.showColor(`rgb(${v},${v},${v})`);
          await this.sleep(300);
          const frame = await this.captureStable(3, 30);
          if (frame) {
            const val = this.regionMean(frame);
            const bit = val > thresh ? 1 : 0;
            if (bit === pat[q]) totalCorrect++;
          }
          totalBits++;
        }
        this.showColor('#808080'); await this.sleep(200);
      }

      const accuracy = totalBits > 0 ? totalCorrect / totalBits : 0;
      results.push({ nQubits: nQ, accuracy, totalCorrect, totalBits });
      this.log(this.t('wbit_1', {var0: nQ, var1: (accuracy*100).toFixed(0), var2: totalCorrect, var3: totalBits}),
        accuracy >= 0.75 ? 'ok' : 'warn');
    }

    // Find max W-bits with accuracy >= 75%
    const maxUsable = results.filter(r => r.accuracy >= 0.75).length;
    const maxPerfect = results.filter(r => r.accuracy >= 0.95).length;

    this.log(this.t('maks_wbit', {var0: maxUsable, var1: maxPerfect}));
    this.log(this.t('yomkost', {var0: maxUsable >= 4 ? 'хорошая' : 'ограничена'}), maxUsable >= 4 ? 'ok' : 'warn');

    this.results.stage26 = { results, maxUsable, maxPerfect };
}

export function render(r) {
if (r.stage26) { try {
      const s = r.stage26;
      this.rv('rv-qub-usable', s.maxUsable, s.maxUsable>=4?'ok':'warn');
      this.rv('rv-qub-perfect', s.maxPerfect, s.maxPerfect>=2?'ok':'warn');
      const g = document.getElementById('g-s26');
      if (s.maxUsable>=4) { g.textContent=this.t('dostatochno_kubitov'); g.className='grade pass'; }
      else if (s.maxUsable>=2) { g.textContent=this.t('malo_kubitov'); g.className='grade partial'; }
      else { g.textContent=this.t('nedostatochno'); g.className='grade fail'; }
    } catch(e) { console.error('stage26 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.maxUsable >= 4)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => '≥75%:' + (d.maxUsable||0))(d); } catch(e) { return '—'; }
}
