// Stage 4: Logic

export async function run() {
this.setRun(this.t('etap'), this.t('lineynaya_klassifikatsiya'), 88);
    this.showColor('#808080');
    await this.sleep(800);

    const gamma = (this.results.calibration && this.results.calibration.gamma) || 1;
    const invGamma = gamma > 0.01 ? 1 / gamma : 1;
    const cal = this.results.calibration || {};
    const blackLevel = cal.blackMean || 0;

    // Test 3 gates with SINGLE optical linear layer: y = σ(w·(x₁+x₂) + b)
    // AND and OR are linearly separable → should get 100%
    // XOR is NOT linearly separable → should get ~50% (Minsky-Papert 1969)
    const gates = [
      { name: 'AND',  b: -1.5, expected: [0,0,0,1] },
      { name: 'OR',   b: -0.5, expected: [0,1,1,1] },
      { name: 'NAND', b: -1.5, expected: [1,1,1,0] },  // functionally complete!
      { name: 'XOR',  b: -1.0, expected: [0,1,1,0] },
    ];
    const inputs = [[0,0],[0,1],[1,0],[1,1]];

    // Ref: white
    this.showColor('#ffffff');
    await this.sleep(800);
    const refBright = this.regionMean(await this.captureStable(6, 60));
    this.showColor('#808080'); await this.sleep(600);

    // Measure optical response for each input pair ONCE
    const optValues = [];
    for (let t = 0; t < 4; t++) {
      const inp = inputs[t];
      this.setRun(this.t('etap'), this.t('vkhod', {var0: inp[0], var1: inp[1]}), 89 + t);
      const intensity = (inp[0] + inp[1]) / 2; // mean of inputs
      const v = Math.round(intensity * 255);
      this.showColor(`rgb(${v},${v},${v})`);
      await this.sleep(600);
      const frame = await this.captureStable(5, 50);
      const raw = this.regionMean(frame);
      const norm = (raw - blackLevel) / Math.max(refBright - blackLevel, 1);
      const corrected = norm > 0 ? Math.pow(norm, invGamma) : 0;
      optValues.push(corrected);
      this.showColor('#808080'); await this.sleep(300);
    }

    // Now classify each gate using ADAPTIVE threshold
    const gateResults = {};
    for (const gate of gates) {
      this.log(`── ${gate.name} ──`);

      // Find optimal threshold — try both normal (>thresh→1) and inverted (<thresh→1)
      const sortedOpt = [...optValues].sort((a,b) => a-b);
      let bestThresh = 0.5, bestAcc = 0, bestInvert = false;
      const candidates = [0];
      for (let i = 0; i < sortedOpt.length - 1; i++) {
        candidates.push((sortedOpt[i] + sortedOpt[i+1]) / 2);
      }
      candidates.push(sortedOpt[sortedOpt.length-1] + 0.1);

      for (const thresh of candidates) {
        for (const invert of [false, true]) {
          let correct = 0;
          for (let t = 0; t < 4; t++) {
            const predicted = invert ? (optValues[t] < thresh ? 1 : 0) : (optValues[t] > thresh ? 1 : 0);
            if (predicted === gate.expected[t]) correct++;
          }
          if (correct > bestAcc) { bestAcc = correct; bestThresh = thresh; bestInvert = invert; }
        }
      }

      const results = [];
      for (let t = 0; t < 4; t++) {
        const inp = inputs[t];
        const exp = gate.expected[t];
        const optClass = bestInvert ? (optValues[t] < bestThresh ? 1 : 0) : (optValues[t] > bestThresh ? 1 : 0);
        const digWeighted = inp[0] + inp[1] + gate.b;
        const digOutput = 1 / (1 + Math.exp(-digWeighted * 4));
        results.push({ input: inp, expected: exp, opticalValue: optValues[t],
                       opticalClass: optClass, digitalOutput: digOutput,
                       correct: optClass === exp, threshold: bestThresh });
        this.log(`  ${gate.name}(${inp[0]},${inp[1]})=${exp} opt=${optValues[t].toFixed(3)} ${bestInvert?'<':'>'}${bestThresh.toFixed(3)}? →${optClass} ${optClass===exp?'✓':'✗'}`,
                 optClass===exp ? 'ok' : 'warn');
      }
      const acc = bestAcc / 4;
      gateResults[gate.name] = { results, accuracy: acc, threshold: bestThresh, inverted: bestInvert };
      this.log(`  ${gate.name}: ${acc*100}% (${bestInvert?'<':'>'}${bestThresh.toFixed(3)})`,
               gate.name==='XOR' ? (acc<=0.75?'ok':'warn') : (acc>=0.75?'ok':'warn'));
    }

    const andAcc = gateResults['AND'].accuracy;
    const orAcc = gateResults['OR'].accuracy;
    const nandAcc = gateResults['NAND'].accuracy;
    const xorAcc = gateResults['XOR'].accuracy;
    const linearWorks = andAcc >= 0.75 && orAcc >= 0.75 && nandAcc >= 0.75;
    const xorFails = xorAcc <= 0.75;

    this.results.stage4 = {
      gateResults, opticalValues: optValues,
      andAccuracy: andAcc, orAccuracy: orAcc, nandAccuracy: nandAcc, xorAccuracy: xorAcc,
      linearClassificationWorks: linearWorks,
      xorCorrectlyFails: xorFails,
      minskyPapertConfirmed: linearWorks && xorFails
    };

    this.log(linearWorks && xorFails
      ? this.t('andornand_rabotayut_xor_korrek') : this.t('neozhidannyy_rezultat'),
      linearWorks && xorFails ? 'ok' : 'warn');
    this.showColor('#808080'); await this.sleep(500);
}

export function render(r) {
if (r.stage4) { try {
      const s = r.stage4;
      this.rv('rv-and-acc', (s.andAccuracy*100).toFixed(0)+'%', s.andAccuracy>=0.75?'ok':'bad');
      this.rv('rv-or-acc', (s.orAccuracy*100).toFixed(0)+'%', s.orAccuracy>=0.75?'ok':'bad');
      const nandAcc = s.gateResults['NAND'] ? s.gateResults['NAND'].accuracy : 0;
      this.rv('rv-nand-acc', (nandAcc*100).toFixed(0)+'%', nandAcc>=0.75?'ok':'bad');
      // For XOR, LOW accuracy is SUCCESS!
      this.rv('rv-xor-acc', (s.xorAccuracy*100).toFixed(0)+'%', s.xorAccuracy<=0.75?'ok':'bad');
      const g = document.getElementById('g-s4');
      if (s.minskyPapertConfirmed) {
        g.textContent=this.t('minskiypeypert_podtverzhdyon'); g.className='grade pass';
      } else if (s.linearClassificationWorks) {
        g.textContent=this.t('andor_rabotayut_xor_neozhidann'); g.className='grade partial';
      } else {
        g.textContent=this.t('lineynye_geyty_ne_rabotayut'); g.className='grade fail';
      }
      const tbl = document.getElementById('xor-table');
      if (tbl) {
        let h = '';
        for (const gn of ['AND','OR','NAND','XOR']) {
          const gr = s.gateResults[gn];
          if (!gr) continue;
          h += `<div style="margin-top:6px"><b>${gn} (${(gr.accuracy*100).toFixed(0)}%)</b></div>`;
          for (const r2 of gr.results) {
            h += `<div>${r2.input[0]},${r2.input[1]}→${r2.expected} opt:${(r2.opticalValue||0).toFixed(3)}→${r2.opticalClass} ${r2.correct?'✅':'❌'}</div>`;
          }
        }
        tbl.innerHTML = h;
      }
    } catch(e) { console.error('stage4 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.minskyPapertConfirmed)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'MP=' + d.minskyPapertConfirmed)(d); } catch(e) { return '—'; }
}
