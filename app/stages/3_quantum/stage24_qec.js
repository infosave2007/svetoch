// Stage 24: QEC

export async function run() {
this.setRun(this.t('etap'), 'QEC...', 99.993);
    this.showColor('#808080');
    await this.sleep(800);

    // Sequential full-screen calibration (proven approach from Stage 26)
    this.showColor('#282828'); await this.sleep(600);
    const fCalD = await this.captureStable(8, 50);
    const darkRef = this.regionMean(fCalD);
    this.showColor('#c8c8c8'); await this.sleep(600);
    const fCalB = await this.captureStable(8, 50);
    const brightRef = this.regionMean(fCalB);
    const thresh = (darkRef + brightRef) / 2;
    this.log(`QEC cal: dark=${darkRef.toFixed(1)}, bright=${brightRef.toFixed(1)}, thresh=${thresh.toFixed(1)}`);
    this.showColor('#808080'); await this.sleep(400);

    const trials = [];
    const states = [
      {name:'|0⟩_L', bits:[1,1,1]}, // Logical |0⟩ = all bright
      {name:'|1⟩_L', bits:[0,0,0]}   // Logical |1⟩ = all dark
    ];
    const errorPositions = [0, 1, 2];

    for (const state of states) {
      const originalBit = state.bits[0]; // All same for repetition code
      this.log(`${state.name}: bits=[${state.bits.join(',')}]`);

      // Measure pre-error state sequentially
      const bitsPre = [];
      for (let q = 0; q < 3; q++) {
        const v = state.bits[q] ? 200 : 40;
        this.showColor(`rgb(${v},${v},${v})`);
        await this.sleep(300);
        const f = await this.captureStable(3, 30);
        const val = f ? this.regionMean(f) : 0;
        bitsPre.push(val > thresh ? 1 : 0);
      }
      const fidPre = bitsPre.filter((b,i) => b === state.bits[i]).length / 3;

      for (const errPos of errorPositions) {
        const errBits = [...state.bits];
        errBits[errPos] = errBits[errPos] ? 0 : 1; // Flip one bit
        this.log(`  Error @${errPos}: [${errBits.join(',')}]`);

        // Measure error state sequentially
        const measBits = [];
        const measVals = [];
        for (let q = 0; q < 3; q++) {
          const v = errBits[q] ? 200 : 40;
          this.showColor(`rgb(${v},${v},${v})`);
          await this.sleep(300);
          const f = await this.captureStable(3, 30);
          const val = f ? this.regionMean(f) : 0;
          measVals.push(val);
          measBits.push(val > thresh ? 1 : 0);
        }

        // Majority vote correction
        const majorityBit = measBits.filter(v => v === 1).length >= 2 ? 1 : 0;
        const recovered = majorityBit === originalBit;

        const fidErr = measBits.filter((b,i) => b === state.bits[i]).length / 3;
        const fidFix = majorityBit === originalBit ? 1 : 0;

        trials.push({
          state: state.name, errPos, originalBit, majorityBit,
          recovered, fidPre, fidErr, fidFix,
          measBits, measVals
        });
        this.log(`    Meas=[${measBits.join(',')}] Majority=${majorityBit}, Original=${originalBit}, ${recovered?'✓':'✗'}`);
        this.showColor('#808080'); await this.sleep(200);
      }
    }

    const recoveryRate = trials.filter(t=>t.recovered).length / trials.length;
    const avgFidPre = trials.reduce((s,t)=>s+t.fidPre,0)/trials.length;
    const avgFidErr = trials.reduce((s,t)=>s+t.fidErr,0)/trials.length;
    const avgFidFix = trials.reduce((s,t)=>s+t.fidFix,0)/trials.length;

    this.log(`QEC: recovery=${(recoveryRate*100).toFixed(0)}%, F_pre=${avgFidPre.toFixed(3)}, F_err=${avgFidErr.toFixed(3)}, F_fix=${avgFidFix.toFixed(3)}`);
    this.log(this.t('qec', {var0: recoveryRate >= 0.8 ? 'работает' : 'слабый'}), recoveryRate >= 0.8 ? 'ok' : 'warn');

    this.results.stage24 = { trials, recoveryRate, avgFidPre, avgFidErr, avgFidFix };
}

export function render(r) {
if (r.stage24) { try {
      const s = r.stage24;
      this.rv('rv-qec-pre', s.avgFidPre.toFixed(3), s.avgFidPre>0.5?'ok':'warn');
      this.rv('rv-qec-err', s.avgFidErr.toFixed(3), 'warn');
      this.rv('rv-qec-fix', `${(s.recoveryRate*100).toFixed(0)}%`, s.recoveryRate>=0.8?'ok':'warn');
      const g = document.getElementById('g-s24');
      if (s.recoveryRate >= 0.9) { g.textContent=this.t('qec_vosstanovil'); g.className='grade pass'; }
      else if (s.recoveryRate >= 0.6) { g.textContent=this.t('chastichnaya_korrektsiya'); g.className='grade partial'; }
      else { g.textContent=this.t('qec_ne_rabotaet'); g.className='grade fail'; }
      this.drawQECChart(s);
    } catch(e) { console.error('stage24 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.recoveryRate >= 0.6)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'rec=' + (d.recoveryRate*100||0).toFixed(0) + '%')(d); } catch(e) { return '—'; }
}
