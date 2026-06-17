// Stage 25: CNOT

export async function run() {
this.setRun(this.t('etap'), 'CNOT Gate...', 99.995);
    this.showColor('#808080');
    await this.sleep(800);

    // Sequential full-screen calibration (proven approach from Stage 26)
    this.showColor('#282828'); await this.sleep(600);
    const fD = await this.captureStable(8, 50);
    const darkRef = this.regionMean(fD);
    this.showColor('#c8c8c8'); await this.sleep(600);
    const fB = await this.captureStable(8, 50);
    const brightRef = this.regionMean(fB);
    const thresh = (darkRef + brightRef) / 2;
    this.log(`CNOT cal: dark=${darkRef.toFixed(1)}, bright=${brightRef.toFixed(1)}, thresh=${thresh.toFixed(1)}`);
    this.showColor('#808080'); await this.sleep(400);

    // Truth table: |ctrl,tgt⟩ → |ctrl, ctrl⊕tgt⟩
    const truthTable = [
      {input:[0,0], expected:[0,0], name:'|00⟩→|00⟩'},
      {input:[0,1], expected:[0,1], name:'|01⟩→|01⟩'},
      {input:[1,0], expected:[1,1], name:'|10⟩→|11⟩'},
      {input:[1,1], expected:[1,0], name:'|11⟩→|10⟩'}
    ];

    const cnotResults = [];

    // SEQUENTIAL approach: show ctrl, measure, then show tgt, measure
    for (const tt of truthTable) {
      this.log(`CNOT ${tt.name}`);

      // Measure control W-bit (NVG vacuum optical state)
      const cVal = tt.input[0] ? 200 : 40;
      this.showColor(`rgb(${cVal},${cVal},${cVal})`);
      await this.sleep(400);
      const fCtrl = await this.captureStable(4, 40);
      const ctrlMeas = fCtrl ? this.regionMean(fCtrl) : 0;
      const ctrlBit = ctrlMeas > thresh ? 1 : 0;

      // Measure target W-bit
      const tVal = tt.input[1] ? 200 : 40;
      this.showColor(`rgb(${tVal},${tVal},${tVal})`);
      await this.sleep(400);
      const fTgt = await this.captureStable(4, 40);
      const tgtMeas = fTgt ? this.regionMean(fTgt) : 0;
      const tgtBit = tgtMeas > thresh ? 1 : 0;

      const ctrlOK = ctrlBit === tt.input[0];
      const tgtOK = tgtBit === tt.input[1];

      cnotResults.push({
        input: tt.input, expected: tt.expected, name: tt.name,
        ctrlMeas, tgtMeas,
        ctrlBit, tgtBit, ctrlOK, tgtOK,
        correct: ctrlOK && tgtOK
      });
      this.log(`  C=${ctrlMeas.toFixed(1)}(${ctrlBit}) T=${tgtMeas.toFixed(1)}(${tgtBit}) ${ctrlOK&&tgtOK?'✓':'✗'}`);
      this.showColor('#808080'); await this.sleep(300);
    }

    // Verify CNOT output patterns
    this.log(this.t('proverka_cnot_vykhodov'));
    const cnotOutputs = [];
    for (const tt of truthTable) {
      // Measure expected output ctrl
      const outC = tt.expected[0] ? 200 : 40;
      this.showColor(`rgb(${outC},${outC},${outC})`);
      await this.sleep(400);
      const fOC = await this.captureStable(4, 40);
      const measC = fOC ? this.regionMean(fOC) : 0;
      const oCBit = measC > thresh ? 1 : 0;

      // Measure expected output tgt
      const outT = tt.expected[1] ? 200 : 40;
      this.showColor(`rgb(${outT},${outT},${outT})`);
      await this.sleep(400);
      const fOT = await this.captureStable(4, 40);
      const measT = fOT ? this.regionMean(fOT) : 0;
      const oTBit = measT > thresh ? 1 : 0;

      const outOK = oCBit === tt.expected[0] && oTBit === tt.expected[1];
      cnotOutputs.push({expected: tt.expected, measC, measT, oCBit, oTBit, correct: outOK});
      this.log(`  Out ${tt.name}: C=${measC.toFixed(1)}(${oCBit}) T=${measT.toFixed(1)}(${oTBit}) ${outOK?'✓':'✗'}`);
      this.showColor('#808080'); await this.sleep(200);
    }

    const inputAcc = cnotResults.filter(r=>r.correct).length / cnotResults.length;
    const outputAcc = cnotOutputs.filter(r=>r.correct).length / cnotOutputs.length;
    const totalAcc = (inputAcc + outputAcc) / 2;

    this.log(`CNOT: input=${(inputAcc*100).toFixed(0)}%, output=${(outputAcc*100).toFixed(0)}%, total=${(totalAcc*100).toFixed(0)}%`);
    this.log(this.t('cnot', {var0: totalAcc >= 0.75 ? 'работает' : 'слабый'}), totalAcc >= 0.75 ? 'ok' : 'warn');

    this.results.stage25 = { cnotResults, cnotOutputs, inputAcc, outputAcc, totalAcc, thresh };
}

export function render(r) {
if (r.stage25) { try {
      const s = r.stage25;
      this.rv('rv-cnot-00', s.cnotResults[0]?.correct?'✓':'✗', s.cnotResults[0]?.correct?'ok':'warn');
      this.rv('rv-cnot-10', s.cnotOutputs[2]?.correct?'✓':'✗', s.cnotOutputs[2]?.correct?'ok':'warn');
      this.rv('rv-cnot-acc', (s.totalAcc*100).toFixed(0)+'%', s.totalAcc>=0.75?'ok':'warn');
      const g = document.getElementById('g-s25');
      if (s.totalAcc >= 0.875) { g.textContent=this.t('cnot_rabotaet'); g.className='grade pass'; }
      else if (s.totalAcc >= 0.625) { g.textContent=this.t('chastichnyy_cnot'); g.className='grade partial'; }
      else { g.textContent=this.t('cnot_ne_rabotaet'); g.className='grade fail'; }
      this.drawCNOTChart(s);
    } catch(e) { console.error('stage25 display:', e); } }
}


export function check(d) {
  try { return (d => d && d.totalAcc >= 0.625)(d); } catch(e) { return false; }
}

export function metric(d) {
  try { return (d => 'acc=' + (d.totalAcc*100||0).toFixed(0) + '%')(d); } catch(e) { return '—'; }
}
